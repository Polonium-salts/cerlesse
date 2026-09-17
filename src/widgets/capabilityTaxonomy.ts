/**
 * 能力分类法单一事实源 (Capability Taxonomy - Single Source of Truth)
 *
 * ── 为什么需要这个文件 ──────────────────────────────────────────────
 * 改造前系统存在 5 套互不相通的能力词表：
 *   1. server/widgetIntentAnalyzer.ts  INTENT_CAPABILITIES_MAP   (意图侧, 55 项)
 *   2. server/widgetPlanner.ts         WIDGET_REGISTRY           (组件侧, 70 项)
 *   3. server/widgetPlanner.ts         ARCHETYPE_REGISTRY        (原型侧, 57 项)
 *   4. src/widgets/capabilities.ts     WIDGET_CAPABILITIES       (客户端, 33 项)
 *   5. src/lib/adaptiveLayout.ts       WIDGET_CAPABILITY_REGISTRY(混入原型名)
 *   6. server/intentAgent.ts           任务能力清单
 *   7. src/widgets/official/index.tsx  各组件模块声明的 capabilities
 *
 * 实测：意图侧 -> 组件侧 总体匹配率仅 19%，
 * "天气" 与 "资源素材" 两个意图零命中，86% 的组件能力是孤儿，
 * 导致 resolveWidgetsFromCapabilities 只能靠锚点白名单兜底，
 * 语义完全不同的搜索词收敛到同一套卡片。
 *
 * ── 本文件的职责 ───────────────────────────────────────────────────
 * • CANONICAL_CAPABILITIES：唯一被承认的规范能力 ID 全集（与组件真实渲染能力对齐）
 * • CAPABILITY_ALIASES    ：历史/LLM/客户端各种拼写 -> 规范 ID 的归一化映射
 * • normalizeCapabilities()：任何来源的能力数组都必须先过这里，再进入匹配打分
 *
 * 约定：新增能力必须先登记到 CANONICAL_CAPABILITIES，
 * 且在 WIDGET_REGISTRY 中至少有一个组件声明该能力，否则能力永远选不中组件。
 * 回归护栏见 scratch/guard_capability_taxonomy.mjs
 *
 * 本文件必须保持零依赖（不得 import React 或任何运行时库），
 * 以便被 Node 服务端 (server/*) 与浏览器端 (src/*) 同时安全引用。
 */

/**
 * 规范能力全集。
 * 每一项都必须能被 WIDGET_REGISTRY 中至少一个组件真实渲染，
 * 否则它就是"永远选不中组件"的孤儿能力。
 */
export const CANONICAL_CAPABILITIES = [
  // ── 综合速答与摘要 ──
  "overview_synthesis",
  "direct_answer",
  "definition_snippet",
  "instant_verdict",
  "concept_definition",
  "summary_points",
  "bullet_conclusions",
  "high_density_takeaways",
  "deep_report",
  "related_topics",
  "code_explanation",
  "faceted_deep_dive",
  "multi_aspect_summary",
  "core_principles",
  "typical_scenarios",

  // ── 软件 / 下载 / 安装 ──
  "software_info",
  "download",
  "releases",
  "release_binary",
  "version_history",
  "install_command",
  "install_step",
  "cli_execution",
  "copy_text",
  "fix_command",
  "git_clone",
  "package_manager",

  // ── 安全 / 核验 / 排查 ──
  "security_audit",
  "verification_checklist",
  "prerequisites_check",
  "troubleshooting_audit",
  "error_diagnosis",
  "environment_checklist",
  "fact_check",
  "checklist",
  "step_by_step",

  // ── 官网 / 门户 ──
  "official_site",
  "official_url",
  "official_portal",
  "verified_docs",
  "authoritative_entry",
  "booking_resources",
  "service_status",
  "contact_entry",
  "quick_links",
  "quick_action",

  // ── 搜索引擎直达 ──
  "search_engine_redirect",
  "external_search_query",
  "web_search_portal",
  "engine_launcher",

  // ── 工具发现 ──
  "tool_cards",
  "demo_button",
  "try_online",
  "software_directory",
  "online_tool",
  "free_tool",
  "pricing_comparison",

  // ── 对比 / 选型 / 裁决 ──
  "compare_table",
  "feature_matrix",
  "cross_compare",
  "dimension_pk",
  "spec_comparison",
  "benchmark_table",
  "pros_cons",
  "tradeoffs",
  "risk_mitigation",
  "advantages_disadvantages",
  "verdict_recommendation",
  "scenario_selection",
  "best_choice",
  "decision_matrix",
  "final_advice",
  "parameter_matrix",
  "industry_matrix",
  "expert_opinion",

  // ── 知识图谱 / 时间线 / 路线 ──
  "knowledge_topology",
  "architecture_tree",
  "subsystem_mapping",
  "mindmap_tree",
  "roadmap_step",
  "roadmap",
  "timeline_evolution",
  "milestones",
  "history",

  // ── 学习与代码 ──
  "code_snippet",
  "code_run",
  "recommended_courses",
  "practice_exercises",
  "progress_tracker",

  // ── 资源素材 ──
  "resource_search",
  "resource_preview",
  "image_gallery",
  "favorite",
  "tags_filter",
  "author_credit",
  "license_info",
  "resolution_spec",

  // ── 气象与环境 ──
  "weather_current",
  "weather_forecast",
  "weather_indices",
  "air_quality",
  "clothing_advice",
  "location_map",

  // ── 出行 ──
  "itinerary_timeline",
  "travel_budget",
  "attractions_map",
  "sightseeing",
  "route_plan",

  // ── 趋势与分析 ──
  "trend_signals",
  "sentiment_distribution",
  "temporal_evolution",
  "temporal_analysis",

  // ── 信源与存证 ──
  "evidence_chain",
  "citation_retrieval",
  "literature_archive",
  "literature_sources",

  // ── 交互与遥测 ──
  "interactive_followup_chat",
  "question_answering",
  "smart_followup_prompts",
  "source_telemetry",
  "confidence_meter",
  "mobile_handoff",
  "qr_scan_action",
  "agent_telemetry",
  "dag_trace",

  // ── 声明式组件 ──
  "custom_schema",
  "declarative_ui",
  "dynamic_components",

  // ── 语言与翻译 ──
  "language_translation",
  "text_translation",
  "bilingual_comparison",
  "pronunciation_guide",
  "dictionary_lookup"
] as const;

export type CanonicalCapability = (typeof CANONICAL_CAPABILITIES)[number];

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_CAPABILITIES);

/**
 * 别名归一化表。
 *
 * 收录三类历史包袱：
 *   1. 意图分析器早期使用的语义名 (download_button, version_compare, security_hash ...)
 *   2. LLM 自由发挥产生的近义拼写 (system_requirements, key_takeaways ...)
 *   3. 误把"卡片原型名"当能力名使用的泄漏值 (download_hub, tool_discovery ...)
 *
 * 键统一为小写；查表前会先做 key 规范化（小写、空格与连字符转下划线）。
 */
export const CAPABILITY_ALIASES: Record<string, CanonicalCapability> = {
  // 1. 意图分析器历史词表
  software_info: "software_info",
  download_button: "download",
  download_links: "download",
  download_package: "download",
  installer: "download",
  version_compare: "version_history",
  version_specs: "version_history",
  system_requirement: "environment_checklist",
  system_requirements: "environment_checklist",
  security_hash: "security_audit",
  security_check: "security_audit",
  package_manager: "package_manager",
  official_docs: "verified_docs",
  reference_docs: "verified_docs",
  prerequisites: "prerequisites_check",
  root_cause: "error_diagnosis",
  root_cause_analysis: "error_diagnosis",
  related_issues: "related_topics",
  quick_fix_command: "fix_command",
  verification: "verification_checklist",
  reference_sources: "literature_sources",
  spec_matrix: "feature_matrix",
  benchmark_data: "benchmark_table",
  selection_verdict: "verdict_recommendation",
  community_trends: "trend_signals",
  star_trend: "trend_signals",
  repo_summary: "software_info",
  download_hub: "download",
  tutorial_roadmap: "roadmap_step",

  // 2. LLM / intentAgent 近义拼写
  copy_command: "copy_text",
  copy_code: "copy_text",
  key_takeaways: "high_density_takeaways",
  step_list: "step_by_step",
  troubleshooting_tips: "fix_command",
  pricing_model: "pricing_comparison",
  budget_breakdown: "travel_budget",
  route_map: "attractions_map",
  literature_review: "literature_sources",
  expert_consensus: "expert_opinion",
  data_table: "compare_table",
  trend_chart: "trend_signals",
  direct_answers: "direct_answer",
  summary: "summary_points",
  sources: "literature_sources",

  // 3. 原型名误用为能力名的泄漏值
  tool_discovery: "tool_cards",
  photo_gallery: "image_gallery",
  image_preview: "image_gallery",
  image_wall: "image_gallery",
  thumbnail_gallery: "image_gallery",
  travel_itinerary: "itinerary_timeline",
  parameter_matrix: "parameter_matrix",
  action_checklist: "checklist",
  verdict_summary: "verdict_recommendation",
  timeline: "timeline_evolution",
  pros_and_cons: "pros_cons",
  mindmap: "mindmap_tree",
  comparison: "compare_table",

  // 3. 翻译与语言别名
  translate: "language_translation",
  translation: "language_translation",
  dictionary: "dictionary_lookup",
  bilingual: "bilingual_comparison",
  phonetic: "pronunciation_guide"
};

/**
 * 能力名规范化：统一大小写、去空白、连字符转下划线。
 */
function canonicalKey(raw: string): string {
  return String(raw).trim().toLowerCase().replace(/[\s\-]+/g, "_");
}

export function isCanonicalCapability(value: string): value is CanonicalCapability {
  return CANONICAL_SET.has(canonicalKey(value));
}

/**
 * 归一化单个能力名。
 * @returns 规范能力 ID；若无法识别则返回 null（调用方应记录 telemetry 而非静默估算）
 */
export function normalizeCapability(raw: string): CanonicalCapability | null {
  if (!raw || typeof raw !== "string") return null;
  const key = canonicalKey(raw);
  if (key === "") return null;
  if (CANONICAL_SET.has(key)) return key as CanonicalCapability;
  const alias = CAPABILITY_ALIASES[key];
  return alias && CANONICAL_SET.has(alias) ? alias : null;
}

export interface NormalizedCapabilities {
  /** 去重后的规范能力 ID */
  canonical: CanonicalCapability[];
  /** 无法识别的原始输入（用于诊断词表漂移，不参与匹配打分） */
  unmapped: string[];
  /** 别名命中的映射明细，便于排查 */
  remapped: Array<{ from: string; to: CanonicalCapability }>;
}

/**
 * 归一化能力数组。所有来源（意图分析器 / LLM / intentAgent / 客户端）
 * 的能力必须先经过此函数，才能进入 resolveWidgetsFromCapabilities 打分。
 *
 * 为什么要丢弃无法识别的项而不是保留：
 * 保留会污染能力集合、无法命中任何组件，只会虚增噪声；
 * 显式归入 unmapped 才能暴露词表漂移问题。
 */
export function normalizeCapabilities(raw: Array<string | undefined | null>): NormalizedCapabilities {
  const canonical: CanonicalCapability[] = [];
  const unmapped: string[] = [];
  const remapped: Array<{ from: string; to: CanonicalCapability }> = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "string") continue;
    const key = canonicalKey(item);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);

    const resolved = normalizeCapability(item);
    if (!resolved) {
      unmapped.push(item);
      continue;
    }
    if (!canonical.includes(resolved)) {
      canonical.push(resolved);
    }
    if (resolved !== key) {
      remapped.push({ from: item, to: resolved });
    }
  }

  return { canonical, unmapped, remapped };
}

/**
 * 供 LLM 提示词使用的封闭枚举，防止模型自由发明能力名。
 */
export const CAPABILITY_PROMPT_ENUM = CANONICAL_CAPABILITIES.join(" | ");

/**
 * 两套意图分类器的一致性对齐表。
 *
 * 系统存在两个并行演化的意图分类器，判定口径不同：
 *   • server/intentAgent.classifyQueryIntent  -> QueryIntent (8 类)，只分析 query 关键词
 *   • server/widgetIntentAnalyzer.analyzeWidgetIntent -> 10 类，同时分析 query + 检索结果
 *
 * 二者判定不一致时若直接对能力取并集，会把无关业务域的能力注入任务，
 * 例如 query="Photoshop" 时前者只看到孤立词 -> 落到 explain 兜底 -> 注入
 * concept_definition / mindmap_tree / key_takeaways，导致下载类任务里
 * 思维导图排在下载入口之前。本表声明哪些组合属于语义等价，可安全并集。
 */
export const INTENT_TAXONOMY_ALIGNMENT: Record<string, string[]> = {
  install: ["software_download", "github_project"],
  compare: ["tech_comparison"],
  tool_discovery: ["resource_search", "general_knowledge", "search_engine_portal"],
  tutorial: ["study_tutorial"],
  troubleshooting: ["troubleshooting"],
  translation: ["translation"],
  travel: ["general_knowledge"],
  explain: ["concept_explanation"],
  research: ["concept_explanation", "general_knowledge"]
};

/** 语义分析器判定为"无明确领域"时的通用意图，此时应允许并集其它分类器结论 */
export const GENERIC_INTENTS = ["general_knowledge"];

/** 语义分析器置信度达到该阈值时，视为证据充分，可覆盖另一分类器的结论 */
export const INTENT_CONFIDENCE_OVERRIDE_THRESHOLD = 0.8;

/**
 * 语义分析器意图 -> 面向用户的目标文案。
 *
 * 用于两个分类器冲突时同步 userGoal 文案：否则会出现
 * "Photoshop 下载任务" 却显示 "理解概念定义与核心原理解析" 的自相矛盾，
 * 让用户看不懂这个工作台是干什么的。
 */
export const INTENT_GOAL_LABELS: Record<string, string> = {
  software_download: "获取、核验并安装目标软件",
  weather: "查询目标地区实时天气与出行建议",
  resource_search: "检索、预览并收藏可用素材资源",
  study_tutorial: "按路线图体系化学习目标技能",
  github_project: "调研、克隆并使用目标开源项目",
  tech_comparison: "横向对比参数并给出选型裁决",
  troubleshooting: "定位根因并修复故障",
  portal_navigation: "直达官方网站与权威门户",
  search_engine_portal: "在主流搜索引擎中进行外部检索与快速跳转",
  translation: "跨语言文本翻译与双语词典释义",
  concept_explanation: "理解概念定义与核心原理解析",
  general_knowledge: "全面获取信息与多方文献研判"
};

// =========================================================================
// 小组件与业务原型标签体系与 Agent 提示词配置库 (Widget Tag & Agent Prompt Catalog)
// 为每个小组件分配精准语义标签、功能描述、数据要求与实用性评价准则
// =========================================================================

export interface WidgetPracticalityMeta {
  id: string;
  name: string;
  category: "synthesis" | "analysis" | "action" | "portal" | "custom";
  tags: string[];
  functionality: string;
  bestFor: string[];
  dataRequirements: string[];
  selectionHeuristics: string;
  triggerKeywords?: string[];
  antiPatterns?: string[];
}

/**
 * 官方小组件标签与实用性画像库
 */
export const OFFICIAL_WIDGET_PROFILES: Record<string, WidgetPracticalityMeta> = {
  ai_answer: {
    id: "ai_answer",
    name: "AI 智能回答",
    category: "synthesis",
    tags: ["AI回答", "全网总结", "深度要点", "问答", "结论", "知识综合", "多信源提炼"],
    functionality: "基于全网检索多路信源进行深度综合与推理，输出格式化 Markdown 回答、核心决策结论速览与智能拓展追问",
    bestFor: [
      "开放性探索与复杂知识问答",
      "深度技术原理解析与长篇调研研报",
      "需要直接给出明确结论与要点摘要的场景"
    ],
    dataRequirements: ["全网综合检索信源", "文本摘要"],
    selectionHeuristics: "当用户查询属于知识探索、综合分析或需要一揽子研报结论时，实用性最高（应优先作为核心大卡置顶全宽呈现）。",
    triggerKeywords: ["是什么", "为什么", "如何", "总结", "分析", "原理", "介绍", "概况"]
  },
  related_links: {
    id: "related_links",
    name: "官网跳转",
    category: "portal",
    tags: ["官方入口", "官网直达", "多链接", "权威信源", "导航", "外部跳转", "防钓鱼"],
    functionality: "智能提取检索结果中的权威官方网站、产品主页与官方文档，提供安全卡片式快速跳转通道与站点说明",
    bestFor: [
      "查询包含明确产品、品牌、机构或知名软件/网站名称",
      "寻找正版下载源、官方服务入口、登录后台或开发文档",
      "帮助用户快速识别官方直链并防范仿冒/钓鱼站点"
    ],
    dataRequirements: ["权威有效 URL", "站点名称与功能摘要"],
    selectionHeuristics: "当搜索词涉及品牌、软件名、在线平台或寻找入口直达时实用性最高，帮用户零阻碍直达目标主页。",
    triggerKeywords: ["官网", "官方网站", "入口", "登录", "下载", "主页", "文档", "平台"]
  },
  image_gallery: {
    id: "image_gallery",
    name: "相关图片",
    category: "analysis",
    tags: ["相关图片", "图片墙", "视觉素材", "缩略图", "图集", "媒体预览", "配图参考"],
    functionality: "提取全网检索结果中的图片缩略图与研报配图，以自适应网格墙呈现，支持点击放大预览、图文对照与一键跳转图片原始出处",
    bestFor: [
      "查询对象具有明确可视形态：人物、地点、动植物、产品外观、界面截图、艺术作品",
      "需要图片素材、配图灵感或实物外观确认的场景",
      "百科介绍类检索希望直观看到实物、场景与效果图"
    ],
    dataRequirements: ["检索结果含可公开访问的图片缩略图或研报内嵌配图", "图片与查询主题相关且可正常加载"],
    selectionHeuristics: "当查询对象具备明确视觉形态（实物/人物/地点/界面/图表）且信源含图片时实用性最高；纯抽象概念推演、代码报错排查、无任何图片信源的任务不推荐。",
    triggerKeywords: ["图片", "照片", "图集", "壁纸", "素材", "外观", "长什么样", "图片搜索"],
    antiPatterns: ["纯抽象概念解释、术语定义与代码报错排查", "检索结果中不含任何可用图片信源的长文研报"]
  },
  search_engine: {
    id: "search_engine",
    name: "搜索引擎直达",
    category: "action",
    tags: ["搜索引擎", "搜索直达", "Google", "Bing", "百度", "外部搜索", "一键跳转", "快捷搜索"],
    functionality: "智能识别用户对于 Google、Bing、百度等主流搜索引擎的检索或跳转诉求，提供极简药丸形快捷搜索框，输入后一键直达目标搜索引擎结果页",
    bestFor: [
      "用户检索词包含 Google、Bing、百度、必应、谷歌或搜索引擎名称",
      "用户希望使用指定外部搜索引擎进行二次深度全网搜索",
      "提供直达外部搜索引擎的一键搜索与跳转通道"
    ],
    dataRequirements: ["当前检索关键词或目标搜索引擎名称"],
    selectionHeuristics: "当搜索词涉及 Google、Bing、百度、必应、谷歌等搜索引擎或用户表达了外部引擎检索意图时，实用性极高，Agent 应优先启用该组件并置于前列。",
    triggerKeywords: ["google", "bing", "baidu", "百度", "必应", "谷歌", "搜索引擎", "搜狗", "duckduckgo", "搜索"]
  },
  translation: {
    id: "translation",
    name: "多语言翻译",
    category: "action",
    tags: ["翻译", "双语", "多语言", "词典", "英译中", "中译英", "Translate", "发音"],
    functionality: "即时文本与词汇翻译、双语词典释义、权威发音、例句对照与一键复制",
    bestFor: [
      "用户搜索内容与翻译、跨语言表达、外语查词相关（如'苹果的英文'、'中译英'、'怎么说'）",
      "双语互译、音标发音与例句对照"
    ],
    dataRequirements: ["待翻译词句或目标语言"],
    selectionHeuristics: "当搜索词涉及中英日韩等翻译或双语查词时，实用性极高，Agent 应优先启用该组件并置于前列。",
    triggerKeywords: ["翻译", "英文", "英语", "日语", "韩语", "德语", "法语", "西语", "俄语", "translate", "translation", "怎么说", "什么意思"]
  }
};

/**
 * 业务原型 (Archetypes) 标签与实用性画像库
 */
export const ARCHETYPE_PROFILES: Record<string, WidgetPracticalityMeta> = {
  download_hub: {
    id: "download_hub",
    name: "软件下载 / 版本枢纽",
    category: "action",
    tags: ["软件下载", "版本发布", "系统要求", "客户端", "正版安装", "安装包", "二进制包", "跨平台"],
    functionality: "结构化聚合多平台安装包 (Windows/macOS/Linux/移动端)、最新 Release 版本号、环境要求与安全 Hash 校验",
    bestFor: ["软件下载、安装包获取、客户端升级、最新版本发布查询"],
    dataRequirements: ["版本号", "平台支持列表", "下载直链或安装指令"],
    selectionHeuristics: "当搜索词包含工具/软件获取意图时实用性最高，帮助用户一步直达正版下载。",
    triggerKeywords: ["下载", "安装包", "client", "客户端", "release", "最新版", "installer"]
  },
  action_checklist: {
    id: "action_checklist",
    name: "实战清单 / 步骤指引",
    category: "action",
    tags: ["操作步骤", "排查清单", "配置指南", "实操避坑", "环境核对", "命令排错", "步骤条", "交互式勾选"],
    functionality: "提供带状态勾选框的分步骤操作指南、前置条件核对清单与故障排错诊断流程",
    bestFor: ["How-to 教程、配置步骤、故障排查、环境安装前置检查、流程审批清单"],
    dataRequirements: ["清晰的步骤项", "操作指导说明或命令"],
    selectionHeuristics: "当用户提出具体操作方法或排查报错时实用性最高，支持用户交互式核对进度。",
    triggerKeywords: ["步骤", "教程", "怎么配", "排查", "报错解决", "指南", "清单", "checklist"]
  },
  tool_discovery: {
    id: "tool_discovery",
    name: "工具神器发现",
    category: "action",
    tags: ["在线工具", "神器推荐", "免安装", "在线体验", "价格方案", "效率工具", "工具箱", "替代方案"],
    functionality: "聚合多款同类实用工具/在线服务卡片，包含工具简介、特性标签、免费/付费定价与一键试用按钮",
    bestFor: ["寻找某个功能在线工具、替代软件推荐、效率神器盘点"],
    dataRequirements: ["工具名称列表", "核心功能描述", "体验或官网链接"],
    selectionHeuristics: "当用户寻找'有什么好用的XX工具/替代品'时实用性最高。",
    triggerKeywords: ["工具", "在线", "推荐", "转换器", "免安装", "神器", "替代品"]
  },
  pros_cons: {
    id: "pros_cons",
    name: "优缺点 / 利弊权衡",
    category: "analysis",
    tags: ["优缺点", "利弊权衡", "优劣对比", "客观评价", "避坑指南", "决策参考", "中立测评"],
    functionality: "双栏分色对比核心优势 (Pros) 与局限不足 (Cons)，提供客观中立的避坑与选型参考",
    bestFor: ["产品体验评价、框架/语言选型、买前调研、利弊分析"],
    dataRequirements: ["明确的优势点与不足点"],
    selectionHeuristics: "用户犹豫不决或探寻某事物好坏时实用性最高。",
    triggerKeywords: ["优缺点", "利弊", "好用吗", "值得买吗", "缺点", "优势", "评价"]
  },
  verdict_summary: {
    id: "verdict_summary",
    name: "选型裁决 / 推荐结论",
    category: "analysis",
    tags: ["最终裁决", "场景选型", "推荐建议", "购买指南", "专家结论", "终极PK", "决策大脑"],
    functionality: "给出针对不同场景（如预算有限、企业级、初学者）的权威推荐结论与决策建议",
    bestFor: ["A和B选哪个、谁更好用、购买建议、最终决策"],
    dataRequirements: ["分场景推荐建议", "权威裁决说明"],
    selectionHeuristics: "用户直接发问'哪个好/买哪个'时实用性最高。",
    triggerKeywords: ["选哪个", "买哪个", "推荐哪个", "谁更好", "pk", "裁决"]
  },
  parameter_matrix: {
    id: "parameter_matrix",
    name: "参数矩阵 / 规格对比",
    category: "analysis",
    tags: ["参数表格", "规格对比", "性能基准", "指标矩阵", "横向对比", "数据表格", "维度打分"],
    functionality: "结构化二维多维对比表格，逐项对齐核心参数、技术指标、配置规格与测试基准",
    bestFor: ["多产品/型号/技术规格参数横向比对、配置表查询"],
    dataRequirements: ["横向对比项", "关键参数指标"],
    selectionHeuristics: "用户对比多个型号或技术参数时实用性最高。",
    triggerKeywords: ["参数", "配置对比", "规格", "基准测试", "benchmark", "对比表"]
  },
  timeline: {
    id: "timeline",
    name: "时间线 / 版本沿革",
    category: "analysis",
    tags: ["发展历程", "版本历史", "演进路线", "大事件", "路线图", "历史沿革", "时间轴"],
    functionality: "时间轴垂直串联历史版本、关键发布节点、演进里程碑或未来规划路线图",
    bestFor: ["技术发展历史、产品演进路线、大事件回顾、发版历程"],
    dataRequirements: ["时间节点", "事件标题与描述"],
    selectionHeuristics: "查询历史、发展史或演进过程时实用性最高。",
    triggerKeywords: ["发展史", "历史", "时间线", "演进", "历程", "版本历史", "路线图"]
  },
  travel_itinerary: {
    id: "travel_itinerary",
    name: "行程规划 / 攻略助手",
    category: "action",
    tags: ["旅游攻略", "行程路线", "景点规划", "出行门票", "预算清单", "路线指南", "打卡地图"],
    functionality: "分天数规划游玩路线、景点地图、门票建议与出行预算明细",
    bestFor: ["旅游攻略、几日游路线、景点推荐、出行预算"],
    dataRequirements: ["天数或地点规划", "交通住宿景点信息"],
    selectionHeuristics: "用户查询旅游行程与出行规划时实用性最高。",
    triggerKeywords: ["旅游攻略", "行程", "路线", "自驾", "几日游", "门票", "景点"]
  },
  quote_dossier: {
    id: "quote_dossier",
    name: "观点汇编 / 名家言论",
    category: "analysis",
    tags: ["名家观点", "权威言论", "多方评语", "引文档案", "争议讨论", "舆论风向"],
    functionality: "汇集行业专家、名家观点与多方争议言论引用，标注文献出处与人物背景",
    bestFor: ["人物评价、行业争论、专家访谈、权威引用查询"],
    dataRequirements: ["名言/观点内容", "发言人/作者", "出处信源"],
    selectionHeuristics: "用户探寻业界观点与多方争议时实用性最高。",
    triggerKeywords: ["名言", "观点", "评价", "言论", "争议", "怎么看"]
  }
};

/**
 * 格式化输出给 LLM Agent 的小组件与标签提示词指导 (Prompt Guidance Section)
 */
export function formatAgentWidgetGuidancePrompt(): string {
  const officialSection = Object.values(OFFICIAL_WIDGET_PROFILES)
    .map(p => `• [官方组件] ${p.name} (id: "${p.id}"):
    - 标签: [${p.tags.join(", ")}]
    - 核心功能: ${p.functionality}
    - 最适合场景: ${p.bestFor.join("; ")}
    - 实用性准则: ${p.selectionHeuristics}`)
    .join("\n");

  const archetypeSection = Object.values(ARCHETYPE_PROFILES)
    .map(p => `• [业务卡片] ${p.name} (archetype: "${p.id}"):
    - 标签: [${p.tags.join(", ")}]
    - 核心功能: ${p.functionality}
    - 最适合场景: ${p.bestFor.join("; ")}
    - 实用性准则: ${p.selectionHeuristics}`)
    .join("\n");

  return `### 小组件与业务卡片标签库及实用性选型准则 (Widget & Archetype Selection Guide)
请结合用户的检索词、意图与信源数据特征，对比下列组件的标签、功能与实用性准则，优先选取能最大化解决用户核心问题、信息密度最高、最实用的组件集合：

${officialSection}

${archetypeSection}
`;
}

