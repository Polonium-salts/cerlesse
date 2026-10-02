/**
 * Agent 检索推理层（Query Reasoner）
 * ==================================
 * 存在的意义：内置 Agent 此前把用户原话一字不改地丢给 search_web ——
 *   · 「请问下 Kubernetes 的 Ingress 怎么配置？谢谢」这类对话式长句会带着
 *     「请问 / 谢谢」进入检索引擎，召回被问答聚合页与内容农场带偏；
 *   · 模型拿到的是整坨结果 JSON（十几条 + 全部诊断字段），无从判断
 *     「证据够不够、缺的是哪个词」，于是要么过早收敛，要么重复发同一条查询。
 *
 * 本模块把这部分推理做成**确定性纯逻辑**（零 LLM 调用、零额外 I/O、结果可复现），
 * 只做四件事：
 *   1. 理解：识别检索意图、抽取核心实体，给出语言与时效先验；
 *   2. 规划：把原话收敛为「聚焦的主查询 + 至多 N 条意图补检查询」；
 *   3. 评估：按实体覆盖与权威源占比判定证据是否充分，明确指出缺口；
 *   4. 观测：把召回压缩成「模型真正需要的那几行」，并附上缺口与建议补检。
 *
 * 边界（与项目既有约束一致）：
 *   · 不引入第二个 Agent / LLM planner / selector / router；
 *   · 不伪造结果，不放松调用方显式给出的域名/时效/语言约束；
 *   · 评估结论只用于「决定要不要再搜一次」与「如实告知模型证据边界」，
 *     不参与最终排序 —— 排序仍由 retrievalRanker 单一权威负责。
 */

import { SearchResult, SearchHitLevel, SearchSourceType } from "../../src/types.js";
import { detectQueryLanguage } from "../language.js";
import { resolveHitLevel } from "../services/searchService.js";
import {
  CandidatePool,
  buildQueryProfile,
  canonicalTermSet,
  canonicalizeTerm,
  classifySourceType,
  mergeCandidatePools,
  rankSearchPools
} from "../retrievalRanker.js";

// ============================================================
// 1. 意图识别
// ============================================================

export type QueryIntent =
  | "official"
  | "troubleshooting"
  | "comparison"
  | "research"
  | "news"
  | "definition"
  | "howto"
  | "general";

const INTENT_LABELS: Record<QueryIntent, string> = {
  official: "官方权威入口",
  troubleshooting: "故障排查与修复",
  comparison: "对比与取舍",
  research: "学术与研究资料",
  news: "时效动态",
  definition: "概念与原理解释",
  howto: "操作教程",
  general: "综合检索"
};

/**
 * 意图规则表，**顺序即优先级**。
 *
 * 顺序不是随手排的，它解决的是「一条查询同时命中多个意图」时的归属：
 *   · 「docker 部署报错怎么解决」同时命中 howto(部署) 与 troubleshooting(报错)，
 *     排查类意图更具体、更可操作，必须赢 —— 否则补检会去搜「教程」，
 *     而用户真正缺的是错误原因；
 *   · 「xx 最新版本是什么」同时命中 news(最新) 与 definition(是什么)，
 *     时效优先才能让补检聚焦在发布公告而不是概念解释。
 */
const INTENT_RULES: Array<{ intent: QueryIntent; pattern: RegExp }> = [
  { intent: "official", pattern: /(官网|官方网站|官方|主页|正式版|official|homepage)/i },
  {
    intent: "troubleshooting",
    pattern: /(报错|错误|异常|排错|排查|失败|无法|不能|崩溃|解决|bug|error|errors|exception|fail|failed|crash|troubleshoot|debug|fix)/i
  },
  {
    intent: "comparison",
    pattern: /(对比|比较|区别|差异|优缺点|优劣|哪个好|哪个更|vs\.?|versus|compare|comparison|difference|differences|pros|cons)/i
  },
  { intent: "research", pattern: /(论文|文献|综述|实证|研究|paper|papers|survey|research|study|benchmark)/i },
  {
    intent: "news",
    pattern: /(最新|近期|今年|动态|新闻|发布|公告|更新日志|latest|recent|news|release|changelog|announcement)/i
  },
  {
    intent: "definition",
    pattern: /(是什么|什么是|什么叫|啥是|定义|含义|概念|原理|机制|what is|definition|concept|principle)/i
  },
  {
    intent: "howto",
    pattern: /(教程|步骤|如何|怎么|怎样|安装|配置|部署|搭建|上手|入门|tutorial|guide|how to|install|setup|configure|deploy|getting started)/i
  }
];

export function detectQueryIntent(query: string): QueryIntent {
  const text = (query || "").trim();
  if (!text) return "general";
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(text)) return rule.intent;
  }
  return "general";
}

/**
 * 各意图的补检面（facet）。
 *
 * 语义：第 1 项是主查询的聚焦面，其后各项是「证据不足时可追加的补检面」。
 * 中英分开给模板，而不是把两种语言都拼上去 —— 拼两种语言会让检索式变成
 * 中英混杂的长尾，反而降低召回精度；按查询脚本选一侧就够。
 *
 * general 的首项为空：这类查询本身没有明确意图，硬加面词只会缩小召回，
 * 因此主查询保持原样，只在证据不足时才退到「深入解读」类补检。
 */
const INTENT_FACETS: Record<QueryIntent, { cjk: string[]; latin: string[] }> = {
  official: { cjk: ["官方文档", "版本发布说明", "官方网站"], latin: ["official documentation", "release notes", "official site"] },
  troubleshooting: { cjk: ["报错 解决方法", "常见错误 原因", "故障修复指南"], latin: ["error fix", "common error causes", "troubleshooting guide"] },
  comparison: { cjk: ["对比", "优缺点", "特性评测"], latin: ["comparison", "pros and cons", "feature review"] },
  research: { cjk: ["论文 综述", "研究进展", "权威解析"], latin: ["paper survey", "research review", "authoritative analysis"] },
  news: { cjk: ["最新 动态", "发布 公告", "实时资讯"], latin: ["latest news", "release announcement", "real-time updates"] },
  definition: { cjk: ["原理", "入门 概念", "核心架构"], latin: ["overview principles", "introduction concepts", "core architecture"] },
  howto: { cjk: ["教程 步骤", "常见问题", "实操指南"], latin: ["tutorial guide", "frequently asked questions", "practical guide"] },
  general: { cjk: ["深入 解读", "官方 资料", "核心 概述"], latin: ["in depth explanation", "official resources", "core overview"] }
};

// ============================================================
// 2. 查询规划
// ============================================================

export interface PlannedQuery {
  query: string;
  rationale: string;
  /** compacted = 已去除对话填充词与标点；verbatim = 原样下发（收敛不安全时） */
  strategy: "compacted" | "verbatim";
  /** 该查询附加的意图面词（主查询可能是空串） */
  facet?: string;
}

export interface QueryUnderstanding {
  original: string;
  /** 核心实体短语（已剔除对话填充词与意图修饰词），用于证据评估与补检构造 */
  entity: string;
  /** 实体规范词项（跨语言/同义词已归并） */
  entityTerms: string[];
  /**
   * 规范词项 → 用户原词。
   * 缺口必须用用户看得懂的说法报告：「缺 ingress」能被直接补检，
   * 「缺 ingres」（词干化产物）只会让模型与用户一起蒙。
   */
  displayTerms: Record<string, string>;
  latinTerms: string[];
  cjkTerms: string[];
  intent: QueryIntent;
  intentLabel: string;
  language: string;
  /** 时效先验：仅在查询本身带时效语义时给出 */
  recencyDays?: number;
  allowEncyclopedia: boolean;
}

export interface SearchPlan {
  understanding: QueryUnderstanding;
  primary: PlannedQuery;
  refinements: PlannedQuery[];
}

/**
 * 对话填充词：它们表达「请求的语气」而不是「要找什么」。
 *
 * 必须剥掉的实证理由：检索引擎对这类词没有语义，只会把它们当成必须命中的
 * 词项 —— 「请问 xxx 怎么配置 谢谢」的召回里会出现大量标题写作
 * 「请问 xxx 怎么配置」的问答聚合页，而真正的官方文档因为标题里没有「请问 / 谢谢」
 * 反而排到后面。剥掉它们等于把检索式还原成「用户真正想问的内容」。
 */
const FILLER_PATTERNS: RegExp[] = [
  /(请问一下|请问下|请问|请帮忙|帮我看看|帮我查一下|帮我|帮忙|麻烦|我想知道|我想了解|我想问一下|我想问|求问|有人知道吗|求解答|谢谢|感谢|麻烦了|一下)/g,
  /\b(please|can you|could you|would you|i want to know|i would like to know|i'd like to know|tell me|help me|what about|do you know|thanks|thank you|kindly)\b/gi
];

/** 去掉对话填充词与句末标点，保留一切有检索语义的词（含「对比 / 官方」这类意图词） */
export function compactQuery(query: string): string {
  let text = (query || "").trim();
  for (const pattern of FILLER_PATTERNS) text = text.replace(pattern, " ");
  return text
    .replace(/[?？!！]+/g, " ")
    .replace(/[\s\u3000]+/g, " ")
    .replace(/^[\s，,、。;；:：]+/, "")
    .replace(/[\s，,、。;；:：]+$/, "")
    .trim();
}

function isLatinTermLike(term: string): boolean {
  return /^[a-z][a-z0-9+#._-]*$/.test(term) && !/^\d+$/.test(term);
}

/**
 * 收敛安全性检查：被去掉的词项必须**全部能归因到填充词本身**。
 *
 * 为什么需要它：填充词表是正则，总有误伤的可能 —— 比如歌名《Thanks for the Memory》里的
 * "thanks"、歌名《谢谢你的爱》里的「谢谢」都是内容词，不是语气词。一旦收敛把内容词吃掉，
 * 检索精度不是下降而是**崩掉**（搜的东西已经变了），而用户完全看不出问题出在哪。
 * 因此做一道机械校验：
 *   1. 原始查询的拉丁主体词项必须逐字保留；
 *   2. 每个被删掉的词项，都必须能在「本次实际命中的填充词文本」里找到出处。
 * 两条任一不满足就退回原样下发 —— 保守一点只是少收敛一次，改错一个字才是真事故。
 */
function preservesContent(original: string, candidate: string): boolean {
  const originalTerms = Array.from(canonicalTermSet(original));
  const candidateTerms = canonicalTermSet(candidate);

  const latin = originalTerms.filter(isLatinTermLike);
  if (!latin.every((term) => candidateTerms.has(term))) return false;

  const dropped = originalTerms.filter((term) => !candidateTerms.has(term));
  if (dropped.length === 0) return true;

  const matchedFillerText = FILLER_PATTERNS
    .map((pattern) => (original.match(pattern) || []).join(" "))
    .join(" ");
  const fillerTerms = canonicalTermSet(matchedFillerText);
  return dropped.every((term) => fillerTerms.has(term));
}

/** 时效先验：新闻类 90 天；带年份或「最新/近期」的 180 天；其余不给（沿用调用方默认） */
function recencyHint(intent: QueryIntent, raw: string): number | undefined {
  if (intent === "news") return 90;
  if (/\b(19|20)\d{2}\b/.test(raw) || /(最新|近期|今年|latest|recent)/i.test(raw)) return 180;
  return undefined;
}

function queryKey(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\u3400-\u9fff ]/g, "").trim();
}

/**
 * 规划检索：把用户原话变成一组**有明确指向**的查询。
 *
 * 主查询只做「去填充词」这一件事，不做实体精简 —— 因为「对比 / 官方 / 报错」
 * 这类意图词对检索引擎是**有效信号**，删掉它们才是损失精度的做法。
 * 实体的作用在别处：评估证据覆盖度、以及在证据不足时构造补检。
 */
export function planSearchQueries(
  query: string,
  options: { language?: string; maxRefinements?: number } = {}
): SearchPlan {
  const original = (query || "").trim();
  // 实体必须从**去填充词后**的文本里抽取。
  // 否则「请问下 Kubernetes Ingress 配置？谢谢」这类查询会把「请问下 / 谢谢 / ？」
  // 带进实体短语，再由实体派生出补检查询 —— 补检式里带着客套话，召回自然被打偏。
  const compacted = compactQuery(original);
  const entitySource = compacted || original;
  const entity = (buildQueryProfile(entitySource).entityPhrase || entitySource)
    .replace(/^[\s，,、。;；:：！!？?]+/, "")
    .replace(/[\s，,、。;；:：！!？?]+$/, "")
    .trim();

  // 词项与展示映射必须基于**最终实体**：
  // 若拿「剔除意图修饰词之前」的文本建画像，像「怎么配置」「么配」这类被修饰词表删掉的
  // 碎片仍会留在词项集里 —— 它们既拉低实体覆盖率（永远匹配不上文档），
  // 又会被当成「缺口词项」上报，把真正的缺口（如 ingress）淹没。
  const entityProfile = buildQueryProfile(entity || entitySource);
  const entityTerms = entityProfile.canonicalTerms.length > 0
    ? entityProfile.canonicalTerms
    : buildQueryProfile(original).canonicalTerms;

  const displayTerms: Record<string, string> = {};
  for (const [canonical, raws] of Object.entries(entityProfile.rawTermsByCanonical)) {
    const raw = (raws || []).find((term) => term && term !== canonical);
    displayTerms[canonical] = raw || canonical;
  }
  // 主体词与「跨语言折入的词」必须分开：
  //   · 拉丁主体词 = 原始查询里本来就是拉丁字符的词（nginx / k8s / react），再取规范形
  //     （这样文档里写 Kubernetes、查询里写 k8s 也能对上），它代表「在讲什么」；
  //   · 其余规范词项（含 代理→proxying、配置→configuration 这类跨语言折入的词）算附属。
  // 分不开就会出问题：查询「nginx 反向代理配置」下，一篇《Apache 反向代理配置》能命中
  // proxying / configuration 等全部附属词，却压根没提 nginx —— 门控必须能把这些排掉。
  const latinTerms = Array.from(
    new Set(entityProfile.terms.filter(isLatinTermLike).map((term) => canonicalizeTerm(term)))
  );
  const latinTermSet = new Set(latinTerms);
  const cjkTerms = entityTerms.filter((term) => !latinTermSet.has(term));

  const intent = detectQueryIntent(original);
  const language = options.language || detectQueryLanguage(original).code;
  const isCjk = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(original);
  const facets = isCjk ? INTENT_FACETS[intent].cjk : INTENT_FACETS[intent].latin;

  const understanding: QueryUnderstanding = {
    original,
    entity: entity || original,
    entityTerms,
    displayTerms,
    latinTerms,
    cjkTerms,
    intent,
    intentLabel: INTENT_LABELS[intent],
    language,
    recencyDays: recencyHint(intent, original),
    allowEncyclopedia: /维基|wikipedia|百科/i.test(original)
  };

  // 实体短语至少要留下 2 个实义字符，否则「收敛」只是把查询清空
  const entityHasSubstance = entity.replace(/[^\w\u3400-\u9fff]/g, "").length >= 2;

  let primary: PlannedQuery;
  if (!original) {
    primary = { query: "", rationale: "空查询，无检索计划。", strategy: "verbatim" };
  } else if (compacted && compacted !== original && preservesContent(original, compacted)) {
    primary = {
      query: compacted,
      strategy: "compacted",
      rationale: `已去除对话填充词：查询收敛为「${compacted}」，避免召回被问答聚合页带偏。`
    };
  } else {
    primary = {
      query: original,
      strategy: "verbatim",
      rationale: "查询已足够聚焦，保持原始表述下发。"
    };
  }

  const maxRefinements = Math.max(0, Math.min(options.maxRefinements ?? 2, 3));
  const seen = new Set<string>([queryKey(primary.query)]);
  const refinements: PlannedQuery[] = [];

  if (entityHasSubstance) {
    for (const facet of facets) {
      if (refinements.length >= maxRefinements) break;
      if (!facet) continue;
      const refined = `${entity} ${facet}`.trim();
      const key = queryKey(refined);
      if (seen.has(key)) continue;
      seen.add(key);
      refinements.push({
        query: refined,
        facet,
        strategy: "compacted",
        rationale: `意图为「${INTENT_LABELS[intent]}」，补检面「${facet}」用于补齐主线查询未覆盖的证据。`
      });
    }
  }

  return { understanding, primary, refinements };
}

// ============================================================
// 3. 证据评估
// ============================================================

export interface EvidenceAssessment {
  level: SearchHitLevel;
  resultCount: number;
  /** 通过实体门控的结果数（真正在讲用户那件事的条数） */
  entityMatchedCount: number;
  entityCoverage: number;
  /** 官方 / 文档 / 学术类权威源条数 */
  authoritativeCount: number;
  domains: string[];
  /** 整池都没有覆盖到的实体词项（真实缺口） */
  missingTerms: string[];
  shouldRefine: boolean;
  reason: string;
}

/**
 * 实体门控：一条结果要「算数」，必须真的在讲查询主体。
 *
 * 判定用实体词项的**加权覆盖**（拉丁词项视为技术主体词，权重 2；CJK 二元组权重 1），
 * 阈值取 0.4 —— 这是偏宽松的刻意选择：
 *   · 它不是最终排序（排序由 retrievalRanker 的质量地板与权威先验负责），
 *     只用来回答「证据够不够，要不要再搜一次」；
 *   · 阈值收紧会把「Kubernetes 官方文档」这种标题里只有 kubeadm/cluster
 *     而实体词出现在正文摘要里的结果误判为不相关，从而触发无意义的补检。
 * 宁可多搜一次，也不要因为一次误判就认定证据不足。
 */
const ENTITY_GATE_THRESHOLD = 0.4;

/**
 * 实体门控判定：加权覆盖率达标（≥ 0.4）**且**至少命中一个拉丁主体词项。
 *
 * 「至少一个拉丁命中」这一条是必须的：纯比率判定会被修饰词骗过 ——
 * 查询「Nginx 反向代理配置」时，一篇《Apache 反向代理配置》能命中
 * reverseproxy / configuration 等全部修饰词项，覆盖率高得足以过线，
 * 但它压根没提 Nginx。页面连主体词都不出现，就不算「在讲用户要找的东西」；
 * 这正是 retrievalRanker 里「主体词门控」的同一思路，只是这里的代价更轻（只触发补检）。
 */
function passesEntityGate(docTerms: Set<string>, latinTerms: string[], cjkTerms: string[]): boolean {
  let total = 0;
  let hit = 0;
  let latinHits = 0;
  for (const term of latinTerms) {
    total += 2;
    if (docTerms.has(term)) {
      hit += 2;
      latinHits++;
    }
  }
  for (const term of cjkTerms) {
    total += 1;
    if (docTerms.has(term)) hit += 1;
  }
  if (total === 0) return true;
  if (latinTerms.length > 0 && latinHits === 0) return false;
  return hit / total >= ENTITY_GATE_THRESHOLD;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export const MIN_SOURCES_TARGET = 7;

/** 评估一批结果是否足以支撑回答；输出**可解释的缺口**而不只是布尔值 */
export function assessEvidence(results: SearchResult[], plan: SearchPlan): EvidenceAssessment {
  const { latinTerms, cjkTerms } = plan.understanding;
  const usable = (results || []).filter((item) => item && item.url && item.title);

  const coveredTerms = new Set<string>();
  let entityMatchedCount = 0;
  let authoritativeCount = 0;
  const domains: string[] = [];

  for (const item of usable) {
    const docTerms = canonicalTermSet(`${item.title} ${item.snippet || ""}`);
    for (const term of [...latinTerms, ...cjkTerms]) {
      if (docTerms.has(term)) coveredTerms.add(term);
    }
    const matched = passesEntityGate(docTerms, latinTerms, cjkTerms);
    if (!matched) continue;
    entityMatchedCount++;
    const host = hostOf(item.url);
    const sourceType: SearchSourceType = classifySourceType(host, item.url);
    if (sourceType === "official" || sourceType === "documentation" || sourceType === "academic") {
      authoritativeCount++;
    }
    const domain = item.displayDomain || host;
    if (domain && !domains.includes(domain)) domains.push(domain);
  }

  // 缺口要报「词」，不要报「碎片」：
  // 中文分词会产出「量子 / 子场 / 场调」这类二元组，它们全是「量子场调制器」的碎片，
  // 一并列出会盖住真正需要补检的实体词。因此先还原成原词，再去掉已包含在其他词项里的碎片。
  const missingDisplays = Array.from(
    new Set(
      [...latinTerms, ...cjkTerms]
        .filter((term) => !coveredTerms.has(term))
        .map((term) => plan.understanding.displayTerms[term] || term)
    )
  );
  const missingTerms = missingDisplays
    .filter((term) => !missingDisplays.some((other) => other !== term && other.includes(term)))
    .slice(0, 5);

  const level = resolveHitLevel(entityMatchedCount);
  const coverage = usable.length > 0 ? entityMatchedCount / usable.length : 0;
  const shouldRefine = usable.length === 0 || level !== "hit" || authoritativeCount === 0;

  let reason: string;
  if (usable.length === 0) {
    reason = "多路检索未召回任何结果，需要更换表述补检。";
  } else if (level === "hit") {
    reason = `实体命中 ${entityMatchedCount} 条（权威源 ${authoritativeCount} 条），证据充分。`;
  } else {
    reason = `实体命中仅 ${entityMatchedCount} 条（共 ${usable.length} 条候选，权威源 ${authoritativeCount} 条），证据不足。`;
  }
  if (shouldRefine && missingTerms.length > 0) {
    reason += ` 未被任何结果覆盖的词项：${missingTerms.join(" / ")}。`;
  }

  return {
    level,
    resultCount: usable.length,
    entityMatchedCount,
    entityCoverage: Number(coverage.toFixed(3)),
    authoritativeCount,
    domains: domains.slice(0, 5),
    missingTerms,
    shouldRefine,
    reason
  };
}

// ============================================================
// 4. 精确观测：给模型看的那一份摘要
// ============================================================

export interface ObservationResult {
  id: string;
  title: string;
  url: string;
  domain: string;
  sourceType: SearchSourceType;
  entityMatched: boolean;
  snippet: string;
}

export interface SearchObservation {
  plannedQuery: string;
  intent: QueryIntent;
  intentLabel: string;
  entity: string;
  evidence: {
    level: SearchHitLevel;
    resultCount: number;
    entityMatchedCount: number;
    authoritativeCount: number;
    domains: string[];
    missingTerms: string[];
  };
  results: ObservationResult[];
  suggestedQueries: string[];
  notice: string;
}

/**
 * 把召回压缩成模型真正需要的那几行。
 *
 * 为什么这件事本身就是「提升精度」：模型的下一步推理完全取决于它看到的观测。
 * 旧实现把整坨结果 JSON（十几条 + 诊断字段）原样回灌，信号被噪声淹没，
 * 模型既判断不出「能不能作答」，也想不出「该补搜什么」，只能重复发同一条查询。
 * 这里只交出：实体命中的结果、缺失的词项、以及下一步该搜什么。
 */
export function buildSearchObservation(
  query: string,
  results: SearchResult[],
  options: { plan?: SearchPlan; maxResults?: number; snippetChars?: number } = {}
): SearchObservation {
  const plan = options.plan ?? planSearchQueries(query);
  const maxResults = Math.max(1, options.maxResults ?? 6);
  const snippetChars = Math.max(40, options.snippetChars ?? 420);
  const assessment = assessEvidence(results, plan);

  const all = (results || []).filter((item) => item && item.url && item.title);
  const matched = all.filter((item) => {
    const docTerms = canonicalTermSet(`${item.title} ${item.snippet || ""}`);
    return passesEntityGate(docTerms, plan.understanding.latinTerms, plan.understanding.cjkTerms);
  });
  // 实体命中的排前面，但仍保留少量未命中项：它们可能是权威源但表述跨语言，
  // 交给模型自己判断是否弃用，比在这里硬砍掉更安全（避免把唯一可用证据切掉）。
  const ordered = [...matched, ...all.filter((item) => !matched.includes(item))].slice(0, maxResults);

  const observations: ObservationResult[] = ordered.map((item) => {
    const host = hostOf(item.url);
    return {
      id: item.id,
      title: (item.title || "").replace(/\s+/g, " ").trim().slice(0, 160),
      url: item.url,
      domain: item.displayDomain || host,
      sourceType: classifySourceType(host, item.url),
      entityMatched: matched.includes(item),
      snippet: (item.snippet || "").replace(/\s+/g, " ").trim().slice(0, snippetChars)
    };
  });

  // 证据不足时，观测里必须同时给出三件事：缺口在哪、下一步搜什么、以及「搜不到就不许编」。
  // 只说「证据不足」而不给下一步，模型的下一个动作往往是重复同一句查询或直接作答；
  // 而少了最后那句禁制，它就会用常识把缺口自行填上 —— 那正是最不精准的输出。
  const notice = assessment.shouldRefine
    ? [
        `证据评估：${assessment.level === "no_hit" ? "无命中" : "部分命中"} —— ${assessment.reason}`,
        plan.refinements.length > 0
          ? `下一步：先调用 search_web 补检 [${plan.refinements.map((r) => `"${r.query}"`).join(", ")}]，再作答。`
          : "下一步：更换表述补检。",
        "补检仍无覆盖时，必须明确说明证据不足，不得推测。"
      ].join("\n")
    : `证据评估：命中 —— ${assessment.reason} 可以基于下列结果作答，并保留 [id] 引用；不得引入未出现在结果中的事实。`;

  return {
    plannedQuery: plan.primary.query,
    intent: plan.understanding.intent,
    intentLabel: plan.understanding.intentLabel,
    entity: plan.understanding.entity,
    evidence: {
      level: assessment.level,
      resultCount: assessment.resultCount,
      entityMatchedCount: assessment.entityMatchedCount,
      authoritativeCount: assessment.authoritativeCount,
      domains: assessment.domains,
      missingTerms: assessment.missingTerms
    },
    results: observations,
    suggestedQueries: assessment.shouldRefine ? plan.refinements.map((r) => r.query) : [],
    notice
  };
}

// ============================================================
// 5. 工具入参准备：把模型下发的查询补成「精准检索请求」
// ============================================================

export interface RawSearchArguments {
  query: string;
  limit?: number;
  language?: string;
  domains?: string[];
  recencyDays?: number;
}

export interface PreparedSearchArguments {
  args: RawSearchArguments;
  plan: SearchPlan;
  /** 需要如实告诉用户/前端「Agent 做了什么调整」的说明（为空表示无需说明） */
  notes: string[];
}

/**
 * 规范化模型下发的 search_web 参数。
 *
 * 两条精确化规则，全部**只做收窄、不做改写**：
 *   1. 查询去填充词（收敛不安全时保持原样，见 preservesContent）；
 *   2. 模型没给 language / recencyDays 时，按查询语言与时效意图补上 ——
 *      少了 language，SearXNG 会跨语种乱捞；少了时效窗口，排序无法优先近期内容。
 * 用户显式传入的 domains / recencyDays 一律不被覆盖。
 */
export function prepareSearchArguments(raw: RawSearchArguments): PreparedSearchArguments {
  const plan = planSearchQueries(raw.query, { language: raw.language });
  const notes: string[] = [];
  const args: RawSearchArguments = { ...raw, query: plan.primary.query || raw.query };

  if (plan.primary.strategy === "compacted" && args.query !== raw.query) {
    notes.push(`查询已收敛：原始「${raw.query}」→ 检索「${args.query}」（${plan.primary.rationale}）`);
  }

  if (!raw.language && plan.understanding.language) {
    args.language = plan.understanding.language;
  }

  if (raw.recencyDays === undefined && plan.understanding.recencyDays !== undefined) {
    args.recencyDays = plan.understanding.recencyDays;
    notes.push(`意图为「${plan.understanding.intentLabel}」，已按 ${args.recencyDays} 天时效窗口优先近期信源。`);
  }

  return { args, plan, notes };
}

// ============================================================
// 6. 受控补检编排
// ============================================================

export interface ReasonedSearchRequest {
  query: string;
  limit: number;
  language?: string;
  recencyDays?: number;
}

export interface ReasonedSearchDeps {
  /** 单次真实检索（由调用方注入，便于测试注入桩实现） */
  search: (request: ReasonedSearchRequest) => Promise<SearchResult[]>;
  emitReasoning?: (content: string, details?: string[]) => void;
  limit?: number;
  language?: string;
  recencyDays?: number;
  /** 补检轮数上限，默认 1；0 表示只做主查询 */
  maxRefinementRounds?: number;
  /** 已有候选（模型自己搜过的结果）：只补检缺口，不重复主查询 */
  initialResults?: SearchResult[];
  /**
   * 上一轮已经真实下发过主查询（哪怕一条都没召回）：此时不再重发同一条查询，
   * 只评估现状并补检缺口。
   *
   * 为什么特别区分「零结果」：外部检索完全没召回时，旧行为会把同一条查询
   * 原样再发一次 —— 同一次对话里重复同一个请求既浪费时间，也提不到任何新证据。
   */
  skipPrimary?: boolean;
  allowEncyclopedia?: boolean;
  maxPerDomain?: number;
}

export interface ReasonedSearchRound {
  index: number;
  kind: "existing" | "primary" | "refinement";
  query: string;
  rationale: string;
  resultCount: number;
  assessment: EvidenceAssessment;
  error?: string;
}

export interface ReasonedSearchOutcome {
  plan: SearchPlan;
  rounds: ReasonedSearchRound[];
  /** 合并去重 + 重排后的最终信源集 */
  results: SearchResult[];
  assessment: EvidenceAssessment;
  refined: boolean;
  executedQueries: string[];
}

export const DEFAULT_MAX_REFINEMENT_ROUNDS = 1;

/**
 * 带证据评估的受控补检循环。
 *
 * 三条硬约束（与既有检索稳定性要求一致）：
 *   · 预算有上限：一轮主查询 + 至多 maxRefinementRounds 轮补检，绝不无限搜；
 *   · 达标即停：评估一旦为 hit（且已有权威源）立刻停止补检；
 *   · 合并后统一重排：补检结果与主查询结果走同一条 URL 归一化去重 + 共识加权重排，
 *     因此「同一页面被主查询与补检同时召回」会自然获得共识加分，而不是各排各的。
 */
export async function executeReasonedSearch(
  query: string,
  deps: ReasonedSearchDeps
): Promise<ReasonedSearchOutcome> {
  const plan = planSearchQueries(query, { language: deps.language });
  const limit = Math.max(1, deps.limit ?? 14);
  const emit = deps.emitReasoning ?? (() => { /* 无事件订阅时静默 */ });

  const pools: CandidatePool[] = [];
  const rounds: ReasonedSearchRound[] = [];
  const executedQueries: string[] = [];

  const rerank = (): SearchResult[] => {
    const ranked = rankSearchPools(pools, {
      query: plan.primary.query || plan.understanding.original,
      limit,
      maxPerDomain: deps.maxPerDomain ?? 2,
      allowEncyclopedia: deps.allowEncyclopedia ?? plan.understanding.allowEncyclopedia,
      recencyWindowDays: plan.understanding.recencyDays
    });
    if (ranked.results.length > 0) return ranked.results;
    // 质量地板之下的候选可能被清空。此时宁可把「分数未达标的候选」如实交给上层，
    // 也不返回空集 —— 否则 Agent 会把「排序保守」误判成「外部检索完全不可用」，
    // 进而不作答。排序结论与「是否有货」是两件事。
    return mergeCandidatePools(pools).map((candidate) => candidate.result).slice(0, limit);
  };

  const runRound = async (
    planned: PlannedQuery,
    kind: "primary" | "refinement",
    index: number
  ): Promise<EvidenceAssessment> => {
    let results: SearchResult[] = [];
    let error: string | undefined;
    try {
      const fetched = await deps.search({
        query: planned.query,
        limit,
        language: deps.language ?? plan.understanding.language,
        recencyDays: deps.recencyDays ?? plan.understanding.recencyDays
      });
      results = Array.isArray(fetched) ? fetched.filter(Boolean) : [];
      executedQueries.push(planned.query);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    pools.push({ source: kind === "primary" ? "agent_primary" : `agent_refinement_${index}`, results });
    const merged = rerank();
    const assessment = assessEvidence(merged, plan);

    rounds.push({
      index,
      kind,
      query: planned.query,
      rationale: planned.rationale,
      resultCount: results.length,
      assessment,
      error
    });

    emit(
      kind === "primary"
        ? `主查询「${planned.query}」→ 召回 ${results.length} 条；${assessment.reason}`
        : `补检「${planned.query}」→ 新增召回 ${results.length} 条；${assessment.reason}`,
      [
        error ? `检索失败：${error}` : `检索式：${planned.query}`,
        `命中级别：${assessment.level}（实体命中 ${assessment.entityMatchedCount} / 候选 ${assessment.resultCount}）`,
        `权威源：${assessment.authoritativeCount} 条；信源域：${assessment.domains.join(", ") || "无"}`,
        assessment.missingTerms.length > 0 ? `缺口词项：${assessment.missingTerms.join(" / ")}` : "无缺口词项"
      ]
    );

    return assessment;
  };

  emit(
    `检索计划：意图「${plan.understanding.intentLabel}」，核心实体「${plan.understanding.entity}」`,
    [
      plan.primary.strategy === "compacted"
        ? `查询收敛：${plan.understanding.original} → ${plan.primary.query}`
        : `主查询：${plan.primary.query}`,
      `补检面：${plan.refinements.map((r) => r.facet).filter(Boolean).join(" / ") || "无"}`,
      plan.understanding.recencyDays ? `时效窗口：${plan.understanding.recencyDays} 天` : "时效窗口：默认"
    ]
  );

  let assessment: EvidenceAssessment;
  let roundIndex = 0;
  const initial = (deps.initialResults ?? []).filter(Boolean);

  if (deps.skipPrimary || initial.length > 0) {
    pools.push({ source: "agent_existing", results: initial });
    const merged = rerank();
    assessment = assessEvidence(merged, plan);
    rounds.push({
      index: roundIndex++,
      kind: "existing",
      query: plan.primary.query,
      rationale: deps.skipPrimary
        ? "主查询已实际下发过，不重复请求；直接评估现有候选并补检缺口。"
        : "复用本轮已获取的候选，只补检缺口。",
      resultCount: initial.length,
      assessment
    });
    emit(`已有候选 ${initial.length} 条：${assessment.reason}`, [
      `命中级别：${assessment.level}（实体命中 ${assessment.entityMatchedCount}）`,
      assessment.missingTerms.length > 0 ? `缺口词项：${assessment.missingTerms.join(" / ")}` : "无缺口词项"
    ]);
  } else {
    assessment = await runRound(plan.primary, "primary", roundIndex++);
  }

  const budget = Math.max(0, deps.maxRefinementRounds ?? DEFAULT_MAX_REFINEMENT_ROUNDS);
  let refinementUsed = 0;
  while (assessment.shouldRefine && refinementUsed < budget && refinementUsed < plan.refinements.length) {
    const planned = plan.refinements[refinementUsed];
    refinementUsed++;
    assessment = await runRound(planned, "refinement", roundIndex++);
  }

  if (assessment.shouldRefine) {
    emit(
      `补检预算已用尽，仍存在证据缺口：${assessment.missingTerms.join(" / ") || "实体覆盖不足"}。将如实标注证据边界，不做推测。`
    );
  }

  const results = rerank();
  const finalAssessment = assessEvidence(results, plan);
  return {
    plan,
    rounds,
    results,
    assessment: finalAssessment,
    refined: rounds.some((round) => round.kind === "refinement"),
    executedQueries
  };
}
