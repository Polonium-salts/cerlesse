import { SearchResult, WidgetIntentAnalysis } from "../src/types.js";
import { callOpenRouterChat, resolveOpenRouterApiKey } from "./openrouter.js";
import {
  CAPABILITY_PROMPT_ENUM,
  normalizeCapabilities,
  formatAgentWidgetGuidancePrompt,
  type CanonicalCapability
} from "../src/widgets/capabilityTaxonomy.js";

/**
 * 标准业务场景预置核心能力映射表 (Semantic Intent to Canonical Capability Taxonomy)
 *
 * ⚠️ 这里的取值必须来自 src/widgets/capabilityTaxonomy.ts 的 CANONICAL_CAPABILITIES，
 * 且每项都必须被 widgetPlanner 的 WIDGET_REGISTRY 中至少一个组件声明。
 * 否则意图分析结果无法命中任何组件，桌面会退化为千篇一律的锚点卡片。
 *
 * 回归护栏：scratch/guard_capability_taxonomy.mjs
 */
export const INTENT_CAPABILITIES_MAP: Record<string, CanonicalCapability[]> = {
  // 软件下载：软件档案 + 下载入口 + 版本发布 + 环境核对 + 安全审计 + 命令安装 + 官网直达
  software_download: [
    "software_info",
    "download",
    "releases",
    "version_history",
    "environment_checklist",
    "security_audit",
    "install_command",
    "official_portal"
  ],
  // 天气：实况 + 预报 + 生活指数 + 空气质量 + 穿衣建议 + 定位
  weather: [
    "weather_current",
    "weather_forecast",
    "weather_indices",
    "air_quality",
    "clothing_advice",
    "location_map"
  ],
  // 素材：预览 + 下载 + 收藏 + 标签筛选 + 作者署名 + 授权 + 分辨率规格
  resource_search: [
    "resource_preview",
    "download",
    "favorite",
    "tags_filter",
    "author_credit",
    "license_info",
    "resolution_spec"
  ],
  // 学习：路线图 + 代码片段 + 在线运行 + 课程 + 练习 + 官方文档 + 前置条件
  study_tutorial: [
    "roadmap_step",
    "code_snippet",
    "code_run",
    "recommended_courses",
    "practice_exercises",
    "verified_docs",
    "prerequisites_check"
  ],
  // 开源项目：仓库档案 + Star 趋势 + 发版产物 + 克隆 + 官网 + 版本沿革
  github_project: [
    "software_info",
    "trend_signals",
    "release_binary",
    "git_clone",
    "official_portal",
    "version_history"
  ],
  // 对比选型：参数矩阵 + 优劣 + 基准 + 裁决 + 社区口碑趋势
  tech_comparison: [
    "compare_table",
    "pros_cons",
    "benchmark_table",
    "verdict_recommendation",
    "trend_signals"
  ],
  // 故障排查：错误诊断 + 修复命令 + 核验清单 + 前置条件 + 排错审计
  troubleshooting: [
    "error_diagnosis",
    "fix_command",
    "verification_checklist",
    "prerequisites_check",
    "troubleshooting_audit"
  ],
  // 官网直达：官方站点 + 权威文档 + 快捷链接 + 服务状态 + 联系入口
  portal_navigation: [
    "official_site",
    "verified_docs",
    "quick_links",
    "service_status",
    "contact_entry"
  ],
  // 概念科普：定义 + 知识图谱 + 核心原理 + 典型场景 + 文献来源
  concept_explanation: [
    "concept_definition",
    "mindmap_tree",
    "core_principles",
    "typical_scenarios",
    "literature_sources"
  ],
  // 通用知识：要点 + 直答 + 文献 + 相关话题
  general_knowledge: [
    "summary_points",
    "direct_answer",
    "literature_sources",
    "related_topics"
  ]
};

/**
 * 启发式确定性实体与意图提取算法 (毫秒级响应兜底)
 */
export function analyzeIntentAlgorithmically(query: string, results: SearchResult[]): WidgetIntentAnalysis {
  const cleanQ = query.trim();

  // 1. 天气气象 (Weather)
  if (/(天气|气温|下雨|下雪|降水|温度|穿衣指南|几度|晴天|阴天|台风|空气质量)/i.test(cleanQ)) {
    const cityMatch = cleanQ.replace(/(天气|今天|明天|后天|这周|气温|下雨|预报|温度|穿衣指南)/gi, "").trim();
    return {
      intent: "weather",
      intents: ["weather", "query_weather", "clothing_advice"],
      entity: cityMatch || "当前城市",
      goal: "query_weather",
      needs: [...INTENT_CAPABILITIES_MAP.weather],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.weather],
      suggestedLayout: "composite_card",
      confidence: 0.92
    };
  }

  // 2. 显式竞品意图探测：查询词本身就点明了"对比 / 排障 / 定义 / 研报"时，
  //    不允许被"检索结果里恰好出现下载二字"劫持成软件下载任务。
  //    实测：query="什么是量子退火" 仅因某条结果标题含"安装文档"就被判成
  //    software_download(0.95)，并以高于阈值的置信度覆盖了另一分类器的正确判定，
  //    最终桌面挂上安装入口、事实核查与官网门户 —— 这正是"组件选不准"的源头。
  const hasExplicitComparisonIntent = /(对比|区别|选哪个|pk|vs|哪个好|好用吗|优缺点|测评)/i.test(cleanQ);
  const hasExplicitTroubleshootingIntent = /(报错|错误|失败|failed|error|bug|crash|崩溃|排查|无法启动|解决办法|code \d+)/i.test(cleanQ);
  const hasExplicitConceptIntent = /(什么是|原理|定义|介绍|概念|为什么|架构图)/i.test(cleanQ);
  const hasExplicitResearchIntent = /(研报|报告|白皮书|现状|发展趋势|市场份额|产业链|前景|调研)/i.test(cleanQ);
  const hasCompetingIntent =
    hasExplicitComparisonIntent ||
    hasExplicitTroubleshootingIntent ||
    hasExplicitConceptIntent ||
    hasExplicitResearchIntent;

  // 3. 软件与应用套件下载 (Software Download)
  // 支持显式下载词，或知名生产力软件/应用名称（如 Photoshop, Blender, VSCode, Chrome 等）
  const knownSoftwareRegex = /(photoshop|blender|vscode|visual studio|chrome|firefox|docker|postman|steam|obs|figma|notion|git|nginx|redis|wechat|qq|telegram)/i;
  /** 查询里出现了"获取软件"的动作词（下载/安装/正式版…） */
  const queryHasDownloadVerb = /(下载|安装|download|installer|release|client|客户端|电脑版|绿色版|mac版|windows版|免安装版|稳定版|正式版|exe|dmg|pkg|deb|rpm|zip)/i.test(cleanQ);
  /** 查询里出现了已知软件名 —— 但光有名字不构成"下载任务" */
  const queryNamesSoftware = knownSoftwareRegex.test(cleanQ);
  /**
   * 强证据：查询确实是在要软件。
   * 注意 "Docker 和 Podman 对比区别" 里虽有软件名，但它问的是选型对比；
   * 若把"含软件名"当作下载意图，技术对比任务就会被误判成下载任务。
   */
  const queryAsksSoftware = queryHasDownloadVerb || (queryNamesSoftware && !hasCompetingIntent);
  /** 弱证据：只有检索结果在谈下载/安装，查询本身没要软件 */
  const evidenceResults = results.filter(r =>
    /(下载|download|github\.com\/.*\/releases|install|安装)/i.test(`${r.title} ${r.snippet}`)
  ).length;
  const softwareOnlyFromEvidence = !queryAsksSoftware && evidenceResults >= 2 && !hasCompetingIntent;
  const isSoftwareContext = knownSoftwareRegex.test(cleanQ) ||
    results.some(r => /(软件|应用程序|客户端|桌面套件|图形软件|开发工具)/i.test(r.title + " " + r.snippet));

  if (queryAsksSoftware || softwareOnlyFromEvidence || (isSoftwareContext && !hasCompetingIntent && evidenceResults >= 1)) {
    const entityMatch = cleanQ
      .replace(/(下载|安装|最新版|官方|官网|客户端|电脑版|绿色版|mac版|windows版|破解版|破解|破解教程|免安装版|稳定版|正式版|installer|download|client)/gi, "")
      .trim();
    const entity = entityMatch || (results[0]?.title ? results[0].title.split(/[-_|]/)[0].trim() : "Software");
    // 置信度必须反映证据强度：
    //   查询明确要软件 -> 0.95（可覆盖另一分类器）
    //   仅凭检索结果推断，或查询本身已指向对比/排障/定义/研报 -> 0.72（低于覆盖阈值，交给两个分类器取并集）
    const strongEvidence = queryAsksSoftware && !hasCompetingIntent;
    return {
      intent: "software_download",
      intents: ["software_download", "download", "version", "compare"],
      entity,
      goal: "download",
      needs: [...INTENT_CAPABILITIES_MAP.software_download],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.software_download],
      suggestedLayout: "composite_card",
      confidence: strongEvidence ? 0.95 : 0.72
    };
  }

  // 4. GitHub / 开源项目研究 (GitHub Project)
  //    同样是证据型判定：仅有 github.com 结果不足以定性，查询本身点名才算强证据。
  const queryMentionsGithub = /(github|开源项目|开源库|repo|repository|star|git clone)/i.test(cleanQ);
  const hasGithubResult = results.some(r => /github\.com/i.test(r.url));
  if (queryMentionsGithub || (hasGithubResult && !hasCompetingIntent)) {
    const entity = cleanQ.replace(/(github|开源项目|repo|repository|star|git clone|开源库|下载|官网)/gi, "").trim();
    return {
      intent: "github_project",
      intents: ["github_project", "code", "download", "research"],
      entity: entity || cleanQ,
      goal: "explore_repo",
      needs: [...INTENT_CAPABILITIES_MAP.github_project],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.github_project],
      suggestedLayout: "composite_card",
      confidence: queryMentionsGithub ? 0.93 : 0.7
    };
  }

  // 4. 资源素材搜索 (Resource Search)
  if (/(素材|视频素材|音频|壁纸|icon|图标|免版税|模型|3d模型|字体|模版|模板)/i.test(cleanQ)) {
    const entity = cleanQ.replace(/(素材|搜索|高清|无水印|免费|商用|下载)/gi, "").trim();
    return {
      intent: "resource_search",
      intents: ["resource_search", "preview", "download", "favorite"],
      entity: entity || cleanQ,
      goal: "find_resource",
      needs: [...INTENT_CAPABILITIES_MAP.resource_search],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.resource_search],
      suggestedLayout: "composite_card",
      confidence: 0.92
    };
  }

  // 5. 教程与学习 (Study Tutorial)
  if (/(学习|教程|入门|指南|零基础|怎么学|怎么用|从入门到精通|速成|实战)/i.test(cleanQ)) {
    const entity = cleanQ.replace(/(学习|教程|入门|指南|零基础|怎么学|怎么用|从入门到精通|速成|实战)/gi, "").trim();
    return {
      intent: "study_tutorial",
      intents: ["study_tutorial", "learn", "code_run", "progress"],
      entity: entity || cleanQ,
      goal: "study",
      needs: [...INTENT_CAPABILITIES_MAP.study_tutorial],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.study_tutorial],
      suggestedLayout: "composite_card",
      confidence: 0.9
    };
  }

  // 6. 技术对比与选型 (Tech Comparison)
  if (/(对比|区别|选哪个|pk|vs|哪个好|好用吗|优缺点|测评)/i.test(cleanQ)) {
    return {
      intent: "tech_comparison",
      intents: ["tech_comparison", "compare", "benchmark", "verdict"],
      entity: cleanQ,
      goal: "compare",
      needs: [...INTENT_CAPABILITIES_MAP.tech_comparison],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.tech_comparison],
      suggestedLayout: "composite_card",
      confidence: 0.9
    };
  }

  // 7. 故障排查与报错 (Troubleshooting)
  if (/(报错|错误|失败|failed|error|bug|crash|崩溃|排查|无法启动|解决办法|code \d+)/i.test(cleanQ)) {
    return {
      intent: "troubleshooting",
      intents: ["troubleshooting", "diagnose", "fix", "verify"],
      entity: cleanQ,
      goal: "troubleshoot",
      needs: [...INTENT_CAPABILITIES_MAP.troubleshooting],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.troubleshooting],
      suggestedLayout: "composite_card",
      confidence: 0.89
    };
  }

  // 8. 官网直达与门户 (Portal Navigation)
  //    ⚠️ 关键修正：绝大多数检索都会返回官方域名，若把"结果里含官方站点"
  //    当作 portal_navigation 的定性证据（旧实现置信度 0.85 > 覆盖阈值 0.8），
  //    "什么是量子退火""产业链发展趋势研报"这类任务都会被改判成"官网寻址"，
  //    桌面随即被官方门户占据、导图与研报组件全部退场。
  //    只有查询本身在找官网/入口时才给出高置信度；纯证据推断降为 0.7（不覆盖另一分类器）。
  const queryAsksPortal = /(官网|官方网站|入口|网址|首页|portal|official)/i.test(cleanQ);
  const hasOfficialResult = results.some(r => r.isOfficial);
  if (queryAsksPortal || (hasOfficialResult && !hasCompetingIntent)) {
    const entity = cleanQ.replace(/(官网|官方网站|入口|网址|首页)/gi, "").trim();
    return {
      intent: "portal_navigation",
      intents: ["portal_navigation", "navigate", "docs"],
      entity: entity || cleanQ,
      goal: "navigate",
      needs: [...INTENT_CAPABILITIES_MAP.portal_navigation],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.portal_navigation],
      suggestedLayout: "composite_card",
      confidence: queryAsksPortal ? 0.85 : 0.7
    };
  }

  // 9. 概念与原理科普 (Concept Explanation)
  if (/(什么是|原理|定义|介绍|概念|为什么|架构图)/i.test(cleanQ)) {
    const entity = cleanQ.replace(/(什么是|原理|定义|介绍|概念|为什么)/gi, "").trim();
    return {
      intent: "concept_explanation",
      intents: ["concept_explanation", "understand", "mindmap"],
      entity: entity || cleanQ,
      goal: "understand",
      needs: [...INTENT_CAPABILITIES_MAP.concept_explanation],
      requiredCapabilities: [...INTENT_CAPABILITIES_MAP.concept_explanation],
      suggestedLayout: "composite_card",
      confidence: 0.85
    };
  }

  // 默认通用知识综合
  return {
    intent: "general_knowledge",
    intents: ["general_knowledge", "summary", "sources"],
    entity: cleanQ,
    goal: "understand",
    needs: [...INTENT_CAPABILITIES_MAP.general_knowledge],
    requiredCapabilities: [...INTENT_CAPABILITIES_MAP.general_knowledge],
    suggestedLayout: "composite_card",
    confidence: 0.75
  };
}

/**
 * 专属组件意图分析 Agent (Widget Intent Analyzer)
 * 深度解析搜索需求，输出语义级意图模型与所需原子能力清单
 */
export async function analyzeWidgetIntent(options: {
  query: string;
  results?: SearchResult[];
  targetLanguage?: string;
  env?: Record<string, string | undefined>;
}): Promise<WidgetIntentAnalysis> {
  const { query, results = [] } = options;
  const algorithmicResult = analyzeIntentAlgorithmically(query, results);

  // 快速尝试 OpenRouter Free AI 语义增强（带快速超时，毫秒级降级兜底）
  const openRouterKey = resolveOpenRouterApiKey(undefined, options.env);
  if (!openRouterKey || openRouterKey.trim() === "") {
    return algorithmicResult;
  }

  try {
    const systemPrompt = `你是一个精准的桌面小组件意图分析专家 (Widget Intent Analyzer)。
根据用户的搜索词和初步检索摘要，分析用户的终极需求类型、核心实体目标以及完成该任务需要的功能组件能力与最佳小组件组合。

${formatAgentWidgetGuidancePrompt()}

【可选 intent 类型】：
- "software_download": 软件/工具/游戏下载、安装包、客户端 (例如: "下载 Photoshop", "VSCode安装", "Blender最新版")
- "resource_search": 资源、音视频素材、字体、壁纸、模板搜索 (例如: "B站剪辑素材", "科技PPT模板")
- "study_tutorial": 学习、编程入门、教程、速成指南 (例如: "学习 Python", "Docker入门教程")
- "github_project": GitHub 开源项目、代码仓库 (例如: "GitHub热门项目", "vue源码仓库")
- "weather": 城市天气、气象、温湿度、降水 (例如: "上海天气", "北京周末会下雨吗")
- "tech_comparison": 技术对比、选型、优缺点比较 (例如: "Vue vs React", "选哪款降噪耳机")
- "troubleshooting": 报错诊断、Bug修复、异常排查 (例如: "npm install报错EACCES", "蓝屏代码")
- "portal_navigation": 官网直达、官方入口 (例如: "少数派官网", "Github地址")
- "concept_explanation": 概念定义、原理解析 (例如: "什么是量子退火")
- "general_knowledge": 常规通用知识

【必须输出严格 JSON，字段如下】：
{
  "intent": string,
  "intents": string[] (多目标意图，如 ["download", "version", "compare"]),
  "entity": string (核心主体名，如 "Photoshop", "Blender", "VSCode", "上海", "Python"),
  "goal": string (用户终极目标，如 "download", "query_weather", "study", "compare"),
  "needs": string[] (用户所需原子需求，取值同上，最多 4 项),
  "requiredCapabilities": string[] (结合组件标签库与实用性选型准则，挑选 4~6 项最实用、契合度最高的能力),
  "suggestedLayout": "composite_card" | "tile_cluster" | "single",
  "confidence": number (0.0 - 1.0)
}

【requiredCapabilities 只能取以下枚举值，禁止发明新词、禁止改写拼写】：
${CAPABILITY_PROMPT_ENUM}`;

    const searchContext = results.slice(0, 4).map((r, i) => `[${i+1}] ${r.title}: ${r.snippet}`).join("\n");
    const userPrompt = `用户搜索查询：${query}\n部分检索参考：\n${searchContext}\n请分析用户意图并输出标准 JSON。`;

    const aiTask = callOpenRouterChat({
      apiKey: openRouterKey,
      model: "openrouter/free",
      temperature: 0.1,
      timeoutMs: 1800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1900));
    const aiResponse = await Promise.race([aiTask, timeoutPromise]);

    if (aiResponse) {
      const parsed = JSON.parse(aiResponse);
      if (parsed.intent && parsed.entity) {
        // LLM 自由发挥的能力名一律先归一化为规范 ID，无法识别的丢弃并回落确定性结果。
        const llmCaps = normalizeCapabilities(
          Array.isArray(parsed.requiredCapabilities) ? parsed.requiredCapabilities.map(String) : []
        );
        if (llmCaps.unmapped.length > 0) {
          console.warn(
            `[WidgetIntentAnalyzer] LLM 输出了 ${llmCaps.unmapped.length} 个未登记能力，已丢弃: ${llmCaps.unmapped.join(", ")}`
          );
        }

        const llmNeeds = normalizeCapabilities(
          Array.isArray(parsed.needs) ? parsed.needs.map(String) : []
        );

        return {
          intent: String(parsed.intent),
          intents: Array.isArray(parsed.intents) ? parsed.intents.map(String) : algorithmicResult.intents,
          entity: String(parsed.entity),
          goal: String(parsed.goal || algorithmicResult.goal),
          needs: llmNeeds.canonical.length > 0 ? llmNeeds.canonical : algorithmicResult.needs,
          requiredCapabilities:
            llmCaps.canonical.length > 0
              ? llmCaps.canonical
              : algorithmicResult.requiredCapabilities,
          suggestedLayout: parsed.suggestedLayout || algorithmicResult.suggestedLayout,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.95
        };
      }
    }
  } catch {
    // 忽略 AI 错误，直接采用确定性算法兜底
  }

  return algorithmicResult;
}
