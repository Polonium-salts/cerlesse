import {
  QueryIntent,
  TaskCapabilityRequirements,
  SearchResult,
  ResultWidgetKey,
  WidgetQualityGuardReport
} from "../src/types.js";
import { callOpenRouterChat, resolveOpenRouterApiKey } from "./openrouter.js";
import type { CanonicalCapability } from "../src/widgets/capabilityTaxonomy.js";
import { getRouteForIntent, normalizeIntent, INTENT_ROUTING_TABLE } from "./agentRouter.js";

/**
 * 确定性 Intent -> Widget 映射基准表 (从 Agent Router 中直接派生)
 */
export const INTENT_WIDGET_MAP: Record<QueryIntent, {
  capabilities: CanonicalCapability[];
  recommendedWidgets: ResultWidgetKey[];
  forbiddenCategories?: string[];
}> = {
  weather: {
    capabilities: INTENT_ROUTING_TABLE.weather.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.weather.mandatoryWidgets
  },
  translation: {
    capabilities: INTENT_ROUTING_TABLE.translation.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.translation.mandatoryWidgets
  },
  troubleshooting: {
    capabilities: INTENT_ROUTING_TABLE.troubleshooting.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.troubleshooting.mandatoryWidgets
  },
  software_download: {
    capabilities: INTENT_ROUTING_TABLE.software_download.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.software_download.mandatoryWidgets
  },
  install: {
    capabilities: INTENT_ROUTING_TABLE.software_download.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.software_download.mandatoryWidgets
  },
  tech_comparison: {
    capabilities: INTENT_ROUTING_TABLE.tech_comparison.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.tech_comparison.mandatoryWidgets
  },
  compare: {
    capabilities: INTENT_ROUTING_TABLE.tech_comparison.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.tech_comparison.mandatoryWidgets
  },
  resource_search: {
    capabilities: INTENT_ROUTING_TABLE.resource_search.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.resource_search.mandatoryWidgets
  },
  study_tutorial: {
    capabilities: INTENT_ROUTING_TABLE.study_tutorial.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.study_tutorial.mandatoryWidgets
  },
  tutorial: {
    capabilities: INTENT_ROUTING_TABLE.study_tutorial.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.study_tutorial.mandatoryWidgets
  },
  travel: {
    capabilities: INTENT_ROUTING_TABLE.travel.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.travel.mandatoryWidgets
  },
  portal_navigation: {
    capabilities: INTENT_ROUTING_TABLE.portal_navigation.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.portal_navigation.mandatoryWidgets
  },
  search_engine_portal: {
    capabilities: INTENT_ROUTING_TABLE.search_engine_portal.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.search_engine_portal.mandatoryWidgets
  },
  github_project: {
    capabilities: INTENT_ROUTING_TABLE.github_project.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.github_project.mandatoryWidgets
  },
  concept_explanation: {
    capabilities: INTENT_ROUTING_TABLE.concept_explanation.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.concept_explanation.mandatoryWidgets
  },
  explain: {
    capabilities: INTENT_ROUTING_TABLE.concept_explanation.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.concept_explanation.mandatoryWidgets
  },
  general_knowledge: {
    capabilities: INTENT_ROUTING_TABLE.general_knowledge.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.general_knowledge.mandatoryWidgets
  },
  research: {
    capabilities: INTENT_ROUTING_TABLE.research.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.research.mandatoryWidgets
  },
  tool_discovery: {
    capabilities: INTENT_ROUTING_TABLE.tool_discovery.defaultCapabilities as CanonicalCapability[],
    recommendedWidgets: INTENT_ROUTING_TABLE.tool_discovery.mandatoryWidgets
  }
};

/**
 * 1. Intent Classification Agent (意图分类智能体)
 * 统一收敛至标准 AgentIntent
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
1. weather: 城市天气/气象/气温预报/出行指数 (如 "北京天气", "东京下周下雨吗")
2. translation: 跨语言翻译/查词/发音/例句 (如 "苹果英语怎么说", "日译中", "translate hello")
3. troubleshooting: 报错排查/异常修复/避坑指南 (如 "npm ERR! code ERESOLVE", "Docker 启动报错 permission denied")
4. software_download: 软件安装/部署环境/下载客户端 (如 "Docker 怎么安装", "下载 Python 3.12", "brew install nginx")
5. tech_comparison: 选型对比/优劣分析/方案 PK (如 "Docker 和 Podman 区别", "React vs Vue 3 性能对比")
6. resource_search: 图片素材/壁纸/视觉参考/照片 (如 "东京夜景高清壁纸", "剪辑素材")
7. study_tutorial: 代码编写/实操教程/开发实战 (如 "怎么写 Promise.all", "Nginx 反向代理配置教程")
8. travel: 旅游攻略/行程路线/景点打卡 (如 "日本 7 日游攻略", "成都必去景点")
9. portal_navigation: 官网直达/官方入口 (如 "少数派官网", "GitHub 登录入口")
10. search_engine_portal: 搜索引擎跳转 (如 "百度一下", "Google search")
11. tool_discovery: 在线工具发现/在线转换 (如 "免费图片压缩工具", "PDF 转换器")
12. concept_explanation: 概念科普/原理剖析 (如 "什么是量子计算", "区块链原理")
13. research: 深度行业研报/产业链分析 (如 "人形机器人产业链深度研报")
14. general_knowledge: 通用知识搜索

【用户搜索词】: ${query}

请输出合法 JSON:
{
  "intent": "weather | translation | troubleshooting | software_download | tech_comparison | resource_search | study_tutorial | travel | portal_navigation | search_engine_portal | tool_discovery | concept_explanation | research | general_knowledge",
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
        if (parsed.intent) {
          const canonical = normalizeIntent(parsed.intent);
          return {
            intent: canonical,
            userGoal: parsed.userGoal || `用户希望完成 ${canonical} 相关任务`,
            confidence: parsed.confidence || 0.95
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
  // 1. 翻译
  if (/(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|日译中|用英语|用英文|的英语|的英文|怎么读|音标|查词)/i.test(q)) {
    return {
      intent: "translation",
      userGoal: `进行多语言翻译与查词释义 (${q})`,
      confidence: 0.96
    };
  }

  // 2. 天气
  if (/(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(q)) {
    return {
      intent: "weather",
      userGoal: `查询城市天气气象与出行穿衣指数 (${q})`,
      confidence: 0.95
    };
  }

  // 3. 报错排查
  if (/报错|失败|error|exception|bug|解决|修复|无法启动|crash|failed|warning|排查|解决办法|code \d+/i.test(q)) {
    return {
      intent: "troubleshooting",
      userGoal: `诊断并排查系统报错或异常故障 (${q})`,
      confidence: 0.94
    };
  }

  // 4. 对比选型
  if (/区别|对比|哪个好|vs|versus|选型|优缺点|差异|比较|谁更好|选哪个|pk/i.test(q)) {
    return {
      intent: "tech_comparison",
      userGoal: `对比多个方案的核心差异与优缺点并做出选型决策`,
      confidence: 0.94
    };
  }

  // 5. 软件下载与安装
  if (/安装|下载|配置环境|部署|install|download|setup|docker run|brew install|pip install|npm i|yum install|apt-get/i.test(q)) {
    return {
      intent: "software_download",
      userGoal: `下载并安装部署目标环境或软件 (${q})`,
      confidence: 0.93
    };
  }

  // 6. 旅游攻略
  if (/旅游|攻略|景点|行程|门票|酒店|美食|自驾|住宿|怎么玩|几日游|带孩子|路线/i.test(q)) {
    return {
      intent: "travel",
      userGoal: `规划旅行行程路线、景点打卡与出行攻略`,
      confidence: 0.93
    };
  }

  // 7. 图片/素材资源
  if (/图片|照片|图集|图库|壁纸|素材|外观图|长什么样|photo|image|picture|gallery|wallpaper/i.test(q)) {
    return {
      intent: "resource_search",
      userGoal: `检索相关图片、视觉素材与高清图集 (${q})`,
      confidence: 0.92
    };
  }

  // 8. 搜索引擎直达
  if (/(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(q)) {
    return {
      intent: "search_engine_portal",
      userGoal: `快速直达主流搜索引擎检索 (${q})`,
      confidence: 0.92
    };
  }

  // 9. 工具发现
  if (/工具|在线工具|在线|免费|推荐|好用|generator|converter|tool|app|utility|在线压缩|在线转换/i.test(q)) {
    return {
      intent: "tool_discovery",
      userGoal: `发现并筛选可用的在线工具、软件或服务`,
      confidence: 0.9
    };
  }

  // 10. 教程
  if (/教程|怎么写|实现|实战|步骤|代码|如何编写|入门|进阶|示例|example|tutorial|how to/i.test(q)) {
    return {
      intent: "study_tutorial",
      userGoal: `学习代码实现步骤与技术教程`,
      confidence: 0.9
    };
  }

  // 11. 研报
  if (/研报|产业链|行业报告|现状与未来|前沿趋势|综述|白皮书|market share/i.test(q)) {
    return {
      intent: "research",
      userGoal: `深入研究产业格局、发展脉络与前沿研报`,
      confidence: 0.89
    };
  }

  // 12. 概念解释
  if (/(什么是|原理|定义|介绍|概念|为什么|架构图)/i.test(q)) {
    return {
      intent: "concept_explanation",
      userGoal: `理解概念定义与核心原理解析`,
      confidence: 0.88
    };
  }

  // 默认通用知识
  return {
    intent: "general_knowledge",
    userGoal: `获取针对 "${q}" 的全网综合知识解答`,
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
  const canonical = normalizeIntent(intent);
  const route = getRouteForIntent(canonical);
  const baseline = INTENT_WIDGET_MAP[canonical] || INTENT_WIDGET_MAP.general_knowledge;

  return {
    task_type: canonical,
    user_goal: userGoal,
    required_capabilities: route.defaultCapabilities || baseline.capabilities,
    forbidden_widget_patterns: route.forbiddenWidgets
  };
}

/**
 * 3. Widget Selection Guardrail
 */
export function auditWidgetQualityGuard(
  intent: QueryIntent,
  selectedWidgets: ResultWidgetKey[],
  _customCardsArchetypes: string[] = []
): WidgetQualityGuardReport {
  const canonical = normalizeIntent(intent);
  const route = getRouteForIntent(canonical);
  const violations: string[] = [];

  for (const w of selectedWidgets) {
    if (route.forbiddenWidgets.includes(w)) {
      violations.push(`组件 [${w}] 在意图 [${canonical}] 下属于禁用组件`);
    }
  }

  return {
    passed: violations.length === 0,
    intent: canonical,
    evaluatedWidgets: selectedWidgets,
    violations,
    autoRemediated: false,
    reason: violations.length === 0
      ? `已通过 Guardrail 质检：小组件能力精准匹配【${canonical}】任务诉求`
      : `存在 ${violations.length} 项违规组件`
  };
}
