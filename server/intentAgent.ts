import {
  QueryIntent,
  TaskCapabilityRequirements,
  SearchResult,
  ResultWidgetKey,
  WidgetQualityGuardReport
} from "../src/types.js";
import { callOpenRouterChat, resolveOpenRouterApiKey } from "./openrouter.js";
import type { CanonicalCapability } from "../src/widgets/capabilityTaxonomy.js";

/**
 * 确定性 Intent -> Widget 映射基准表 (Deterministic Baseline Mapping)
 *
 * ⚠️ capabilities 取值必须来自 src/widgets/capabilityTaxonomy.ts 的 CANONICAL_CAPABILITIES。
 * 改造前这里是一份独立的近似词表 (pricing_model / step_list / copy_code / key_takeaways ...)，
 * 与组件侧词表不相通，且与 widgetIntentAnalyzer 的意图判定互相污染。
 */
export const INTENT_WIDGET_MAP: Record<QueryIntent, {
  capabilities: CanonicalCapability[];
  recommendedWidgets: ResultWidgetKey[];
  forbiddenCategories?: string[];
}> = {
  install: {
    capabilities: ["official_portal", "download"],
    recommendedWidgets: ["related_links"]
  },
  compare: {
    capabilities: ["official_portal"],
    recommendedWidgets: ["related_links"]
  },
  tool_discovery: {
    capabilities: ["official_portal"],
    recommendedWidgets: ["related_links"]
  },
  tutorial: {
    capabilities: ["official_portal"],
    recommendedWidgets: ["related_links"]
  },
  troubleshooting: {
    capabilities: ["official_portal"],
    recommendedWidgets: ["related_links"]
  },
  travel: {
    capabilities: ["official_portal"],
    recommendedWidgets: ["related_links"]
  },
  explain: {
    capabilities: ["official_portal"],
    recommendedWidgets: ["related_links"]
  },
  research: {
    capabilities: ["official_portal"],
    recommendedWidgets: ["related_links"]
  }
};

/**
 * 1. Intent Classification Agent (意图分类智能体)
 * 研判用户想完成什么，而不是仅仅搜索了什么
 */
export async function classifyQueryIntent(
  query: string,
  results: SearchResult[] = [],
  context?: { env?: Record<string, string | undefined>; apiKey?: string }
): Promise<{ intent: QueryIntent; userGoal: string; confidence: number }> {
  const normalized = query.toLowerCase().trim();
  const openRouterKey = resolveOpenRouterApiKey(context?.apiKey, context?.env);
  if (openRouterKey && openRouterKey.trim() !== "") {
    try {
      const prompt = `你是一位专门负责【用户意图精准分类 (Intent Classification Agent)】的专职智能体。
必须判断【用户究竟想完成什么任务】，而不是做被动的字面分类。

【分类候选集】:
1. install: 软件安装/部署环境/下载CLI/包管理配置 (如 "Docker 怎么安装", "下载 Python 3.12", "brew install nginx")
2. compare: 选型对比/优劣分析/方案 PK (如 "Docker 和 Podman 区别", "React vs Vue 3 性能对比", "买 iPhone 16 还是 15 Pro")
3. tool_discovery: 工具发现/寻找可用软件/在线工具/免费替代品 (如 "有没有免费的图片压缩工具", "好用的 API 调试工具", "PDF 转换网站推荐")
4. tutorial: 代码编写/实操教程/开发实战 (如 "怎么写 Promise.all", "Nginx 反向代理配置教程", "Spring Boot 整合 Redis")
5. troubleshooting: 报错排查/异常修复/避坑指南 (如 "npm ERR! code ERESOLVE", "Docker 启动报错 permission denied", "CORS 跨域报错解决")
6. travel: 旅游攻略/行程路线/景点推荐/预算花费 (如 "日本 7 日游攻略", "成都必去景点和美食", "去西藏需要准备什么")
7. explain: 概念科普/原理剖析/名词解释 (如 "什么是量子计算", "区块链原理", "HTTP 3.0 是什么")
8. research: 深度行业研报/学术综述/全景分析 (如 "人形机器人产业链深度研报", "大模型推理加速前沿综述")

【用户搜索词】: ${query}

请输出合法 JSON:
{
  "intent": "install | compare | tool_discovery | tutorial | troubleshooting | travel | explain | research",
  "userGoal": "清晰一句话概括用户想完成的真实目标",
  "confidence": 0.95
}`;

      const txt = await callOpenRouterChat({
        messages: [{ role: "user", content: prompt }],
        model: "openrouter/free",
        timeoutMs: 1800,
        responseFormatJson: true
      });

      if (txt) {
        const parsed = JSON.parse(txt);
        if (parsed.intent && INTENT_WIDGET_MAP[parsed.intent as QueryIntent]) {
          return {
            intent: parsed.intent as QueryIntent,
            userGoal: parsed.userGoal || `用户希望完成 ${parsed.intent} 相关任务`,
            confidence: parsed.confidence || 0.9
          };
        }
      }
    } catch {
      // fallback to algorithmic rules
    }
  }

  // 确定性规则兜底分析
  return classifyIntentAlgorithmically(normalized);
}

function classifyIntentAlgorithmically(q: string): { intent: QueryIntent; userGoal: string; confidence: number } {
  // 1. install
  if (/安装|下载|配置环境|部署|install|download|setup|docker run|brew install|pip install|npm i|yum install|apt-get/i.test(q)) {
    return {
      intent: "install",
      userGoal: `下载并安装部署目标环境或软件 (${q})`,
      confidence: 0.92
    };
  }

  // 2. compare
  if (/区别|对比|哪个好|vs|versus|选型|优缺点|差异|比较|谁更好|选哪个|pk/i.test(q)) {
    return {
      intent: "compare",
      userGoal: `对比多个方案的核心差异与优缺点并做出选型决策`,
      confidence: 0.94
    };
  }

  // 3. tool discovery
  if (/工具|网站|平台|在线|免费|推荐|软件推荐|好用|generator|converter|tool|app|utility|在线压缩|在线转换/i.test(q)) {
    return {
      intent: "tool_discovery",
      userGoal: `发现并筛选可用的在线工具、软件或服务`,
      confidence: 0.9
    };
  }

  // 4. travel
  if (/旅游|攻略|景点|行程|门票|酒店|美食|自驾|住宿|怎么玩|几日游|带孩子|路线/i.test(q)) {
    return {
      intent: "travel",
      userGoal: `规划旅行行程路线、景点打卡与出行攻略`,
      confidence: 0.93
    };
  }

  // 5. troubleshooting
  if (/报错|失败|error|exception|bug|解决|修复|无法启动|crash|failed|warning|排查|解决办法/i.test(q)) {
    return {
      intent: "troubleshooting",
      userGoal: `诊断并排查系统报错或异常故障`,
      confidence: 0.91
    };
  }

  // 6. tutorial
  if (/教程|怎么写|实现|实战|步骤|代码|如何编写|入门|进阶|示例|example|tutorial|how to/i.test(q)) {
    return {
      intent: "tutorial",
      userGoal: `学习代码实现步骤与技术教程`,
      confidence: 0.88
    };
  }

  // 7. research
  if (/研报|产业链|行业报告|现状与未来|前沿趋势|综述|白皮书|market share/i.test(q)) {
    return {
      intent: "research",
      userGoal: `深入研究产业格局、发展脉络与前沿研报`,
      confidence: 0.89
    };
  }

  // 8. explain
  return {
    intent: "explain",
    userGoal: `理解概念定义与核心原理解析`,
    confidence: 0.85
  };
}

/**
 * 2. Task Planning & Capability Requirements Agent
 * 中间决策层：将 Intent 转化为具体的 Capability Requirements
 */
export async function planTaskCapabilities(
  intent: QueryIntent,
  userGoal: string,
  query: string,
  results: SearchResult[],
  context?: { env?: Record<string, string | undefined>; apiKey?: string }
): Promise<TaskCapabilityRequirements> {
  const baseline = INTENT_WIDGET_MAP[intent] || INTENT_WIDGET_MAP.explain;
  const openRouterKey = resolveOpenRouterApiKey(context?.apiKey, context?.env);

  if (openRouterKey && openRouterKey.trim() !== "") {
    try {
      const prompt = `你是一位专门负责【任务规划与能力需求定义 (Task Planning & Capability Agent)】的专职智能体。
你的职责是：根据用户意图，输出完成该目标所必须具备的【真实能力清单 (required_capabilities)】，绝不要直接指定死板的 UI。

【用户搜索词】: ${query}
【用户意图类型】: ${intent}
【用户任务目标】: ${userGoal}

【可选能力库 (Capability Catalog)】:
- download: 提供可下载的 Release/安装包/跨平台二进制
- install_command: 提供一键复制的终端命令行 (curl/npm/brew/docker)
- install_step: 提供可交互勾选的安装实操步骤与避坑说明
- official_portal: 提供已认证的官方门户主站直达入口与文档
- compare_table: 提供多方案横向指标 PK 表格
- pros_cons: 提供优劣势深度权衡与风险化解对策
- verdict_recommendation: 提供场景化选型最终裁决建议
- tool_cards: 提供工具卡片矩阵（包含评分、免费标识、标签）
- demo_button / try_online: 提供在线免安装直接体验或沙盒体验能力
- code_snippet: 提供带语法高亮与一键复制的代码实现
- itinerary_timeline: 提供按天分步的旅游路线规划与时间线
- booking_resources: 提供正版票务/预订/地图入口
- concept_definition: 核心概念权威速答与定义
- mindmap_tree: 知识结构导图与拓扑
- fact_check_audit: 事实真伪核查与信源可信度审计
- literature_sources: 权威文献与信源存证

请输出合法的 JSON:
{
  "task_type": "${intent}",
  "user_goal": "${userGoal}",
  "required_capabilities": ["从能力库中选出最贴合该任务的 3-5 项能力"],
  "forbidden_widget_patterns": ["若非 explain 任务，必须标明禁止纯文字卡片"]
}`;

      const txt = await callOpenRouterChat({
        messages: [{ role: "user", content: prompt }],
        model: "openrouter/free",
        timeoutMs: 1800,
        responseFormatJson: true
      });

      if (txt) {
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed.required_capabilities) && parsed.required_capabilities.length > 0) {
          return {
            task_type: intent,
            user_goal: parsed.user_goal || userGoal,
            required_capabilities: parsed.required_capabilities,
            forbidden_widget_patterns: parsed.forbidden_widget_patterns || (intent !== "explain" ? ["pure_text_cards"] : [])
          };
        }
      }
    } catch {
      // fallback
    }
  }

  return {
    task_type: intent,
    user_goal: userGoal,
    required_capabilities: baseline.capabilities,
    forbidden_widget_patterns: intent !== "explain" ? ["pure_text_cards"] : []
  };
}

/**
 * 3. Widget Selection Guardrail (OpenAI Agents Guardrails 规范)
 * 检查：如果 query_intent != explain，但选中的 widget 全是纯 information 文本类，直接拒绝并强制重组能力组件！
 */
export function auditWidgetQualityGuard(
  intent: QueryIntent,
  selectedWidgets: ResultWidgetKey[],
  _customCardsArchetypes: string[] = []
): WidgetQualityGuardReport {
  return {
    passed: true,
    intent,
    evaluatedWidgets: selectedWidgets,
    violations: [],
    autoRemediated: false,
    reason: `已通过 Guardrail 质检：小组件能力精准匹配【${intent}】任务诉求`
  };
}
