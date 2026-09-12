import { 
  QueryIntent, 
  CustomCardArchetype, 
  ResultWidgetKey, 
  WidgetPlan, 
  SearchResult, 
  WidgetAction 
} from "../src/types.js";
import { classifyQueryIntent, planTaskCapabilities } from "./intentAgent.js";
import { synthesizeToolActions } from "./toolRegistry.js";

/**
 * WidgetPlannerAgent (专属小组件规划 Agent)
 * 职责：
 * 1. 深度研判用户目标与意图 (Intent)
 * 2. 梳理完成任务所需的真实能力模型 (Capabilities)
 * 3. 规划最贴合的卡片业务原型 (Archetype) 与交互动作 (Actions)
 * 4. 决定展示优先级与组件排列顺序 (Widget Priority Order)
 */
export async function planWidgetStrategy(options: {
  query: string;
  results: SearchResult[];
  targetLanguage?: string;
}): Promise<WidgetPlan> {
  const { query, results } = options;

  // 1. 意图分类与目标研判
  const { intent, userGoal } = await classifyQueryIntent(query, results);

  // 2. 规划完成该任务所需的能力清单
  const taskCaps = await planTaskCapabilities(intent, userGoal, query, results);
  const capabilities = taskCaps.required_capabilities || [];

  // 3. 根据意图与能力决定最精准的业务原型 (Archetype)
  let suggestedArchetype: CustomCardArchetype = "parameter_matrix";
  let themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc" = "blue";
  let iconName = "Layers";

  switch (intent) {
    case "install":
      suggestedArchetype = "download_hub";
      themeColor = "blue";
      iconName = "Download";
      break;
    case "tool_discovery":
      suggestedArchetype = "tool_discovery";
      themeColor = "emerald";
      iconName = "Wrench";
      break;
    case "travel":
      suggestedArchetype = "travel_itinerary";
      themeColor = "amber";
      iconName = "Compass";
      break;
    case "troubleshooting":
      suggestedArchetype = "action_checklist";
      themeColor = "rose";
      iconName = "Terminal";
      break;
    case "compare":
      suggestedArchetype = /(谁更好|推荐|买哪个|选型|裁决)/i.test(query) ? "verdict_summary" : "pros_cons";
      themeColor = "violet";
      iconName = "Scale";
      break;
    case "tutorial":
      suggestedArchetype = "action_checklist";
      themeColor = "emerald";
      iconName = "CheckCircle";
      break;
    case "research":
      suggestedArchetype = /(演进|历程|版本|历史)/i.test(query) ? "timeline" : "parameter_matrix";
      themeColor = "zinc";
      iconName = "Layers";
      break;
    case "explain":
    default:
      if (/(演进|历程|发展史|版本变化)/i.test(query)) {
        suggestedArchetype = "timeline";
        iconName = "Calendar";
      } else if (/(言论|评价|争议|观点)/i.test(query)) {
        suggestedArchetype = "quote_dossier";
        iconName = "Quote";
      } else {
        suggestedArchetype = "parameter_matrix";
        iconName = "Layers";
      }
      themeColor = "blue";
      break;
  }

  // 4. 生成可执行的真实 Tool Registry 动作
  const primaryActions: WidgetAction[] = synthesizeToolActions(query, results, intent as any);

  // 5. 决定展示优先级与组件排列顺序 (Widget Priority Order) - 不做僵硬网格计算，专注于信息与功能优先级
  let widgets: ResultWidgetKey[] = [];

  switch (intent) {
    case "install":
      // 下载安装场景：置顶下载与实操卡片、工具箱与官方入口
      widgets = [
        "custom_cards",
        "actions_toolbox",
        "official_portal",
        "verification_checklist",
        "quick_answer",
        "takeaways",
        "sources",
        "fast_chat"
      ];
      break;

    case "tool_discovery":
      // 工具发现场景：置顶工具卡片、多方案对比与工具箱
      widgets = [
        "custom_cards",
        "comparison",
        "official_portal",
        "actions_toolbox",
        "quick_answer",
        "takeaways",
        "sources",
        "fast_chat"
      ];
      break;

    case "travel":
      // 旅游攻略场景：置顶行程表、核心要点、官方票务与工具
      widgets = [
        "custom_cards",
        "takeaways",
        "official_portal",
        "actions_toolbox",
        "quick_answer",
        "sources",
        "fast_chat"
      ];
      break;

    case "troubleshooting":
      // 排障诊断场景：置顶诊断工具箱、检查清单与实操卡片
      widgets = [
        "actions_toolbox",
        "verification_checklist",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "sources",
        "fast_chat"
      ];
      break;

    case "compare":
      // 选型对比场景：置顶对比矩阵、专属裁决卡、核心结论
      widgets = [
        "comparison",
        "custom_cards",
        "takeaways",
        "quick_answer",
        "sources",
        "actions_toolbox",
        "fast_chat"
      ];
      break;

    case "tutorial":
      // 实操教程场景：置顶实操代码/工具箱、执行清单与直接速答
      widgets = [
        "actions_toolbox",
        "custom_cards",
        "quick_answer",
        "topic_digest",
        "takeaways",
        "sources",
        "fast_chat"
      ];
      break;

    case "research":
      // 深度研报场景：置顶核心结论、思维导图、专属看板与趋势
      widgets = [
        "takeaways",
        "mindmap",
        "custom_cards",
        "topic_digest",
        "analytics_trend",
        "sources",
        "actions_toolbox",
        "fast_chat"
      ];
      break;

    case "explain":
    default:
      // 概念科普场景：置顶极简直接速答、知识导图与要点
      widgets = [
        "quick_answer",
        "mindmap",
        "custom_cards",
        "takeaways",
        "sources",
        "actions_toolbox",
        "fast_chat"
      ];
      break;
  }

  return {
    intent,
    userGoal,
    suggestedArchetype,
    capabilities,
    widgets,
    primaryActions,
    widgetCustomizations: {
      suggestedArchetype,
      themeColor,
      iconName
    }
  };
}
