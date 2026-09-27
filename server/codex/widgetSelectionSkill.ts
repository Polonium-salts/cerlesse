/**
 * 小组件选型技能包 (Widget Selection Skill Pack) —— 确定性证据选型内核
 * ====================================================================
 * 职责：
 * 在 Codex 单 Agent 未完成足够小组件绑定时，依据「Extension Catalog 画像 + 检索证据」
 * 确定性地补齐 prepare_widget 绑定，并输出全量证据排序榜单供前端按相关度补位。
 *
 * 架构约束（AGENTS.md）：
 * - 这不是第二个 LLM/规划器/路由器，而是注册表驱动的确定性技能内核；
 * - 组件候选 100% 来自 Extension Catalog（唯一真理来源），绝不发明组件 ID；
 * - 选型理由必须可追溯：命中关键词、识别意图与信源证据都会显式返回。
 *
 * 判定口径与前端 applicability 网关保持一致：
 * 垂直组件（天气/翻译/搜索引擎/Token/排查/对比/导图/地图）只认明确查询意图；
 * 图集组件认真实图片证据（配图返回 / 信源缩略图）或明确图片意图；
 * 要点卡要求信源充足且要点数据可产出（已有分点答案，或后续会自动生成分点回答）。
 */

import { getExtensionCatalog } from "../../src/widgets/registry/extensionCatalog.js";

export const WIDGET_SELECTION_SKILL_VERSION = "1.0.0";

/** 证据上下文：Codex 单 Agent 的检索产出（信源 / 配图 / 已生成答案） */
export interface WidgetEvidenceSource {
  id?: string;
  title?: string;
  snippet?: string;
  url?: string;
  thumbnail?: string;
  isOfficial?: boolean;
}

export interface WidgetEvidenceImage {
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface WidgetEvidenceInput {
  query: string;
  sources?: WidgetEvidenceSource[];
  images?: WidgetEvidenceImage[];
  /** 模型已完成最终回答时传入；为空表示后续会由信源自动生成分点式回答 */
  finalAnswer?: string;
}

export interface WidgetSelectionSkillResult {
  /** 本次应绑定的小组件（含常驻锚点与要点卡），不超过激活上限 */
  selected: string[];
  /** 全量证据排序榜单（含储备位），供前端在启用数量不足时按相关度补位 */
  ranking: string[];
  /** 从查询词中识别出的规范意图 */
  matchedIntents: string[];
  /** 每个组件命中的证据关键词（用于可审计的选型理由与信源关联） */
  matchedKeywords: Record<string, string[]>;
}

// —— 意图判定正则：与前端 applicability 网关同一判定口径 ——

const WEATHER_INTENT_REGEX = /(天气|气象|气温|下雨|下雪|降水|温度|穿衣|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i;
const TRANSLATION_INTENT_REGEX = /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i;
const SEARCH_ENGINE_INTENT_REGEX = /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|搜一下|全网搜|搜索直达|快速搜索)/i;
const TOKEN_USAGE_INTENT_REGEX = /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i;
const TROUBLESHOOTING_INTENT_REGEX = /(报错|异常|失败|无法启动|解决办法|排查|崩溃|bug|修不好|\b(error|exception|crash|failed|warning|troubleshoot|fix|debug|resolve)\b)/i;
const MINDMAP_INTENT_REGEX = /(架构|原理|底层|机制|体系|全景|知识图谱|思维导图|学习路线|生命周期|内部机制|工作原理|\b(architecture|internals|mechanism|how it works|roadmap|overview|pipeline|lifecycle|deep dive)\b)/i;
const COMPARISON_INTENT_REGEX = /(对比|区别|优缺点|哪个好|选哪个|怎么选|还是|好还是|优劣|差别|pk|\b(vs|versus|difference|compare|comparison|pros and cons|better)\b)/i;
const IMAGE_INTENT_REGEX = /(图片|照片|图集|图库|壁纸|图片素材|长什么样|外观图|外观|photo|image|picture|gallery|wallpaper)/i;
const TRAVEL_INTENT_REGEX = /(旅游|旅行|景点|行程|攻略|地图|路线|导航|周边|travel|trip|itinerary)/i;
const NEWS_INTENT_REGEX = /(新闻|资讯|热点|最新|动态|进展|发布|快讯|要闻|news)/i;
const DOWNLOAD_INTENT_REGEX = /(下载|安装|安装包|installer|download|dmg|exe|pkg|msi|release)/i;
const GITHUB_INTENT_REGEX = /(github|gitlab|仓库|开源项目|repo|源码|git\s*clone)/i;
const TOOL_INTENT_REGEX = /(工具|替代品|alternative|好用|推荐工具)/i;

/** 常驻锚点：由 Manifest presence='resident' 决定（ai_answer 智能速答 + sources 信源溯源存证 + image_gallery 视觉图集，不走意图打分） */
export const RESIDENT_WIDGET_IDS = ["ai_answer", "sources", "image_gallery"] as const;
export const ALWAYS_ON_WIDGET_IDS = RESIDENT_WIDGET_IDS;

/** 单次绑定上限（与 WIDGET_ACTIVATION_POLICY.max 对齐，避免跨模块循环依赖） */
const ACTIVATION_MAX = 10;
/** 排序榜单上限：前段为绑定结果，后段为相关度储备位 */
const RANKING_CAP = 14;
/** 语料文本上限：只取前若干条信源的标题/摘要/URL，控制成本 */
const CORPUS_SOURCE_LIMIT = 10;
const CORPUS_CHAR_LIMIT = 8000;

/**
 * 查询词 → 规范意图集合（用于与 Catalog.intents 求交集打分）
 */
const INTENT_TRIGGERS: Array<{ intents: string[]; regex: RegExp }> = [
  { intents: ["weather"], regex: WEATHER_INTENT_REGEX },
  { intents: ["translation"], regex: TRANSLATION_INTENT_REGEX },
  { intents: ["search_engine_portal", "portal_navigation"], regex: SEARCH_ENGINE_INTENT_REGEX },
  { intents: ["troubleshooting"], regex: TROUBLESHOOTING_INTENT_REGEX },
  { intents: ["tech_comparison"], regex: COMPARISON_INTENT_REGEX },
  { intents: ["resource_search"], regex: IMAGE_INTENT_REGEX },
  { intents: ["travel"], regex: TRAVEL_INTENT_REGEX },
  { intents: ["software_download"], regex: DOWNLOAD_INTENT_REGEX },
  { intents: ["github_project"], regex: GITHUB_INTENT_REGEX },
  { intents: ["tool_discovery"], regex: TOOL_INTENT_REGEX },
  { intents: ["study_tutorial"], regex: /(教程|怎么用|学习|入门|上手|tutorial|how to)/i },
  { intents: ["concept_explanation", "research"], regex: /(是什么|为什么|如何|原理|介绍|解释|含义|分析|总结)/i },
  { intents: ["general_knowledge"], regex: NEWS_INTENT_REGEX }
];

function deriveMatchedIntents(query: string): string[] {
  const intents: string[] = [];
  for (const trigger of INTENT_TRIGGERS) {
    if (trigger.regex.test(query)) {
      intents.push(...trigger.intents);
    }
  }
  return Array.from(new Set(intents));
}

/** 判断文本是否包含分点/列表行（要点卡的数据将来自这些行） */
function hasBulletLines(text?: string): boolean {
  if (!text) return false;
  return /(^|\n)\s*(?:[-*•]|\d+[.)])\s+/.test(text);
}

function buildCorpusText(sources: WidgetEvidenceSource[]): string {
  return sources
    .slice(0, CORPUS_SOURCE_LIMIT)
    .map(s => `${s.title || ""} ${s.snippet || ""} ${s.url || ""}`)
    .join(" \n ")
    .slice(0, CORPUS_CHAR_LIMIT)
    .toLowerCase();
}

/**
 * 垂直/数据门槛：只有存在明确意图或真实可核验证据时才允许组件上桌。
 * 与前端 evaluateWidgetApplicability 的约束互相呼应，避免服务端选出前端必砍的组件。
 */
function passesEvidenceGate(
  id: string,
  input: WidgetEvidenceInput,
  corpus: string,
  matchedIntents: string[]
): boolean {
  const q = (input.query || "").trim();
  const sources = input.sources || [];
  const images = input.images || [];

  switch (id) {
    case "weather":
    case "translation":
    case "search_engine":
    case "token_usage":
    case "troubleshooting":
    case "verification_checklist":
    case "comparison":
    case "mindmap": {
      const gateRegex =
        id === "weather" ? WEATHER_INTENT_REGEX
        : id === "translation" ? TRANSLATION_INTENT_REGEX
        : id === "search_engine" ? SEARCH_ENGINE_INTENT_REGEX
        : id === "token_usage" ? TOKEN_USAGE_INTENT_REGEX
        : id === "troubleshooting" || id === "verification_checklist" ? TROUBLESHOOTING_INTENT_REGEX
        : id === "comparison" ? COMPARISON_INTENT_REGEX
        : MINDMAP_INTENT_REGEX;
      return gateRegex.test(q);
    }

    case "image_gallery":
      // 视觉图集作为常驻核心视效组件：有配图/缩略图/意图时直出，无图时展示空态检索入口
      return true;

    case "takeaways":
      // 要点卡要求：信源充足，且要点数据可产出（已有分点答案，或后续自动生成分点回答）
      return sources.length >= 3 && (!input.finalAnswer || hasBulletLines(input.finalAnswer));

    case "map":
      return TRAVEL_INTENT_REGEX.test(q) || /(地图|位置|导航|周边|景点)/i.test(q);

    case "news_feed":
      return NEWS_INTENT_REGEX.test(q);

    case "trend_chart":
      return /(趋势|走势|增长|曲线|trend|chart)/i.test(q);

    case "document_preview":
      return /(论文|白皮书|规范|手册|文献|研报|pdf|rfc|文档)/i.test(q);

    case "code_playground":
      return /(代码|示例代码|运行代码|snippet|playground|编译|调试)/i.test(q);

    case "repository":
      // 查询明确指向开源仓库，或检索结果中出现真实 GitHub 仓库证据
      return GITHUB_INTENT_REGEX.test(q)
        || sources.some(s => (s.url || "").includes("github.com"));

    case "download":
      return matchedIntents.includes("software_download")
        || /(下载|安装|安装包)/i.test(q)
        || sources.some(s => /(releases|\/download|\.dmg|\.exe|\.pkg|\.msi)/i.test(s.url || ""));

    case "software_info":
      return /(软件|版本|平台|开发者|许可证|license|version|software)/i.test(q)
        || matchedIntents.includes("software_download");

    case "actions_toolbox":
      return matchedIntents.includes("software_download")
        || matchedIntents.includes("troubleshooting");

    case "tool_discovery":
      return TOOL_INTENT_REGEX.test(q) || matchedIntents.includes("tool_discovery");

    default:
      // 其余通用组件不设额外门槛，但仍需通过关键词/意图/语料评分才可入选
      return true;
  }
}

interface ScoredCandidate {
  id: string;
  score: number;
  keywords: string[];
  reason: string;
}

function scoreCatalogCandidates(
  input: WidgetEvidenceInput,
  corpus: string,
  matchedIntents: string[],
  excludeIds: Set<string>
): { passed: ScoredCandidate[]; rejected: Array<{ id: string; reason: string }> } {
  const q = (input.query || "").toLowerCase().trim();
  const passed: ScoredCandidate[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];

  for (const entry of getExtensionCatalog()) {
    if (excludeIds.has(entry.id)) continue;
    if (entry.agent?.selectable === false) continue;

    const queryKw = entry.keywords.filter(k => q.includes(k.toLowerCase()));
    const corpusKw = entry.keywords.filter(k => corpus.includes(k.toLowerCase()));
    const exampleHit = entry.examples.some(ex => {
      const e = ex.toLowerCase().trim();
      return e.length >= 4 && (q.includes(e) || e.includes(q));
    });
    const intentOverlap = entry.intents.filter(i => matchedIntents.includes(i));

    // 垂直窄门组件：若命中门槛正则但缺乏画像证据，只作储备位（进入 ranking 不进入绑定）
    const gatedButUnsupported =
      (entry.id === "search_engine" && SEARCH_ENGINE_INTENT_REGEX.test(input.query || "") && queryKw.length === 0 && intentOverlap.length === 0)
      || (entry.id === "weather" && WEATHER_INTENT_REGEX.test(input.query || "") && queryKw.length === 0 && intentOverlap.length === 0);

    // 降噪门槛：至少要有查询关键词、意图命中，或两条以上语料关键词证据（image_gallery 具备视效支撑，免于纯文字降噪过滤）
    if (entry.id !== "image_gallery" && queryKw.length === 0 && intentOverlap.length === 0 && corpusKw.length < 2) {
      continue;
    }

    if (gatedButUnsupported) {
      // 记为储备位：榜单中排在绑定结果之后，前端启用数不足时才可能补上
      passed.push({ id: entry.id, score: 1, keywords: [], reason: "查询意图命中但画像证据不足（储备位）" });
      continue;
    }

    // 负向意图：查询命中该组件明确不服务的意图时直接拒绝
    if (entry.negativeIntents && entry.negativeIntents.some(ni => matchedIntents.includes(ni))) {
      rejected.push({ id: entry.id, reason: "命中负向意图" });
      continue;
    }

    // 证据门槛：无明确意图或真实证据的垂直组件不上桌
    if (!passesEvidenceGate(entry.id, input, corpus, matchedIntents)) {
      rejected.push({ id: entry.id, reason: "缺少明确意图或可核验数据证据" });
      continue;
    }

    const score =
      queryKw.length * 3 +
      Math.min(corpusKw.length, 4) +
      (exampleHit ? 2 : 0) +
      intentOverlap.length * 2;
    const priorityBoost = (entry.agent?.priority ?? 80) / 100;

    const keywords = Array.from(new Set([...queryKw, ...corpusKw])).slice(0, 5);
    const reasonParts: string[] = [];
    if (queryKw.length > 0) reasonParts.push(`查询命中 [${queryKw.slice(0, 3).join(", ")}]`);
    if (intentOverlap.length > 0) reasonParts.push(`意图 ${intentOverlap.slice(0, 2).join("/")}`);
    if (corpusKw.length > 0) reasonParts.push(`信源语料证据 ${corpusKw.length} 处`);

    passed.push({
      id: entry.id,
      score: score * priorityBoost,
      keywords,
      reason: reasonParts.join(" · ") || "具备通用支撑能力"
    });
  }

  passed.sort((a, b) => b.score - a.score);
  return { passed, rejected };
}

/**
 * 小组件选型技能主入口：依据查询与检索证据给出「应绑定清单 + 证据排序榜单」。
 * 输出顺序即桌面阅读序：常驻锚点置顶，其余组件按证据相关度排列。
 */
export function selectWidgetsByEvidence(input: WidgetEvidenceInput): WidgetSelectionSkillResult {
  const matchedIntents = deriveMatchedIntents(input.query || "");
  const corpus = buildCorpusText(input.sources || []);

  const selected: string[] = [];
  const matchedKeywords: Record<string, string[]> = {};
  // 1. 常驻锚点：依据 Extension Catalog 的 presence === 'resident' 机制（ai_answer + sources，不走意图打分）
  const catalog = getExtensionCatalog();
  const catalogResidents = catalog.filter((c) => c.presence === "resident").map((c) => c.id);
  const residentIds = Array.from(new Set([...RESIDENT_WIDGET_IDS, ...catalogResidents]));
  const excludeIds = new Set<string>(residentIds);

  for (const anchor of residentIds) {
    selected.push(anchor);
  }

  // 2. 要点卡：满足数据门槛即入选（答案要点由信源分点行产出）
  if (passesEvidenceGate("takeaways", input, corpus, matchedIntents)) {
    selected.push("takeaways");
    excludeIds.add("takeaways");
  }

  // 3. 证据评分选型：Catalog 画像（关键词/意图/示例/负向意图）× 检索证据（查询 + 信源语料）
  const { passed } = scoreCatalogCandidates(input, corpus, matchedIntents, excludeIds);

  for (const candidate of passed) {
    if (selected.length >= ACTIVATION_MAX) break;
    selected.push(candidate.id);
    matchedKeywords[candidate.id] = candidate.keywords;
  }

  // 4. 排序榜单：绑定结果置顶，其余通过证据门槛的候选按相关度作为储备位
  const ranking: string[] = [];
  for (const id of [...selected, ...passed.map(c => c.id)]) {
    if (ranking.length >= RANKING_CAP) break;
    if (!ranking.includes(id)) ranking.push(id);
  }

  return {
    selected,
    ranking,
    matchedIntents,
    matchedKeywords
  };
}
