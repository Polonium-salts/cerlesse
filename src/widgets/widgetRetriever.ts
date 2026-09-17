import { create, insert, search, type AnyOrama } from "@orama/orama";
import type { ResultWidgetKey, TileWidth } from "../types.js";
import type { CandidateWidget, ContentSignalsPayload } from "./widgetContract.js";

/**
 * 完整规范的小组件画像定义
 */
export interface WidgetCatalogItem {
  id: ResultWidgetKey;
  name: string;
  description: string;
  category: "synthesis" | "action" | "portal" | "analysis" | "custom";
  capabilities: string[];
  intents: string[];
  keywords: string[];
  examples: string[];
  negativeIntents?: string[];
  requiredData?: Array<"takeaways" | "images" | "sources" | "multiple_entities" | "code_snippet" | "install_command" | "custom_cards">;
  defaultSpan: TileWidth;
  minConfidence: number;
  basePriority: number;
  flexible?: boolean;
}

/**
 * 全局统一组件目录 (Widget Catalog - Single Source of Truth)
 */
export const WIDGET_CATALOG: Record<ResultWidgetKey, WidgetCatalogItem> = {
  ai_answer: {
    id: "ai_answer",
    name: "AI 智能回答",
    description: "基于全网检索多路信源深度综合与推理，输出格式化回答、核心决策结论与智能拓展",
    category: "synthesis",
    capabilities: [
      "direct_answer",
      "definition_snippet",
      "instant_verdict",
      "overview_synthesis",
      "summary_points",
      "bullet_conclusions",
      "high_density_takeaways"
    ],
    intents: ["explain", "research", "general_knowledge", "study_tutorial", "concept_explanation", "tech_comparison"],
    keywords: ["是什么", "为什么", "如何", "总结", "分析", "原理", "介绍", "概况", "解释", "含义", "核心要点"],
    examples: ["什么是量子退火算法", "光伏发电原理与应用", "React 和 Vue 核心理念解析"],
    defaultSpan: 50,
    minConfidence: 0.5,
    basePriority: 90,
    flexible: true
  },
  related_links: {
    id: "related_links",
    name: "官网跳转 / 权威入口",
    description: "智能提取检索结果中的权威官方网站、产品主页与官方文档，提供安全卡片式快速跳转通道与站点说明",
    category: "portal",
    capabilities: [
      "official_site",
      "official_url",
      "verified_docs",
      "authoritative_entry",
      "official_portal",
      "quick_links"
    ],
    intents: ["software_download", "portal_navigation", "tool_discovery", "official_portal", "install"],
    keywords: ["官网", "官方网站", "入口", "登录", "下载", "主页", "文档", "平台", "网址", "official", "portal"],
    examples: ["Node.js 官方网站", "Docker 官方文档入口", "GitHub 登录直达"],
    defaultSpan: 50,
    minConfidence: 0.6,
    basePriority: 85,
    flexible: true
  },
  takeaways: {
    id: "takeaways",
    name: "核心要点 / 结论速览",
    description: "高密度提炼研报结论，提炼关键数据、核心差异与核心洞察",
    category: "synthesis",
    capabilities: ["bullet_conclusions", "high_density_takeaways", "summary_points"],
    intents: ["explain", "research", "compare", "tech_comparison", "study_tutorial", "general_knowledge"],
    keywords: ["要点", "核心", "结论", "速览", "总结", "提炼", "洞察", "摘录", "干货", "takeaways"],
    examples: ["量子计算核心突破要点", "2024 AI 趋势关键结论", "Rust 语言核心优势"],
    requiredData: ["takeaways"],
    defaultSpan: 25,
    minConfidence: 0.6,
    basePriority: 84,
    flexible: true
  },
  image_gallery: {
    id: "image_gallery",
    name: "相关图片 / 视觉图集",
    description: "全网检索图片素材与缩略图墙，支持点击大图预览、实物外观对照与图源溯源",
    category: "synthesis",
    capabilities: ["image_gallery", "resource_preview", "resource_search"],
    intents: ["resource_search", "travel", "general_knowledge", "software_download", "study_tutorial", "tech_comparison", "troubleshooting", "portal_navigation", "concept_explanation"],
    keywords: ["图片", "壁纸", "图库", "照片", "高清图", "截图", "外观", "长什么样", "图集", "image", "photo", "wallpaper", "gallery"],
    examples: ["东京风景高清壁纸", "金毛犬照片", "iPhone 16 外观实拍图"],
    negativeIntents: [],
    requiredData: [],
    defaultSpan: 75,
    minConfidence: 0.5,
    basePriority: 80,
    flexible: false
  },
  search_engine: {
    id: "search_engine",
    name: "搜索引擎直达",
    description: "提供主流搜索引擎（Google、Bing、百度等）快速搜索栏与一键跳转",
    category: "action",
    capabilities: ["search_engine_redirect", "external_search_query", "web_search_portal", "engine_launcher", "quick_links"],
    intents: ["tool_discovery", "search_engine_portal", "portal_navigation"],
    keywords: ["google", "bing", "baidu", "百度", "必应", "谷歌", "搜索引擎", "搜狗", "sogou", "duckduckgo", "360", "search", "engine", "搜一下", "全网搜"],
    examples: ["百度一下 人工智能", "Google search deep learning", "必应检索 最新论文"],
    negativeIntents: ["weather", "translation"],
    defaultSpan: 50,
    minConfidence: 0.8,
    basePriority: 92,
    flexible: true
  },
  translation: {
    id: "translation",
    name: "多语言翻译",
    description: "即时文本与词汇翻译、双语词典释义、发音与例句对照",
    category: "action",
    capabilities: ["language_translation", "text_translation", "bilingual_comparison", "pronunciation_guide", "dictionary_lookup"],
    intents: ["translation"],
    keywords: ["翻译", "英文", "英语", "日语", "韩语", "德语", "法语", "西语", "俄语", "translate", "translation", "怎么说", "什么意思", "英译中", "中译英", "双语", "查词", "音标"],
    examples: ["苹果用英语怎么说", "Serendipity 什么意思", "日译中 樱花盛开"],
    negativeIntents: ["weather", "software_download", "install"],
    defaultSpan: 50,
    minConfidence: 0.75,
    basePriority: 96,
    flexible: true
  },
  weather: {
    id: "weather",
    name: "实时天气与出行指南",
    description: "目标城市实时气温、天气状况、未来预报、空气质量与穿衣出行建议",
    category: "action",
    capabilities: ["weather_current", "weather_forecast", "weather_indices", "air_quality", "clothing_advice"],
    intents: ["weather", "travel"],
    keywords: ["天气", "气象", "气温", "下雨", "下雪", "降水", "温度", "穿衣指南", "预报", "雷阵雨", "多云", "晴天", "阴天", "weather", "forecast", "temperature", "rain", "climate", "台风", "空气质量"],
    examples: ["北京今天天气怎么样", "上海周末下雨吗", "东京未来三天天气预报"],
    negativeIntents: ["translation", "troubleshooting", "software_download", "code_tutorial"],
    defaultSpan: 75,
    minConfidence: 0.75,
    basePriority: 95,
    flexible: true
  },
  token_usage: {
    id: "token_usage",
    name: "Token 消耗与性能监控",
    description: "展示本次搜索与 AI 研报生成的 Prompt、Output 及总 Token 消耗与吞吐效率",
    category: "analysis",
    capabilities: ["token_metrics", "cost_analysis", "latency_telemetry", "throughput_stats", "model_monitoring"],
    intents: ["research", "system_monitor"],
    keywords: ["token", "代币", "耗费", "模型耗时", "成本", "吞吐", "cost", "throughput", "token_usage", "开销"],
    examples: ["模型 token 消耗统计", "这次生成花了多少 token"],
    negativeIntents: ["weather", "travel", "translation"],
    defaultSpan: 25,
    minConfidence: 0.6,
    basePriority: 70,
    flexible: true
  },
  comparison: {
    id: "comparison",
    name: "多维对比评测矩阵",
    description: "展示两个或多个技术方案、产品或方案的横向参数对比矩阵、优缺点评测与选型裁决",
    category: "analysis",
    capabilities: ["compare_table", "feature_matrix", "cross_compare", "dimension_pk", "spec_comparison", "benchmark_table"],
    intents: ["comparison", "compare", "tech_comparison", "research"],
    keywords: ["区别", "对比", "比较", "优缺点", "哪个好", "vs", "pk", "二选一", "选型", "评测", "差异", "优劣"],
    examples: ["Docker 和 Podman 区别", "React 和 Vue 对比", "Photoshop 和 Affinity Photo 区别", "MacBook Pro 和 Air 选哪个"],
    negativeIntents: ["weather", "translation"],
    requiredData: ["multiple_entities"],
    defaultSpan: 100,
    minConfidence: 0.7,
    basePriority: 88,
    flexible: true
  },
  verification_checklist: {
    id: "verification_checklist",
    name: "故障排查与核验清单",
    description: "前置依赖检查、故障排查诊断、实操避坑与交互式核验步骤",
    category: "action",
    capabilities: [
      "troubleshooting_audit",
      "fact_check",
      "prerequisites_check",
      "security_audit",
      "environment_checklist",
      "error_diagnosis",
      "verification_checklist",
      "checklist",
      "install_step"
    ],
    intents: ["troubleshooting", "install", "software_download"],
    keywords: ["报错", "解决", "异常", "排查", "修复", "失败", "error", "failed", "bug", "crash", "清单", "checklist", "核验", "避坑"],
    examples: ["npm ERESOLVE 怎么解决", "Docker 启动报错 failed to start daemon", "Python 依赖冲突排查"],
    negativeIntents: ["weather", "travel", "translation"],
    defaultSpan: 75,
    minConfidence: 0.7,
    basePriority: 86,
    flexible: true
  },
  troubleshooting: {
    id: "troubleshooting",
    name: "故障排查与修复流程",
    description: "全流程错误现象分析、根因诊断、分步修复指令、交互式验证与避坑指南",
    category: "action",
    capabilities: [
      "error_diagnosis",
      "fix_command",
      "troubleshooting_audit",
      "verification_checklist",
      "prerequisites_check",
      "cli_execution",
      "copy_text",
      "quick_action"
    ],
    intents: ["troubleshooting", "debug", "error_fix"],
    keywords: ["报错", "错误", "修复", "排错", "诊断", "异常", "故障", "崩溃", "无法启动", "解决办法", "error", "failed", "bug", "crash", "troubleshooting", "exception"],
    examples: ["npm ERR! code ERESOLVE 无法安装", "Docker 启动报错 permission denied", "502 Bad Gateway 解决流程", "CORS 跨域排查"],
    negativeIntents: ["weather", "travel", "translation"],
    defaultSpan: 75,
    minConfidence: 0.65,
    basePriority: 94,
    flexible: true
  },
  actions_toolbox: {
    id: "actions_toolbox",
    name: "行动工具箱 / 快捷指令",
    description: "提供一键运行 CLI、安装命令复制、实战代码片段与快捷链接",
    category: "action",
    capabilities: ["install_command", "copy_text", "quick_action", "cli_execution", "quick_links", "code_snippet", "fix_command"],
    intents: ["install", "troubleshooting", "study_tutorial", "github_project"],
    keywords: ["命令", "运行", "代码", "cli", "脚本", "command", "安装命令", "终端", "bash", "npm install", "pip install"],
    examples: ["Homebrew 安装命令", "Git 克隆加速指令", "Docker 一键启动脚本"],
    negativeIntents: ["weather", "translation"],
    defaultSpan: 50,
    minConfidence: 0.65,
    basePriority: 85,
    flexible: true
  },
  mindmap: {
    id: "mindmap",
    name: "知识架构导图 / 认知拓扑",
    description: "交互式层级知识树、系统拓扑、核心原理解析与技术进阶路线",
    category: "analysis",
    capabilities: [
      "knowledge_topology",
      "architecture_tree",
      "subsystem_mapping",
      "mindmap_tree",
      "concept_definition",
      "core_principles",
      "roadmap_step"
    ],
    intents: ["explain", "concept_explanation", "study_tutorial", "research"],
    keywords: ["架构", "拓扑", "路线图", "体系", "脑图", "思维导图", "知识树", "结构", "mindmap", "全景", "原理", "底层逻辑"],
    examples: ["什么是量子计算", "分布式系统知识架构", "Kubernetes 核心架构导图"],
    negativeIntents: ["weather", "translation"],
    defaultSpan: 75,
    minConfidence: 0.65,
    basePriority: 82,
    flexible: true
  },
  sources: {
    id: "sources",
    name: "权威信源存证",
    description: "全网信源引文出处、发布时间、权重与存证追溯",
    category: "portal",
    capabilities: ["evidence_chain", "citation_retrieval", "literature_archive", "literature_sources"],
    intents: ["research", "explain", "comparison", "general_knowledge", "fact_check"],
    keywords: ["信源", "出处", "引用", "文献", "证据", "参考", "论文", "溯源", "sources", "citations"],
    examples: ["学术论文引文出处", "新规出台官方文件溯源"],
    requiredData: ["sources"],
    defaultSpan: 50,
    minConfidence: 0.5,
    basePriority: 72,
    flexible: true
  },
  custom_cards: {
    id: "custom_cards",
    name: "专属场景定制套件",
    description: "由 Widget Composer 锻造的场景专属业务卡片套件（软件下载枢纽、学习路线图、素材预览等）",
    category: "custom",
    capabilities: [
      "software_info",
      "download",
      "releases",
      "roadmap_step",
      "resource_preview",
      "itinerary_timeline",
      "travel_budget",
      "pros_cons",
      "parameter_matrix"
    ],
    intents: ["software_download", "study_tutorial", "resource_search", "travel", "github_project"],
    keywords: ["下载", "学习路线", "教程", "素材", "攻略", "旅游", "预算", "开源项目", "github"],
    examples: ["VS Code 下载与安装", "TypeScript 学习指南", "东京 3 天旅游攻略"],
    defaultSpan: 75,
    minConfidence: 0.7,
    basePriority: 94,
    flexible: true
  }
};

/**
 * 所有已登记的标准 Widget Key 列表
 */
export const ALL_CATALOG_WIDGET_KEYS: ResultWidgetKey[] = Object.keys(WIDGET_CATALOG) as ResultWidgetKey[];

/**
 * 专为中英文混合设计的 CJK + Latin 字符分词器
 */
export const cjkTokenizer = {
  language: "custom",
  normalizationCache: new Map<string, string[]>(),
  tokenize(raw: string): string[] {
    if (!raw || typeof raw !== "string") return [];
    const tokens: string[] = [];
    const clean = raw.toLowerCase();

    // 1. 提取英文/数字词
    const latinWords = clean.match(/[a-z0-9_]+/g);
    if (latinWords) {
      tokens.push(...latinWords);
    }

    // 2. 提取 CJK 单字与 2-gram 双字元
    const cjkChars = clean.match(/[\u4e00-\u9fa5]/g);
    if (cjkChars) {
      tokens.push(...cjkChars);
      for (let i = 0; i < cjkChars.length - 1; i++) {
        tokens.push(cjkChars[i] + cjkChars[i + 1]);
      }
    }

    return tokens;
  }
};

let oramaDbInstance: AnyOrama | null = null;

/**
 * 获取或创建 Orama 小组件检索索引
 */
export async function getOramaWidgetDb(): Promise<AnyOrama> {
  if (oramaDbInstance) return oramaDbInstance;

  const db = await create({
    schema: {
      id: "string",
      name: "string",
      description: "string",
      keywords: "string[]",
      intents: "string[]",
      capabilities: "string[]",
      examples: "string[]"
    },
    components: {
      tokenizer: cjkTokenizer
    }
  });

  for (const item of Object.values(WIDGET_CATALOG)) {
    await insert(db, {
      id: item.id,
      name: item.name,
      description: item.description,
      keywords: item.keywords,
      intents: item.intents,
      capabilities: item.capabilities,
      examples: item.examples
    });
  }

  oramaDbInstance = db;
  return db;
}

export interface RetrieveWidgetsOptions {
  intent?: string;
  capabilities?: string[];
  signals?: ContentSignalsPayload;
  limit?: number;
}

/**
 * 验证组件所需数据是否就绪
 */
function checkDataReadiness(item: WidgetCatalogItem, signals?: ContentSignalsPayload): { ready: boolean; score: number } {
  if (!signals || !item.requiredData || item.requiredData.length === 0) {
    return { ready: true, score: 1.0 };
  }

  let met = 0;
  for (const req of item.requiredData) {
    switch (req) {
      case "takeaways":
        if ((signals.takeawayCount ?? 0) > 0) met++;
        break;
      case "images":
        if ((signals.imageCount ?? 0) > 0 || signals.imageIntent === true) met++;
        break;
      case "sources":
        if ((signals.sourceCount ?? 0) > 0) met++;
        break;
      case "multiple_entities":
        if (signals.hasMultipleEntities === true || (signals.comparisonRows ?? 0) > 0) met++;
        break;
      case "code_snippet":
        if (signals.hasCodeSnippet === true) met++;
        break;
      case "install_command":
        if (signals.hasInstallCommand === true) met++;
        break;
      case "custom_cards":
        if ((signals.customCardCount ?? 0) > 0) met++;
        break;
    }
  }

  const ready = met === item.requiredData.length;
  const score = ready ? 1.0 : met / item.requiredData.length;
  return { ready, score };
}

/**
 * 计算与示例语句的字符串模糊吻合度
 */
function calculateExampleMatch(query: string, examples: string[]): number {
  const q = query.toLowerCase().trim();
  let maxScore = 0;
  for (const ex of examples) {
    const e = ex.toLowerCase().trim();
    if (q.includes(e) || e.includes(q)) {
      maxScore = Math.max(maxScore, 1.0);
    } else {
      // 计算重叠字词数
      const qWords = q.match(/[a-z0-9]+|[\u4e00-\u9fa5]/g) || [];
      const eWords = new Set(e.match(/[a-z0-9]+|[\u4e00-\u9fa5]/g) || []);
      if (qWords.length > 0 && eWords.size > 0) {
        const overlap = qWords.filter(w => eWords.has(w)).length;
        const ratio = overlap / Math.max(qWords.length, 1);
        if (ratio > maxScore) maxScore = ratio;
      }
    }
  }
  return Math.min(1.0, maxScore);
}

/**
 * 语义召回核心流水线 (Widget Semantic Retrieval via Orama)
 * ============================================================
 * 融合公式：
 * FinalScore = (SemanticScore * 0.35)
 *            + (IntentScore * 0.25)
 *            + (CapabilityScore * 0.20)
 *            + (DataReadyScore * 0.10)
 *            + (ExampleMatchScore * 0.10)
 *            - (NegativeIntentPenalty * 0.40)
 */
export async function retrieveWidgets(
  query: string,
  options: RetrieveWidgetsOptions = {}
): Promise<CandidateWidget[]> {
  const db = await getOramaWidgetDb();
  const limit = options.limit ?? 10;
  const targetIntent = (options.intent || "").trim().toLowerCase();
  const inputCaps = new Set((options.capabilities || []).map(c => c.toLowerCase()));

  // 1. Orama BM25 多字段加权召回
  const searchResult = await search(db, {
    term: query,
    boost: {
      keywords: 3.0,
      examples: 2.5,
      name: 2.2,
      intents: 2.0,
      capabilities: 1.8,
      description: 1.2
    },
    limit: 20
  });

  // 获取 Orama 最大得分用于归一化
  const rawScores = new Map<string, number>();
  let maxRawScore = 0.001;
  for (const hit of searchResult.hits) {
    const id = (hit.document as any).id as string;
    rawScores.set(id, hit.score);
    if (hit.score > maxRawScore) maxRawScore = hit.score;
  }

  // 2. 遍历评估所有组件候选
  const candidates: CandidateWidget[] = [];

  for (const item of Object.values(WIDGET_CATALOG)) {
    // 2.1 语义召回分 (归一化至 0~1)
    const rawOramaScore = rawScores.get(item.id) ?? 0;
    const semanticScore = Math.min(1.0, rawOramaScore / maxRawScore);

    // 2.2 意图契合分
    let intentScore = 0;
    if (targetIntent) {
      if (item.intents.includes(targetIntent)) {
        intentScore = 1.0;
      } else if (item.intents.some(i => targetIntent.includes(i) || i.includes(targetIntent))) {
        intentScore = 0.5;
      }
    }

    // 2.3 能力匹配分
    const matchedCaps = item.capabilities.filter(c => inputCaps.has(c.toLowerCase()));
    const capabilityScore = inputCaps.size > 0 ? Math.min(1.0, matchedCaps.length / Math.min(inputCaps.size, 4)) : 0.3;

    // 2.4 数据就绪分
    const { ready: dataReady, score: dataReadyScore } = checkDataReadiness(item, options.signals);

    // 硬性阻断：如果明确需要图片但完全无图，或者明确需要实体对比但无多实体，则降低分值
    if (!dataReady && item.requiredData && item.requiredData.length > 0) {
      // 对于 image_gallery 与 comparison，若数据硬指标缺失则直接跳过
      if (item.id === "image_gallery" && (options.signals?.imageCount ?? 0) === 0 && !options.signals?.imageIntent) {
        continue;
      }
      if (item.id === "comparison" && (options.signals?.comparisonRows ?? 0) === 0 && !options.signals?.hasMultipleEntities) {
        // 除非 query 显式包含 vs / 对比 / 区别
        if (!/(vs|区别|对比|比较|哪个好|pk)/i.test(query)) {
          continue;
        }
      }
    }

    // 2.5 示例语句吻合分
    const exampleMatchScore = calculateExampleMatch(query, item.examples);

    // 2.6 负向意图惩罚
    let negativePenalty = 0;
    if (item.negativeIntents && targetIntent) {
      if (item.negativeIntents.includes(targetIntent)) {
        negativePenalty = 1.0;
      }
    }

    // 2.7 垂直专属组件（天气、翻译、搜索引擎直达、Token监控）领域防护门槛：
    // 必须满足该领域的核心意图或核心领域关键词，避免因为泛词（如“指南”、“工具”）发生语义漂移误召回
    const isSpecializedVertical = ["weather", "translation", "search_engine", "token_usage"].includes(item.id);
    if (isSpecializedVertical) {
      const isDomainQueryHit =
        (item.id === "weather" && (targetIntent === "weather" || /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(query))) ||
        (item.id === "translation" && (targetIntent === "translation" || /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i.test(query))) ||
        (item.id === "search_engine" && (targetIntent === "search_engine_portal" || /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query))) ||
        (item.id === "token_usage" && (targetIntent === "system_monitor" || /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i.test(query)));

      if (!isDomainQueryHit) {
        continue;
      }
    }

    // 2.8 加权综合打分
    const finalScore =
      (semanticScore * 0.35) +
      (intentScore * 0.25) +
      (capabilityScore * 0.20) +
      (dataReadyScore * 0.10) +
      (exampleMatchScore * 0.10) -
      (negativePenalty * 0.40);

    const reasons: string[] = [];
    if (semanticScore > 0.5) reasons.push("关键词语义高度契合");
    if (intentScore > 0.5) reasons.push(`契合当前检索意图 (${targetIntent})`);
    if (matchedCaps.length > 0) reasons.push(`匹配所需能力: [${matchedCaps.slice(0, 3).join(", ")}]`);
    if (exampleMatchScore > 0.5) reasons.push("命中类似高频搜索场景");

    candidates.push({
      key: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      capabilities: item.capabilities,
      intents: item.intents,
      semanticScore,
      intentScore,
      capabilityScore,
      dataReadyScore,
      exampleMatchScore,
      finalScore: Math.max(0, finalScore),
      defaultSpan: item.defaultSpan,
      matchedCapabilities: matchedCaps,
      reason: reasons.length > 0 ? reasons.join(" · ") : "备选基础支撑组件"
    });
  }

  // 按综合得分降序排序
  candidates.sort((a, b) => b.finalScore - a.finalScore);

  return candidates.slice(0, limit);
}
