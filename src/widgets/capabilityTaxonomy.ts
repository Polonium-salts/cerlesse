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
  "dynamic_components"
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
  quick_answer: "direct_answer",
  direct_answers: "direct_answer",
  summary: "summary_points",
  sources: "literature_sources",

  // 3. 原型名误用为能力名的泄漏值
  tool_discovery: "tool_cards",
  travel_itinerary: "itinerary_timeline",
  parameter_matrix: "parameter_matrix",
  action_checklist: "checklist",
  verdict_summary: "verdict_recommendation",
  timeline: "timeline_evolution",
  pros_and_cons: "pros_cons",
  mindmap: "mindmap_tree",
  comparison: "compare_table"
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
  tool_discovery: ["resource_search", "general_knowledge"],
  tutorial: ["study_tutorial"],
  troubleshooting: ["troubleshooting"],
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
  portal_navigation: "直达官方权威入口与文档",
  concept_explanation: "理解概念定义与核心原理",
  general_knowledge: "综合掌握主题核心要点"
};
