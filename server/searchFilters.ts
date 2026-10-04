/**
 * 用户侧检索筛选条件的入参规范化
 * ============================================================
 * 存在的理由：筛选条件会从多个入口进来（Express 的 GET / POST、EdgeOne 的
 * agent / agent.stream / agent.run、以及 URL query）。若每个入口各写一份解析，
 * 必然发生漂移 —— 有的入口接受 "zh,en" 这样的逗号串，有的只接受数组，
 * 最终表现为「同一个筛选条件在不同端点上生效方式不同」。
 * 因此解析与校验收敛到这一处，各入口只负责把原始值丢进来。
 *
 * 规范化原则（与 SearchFilters「未指定即不参与淘汰」一致）：
 *   · 无法解析的值一律**丢弃**，绝不猜一个默认值去改变结果集；
 *   · 全部字段都被丢弃时返回 undefined，等价于「本次没有筛选」。
 *
 * 本模块是纯函数、零 I/O，因此筛选入参的健壮性可以被单元测试完整覆盖。
 */

import { SearchFilters, SearchSourceType } from "../src/types.js";

/** 域名单一入口的条数上限：防止超长列表把检索变成一次全量枚举 */
const MAX_DOMAINS = 50;
/** 语言列表上限 */
const MAX_LANGUAGES = 10;
/** 新鲜度天数上限（约 10 年），超过则失去筛选意义 */
const MAX_FRESHNESS_DAYS = 3650;
/** 单次请求条数上限 */
const MAX_RESULTS_CAP = 100;

const VALID_SOURCE_TYPES: SearchSourceType[] = [
  "official",
  "academic",
  "documentation",
  "community",
  "media",
  "aggregator"
];

/** 把「数组 / 逗号分隔串 / 单值」统一成去空白的字符串数组 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/** 解析为 ISO 时间戳字符串；无法解析返回 undefined（不猜默认值） */
function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const ts = Date.parse(trimmed);
  if (!Number.isFinite(ts)) return undefined;
  return new Date(ts).toISOString();
}

/** 解析为正整数并夹到 [1, max]；非法值返回 undefined */
function toPositiveInt(value: unknown, max: number): number | undefined {
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.max(1, Math.floor(n)), max);
}

/**
 * 域名规范化：剥掉协议与 www、丢弃路径，只留主机名。
 * 过短的（如单个字符）与含非法字符的一律丢弃 —— 域名筛选是硬约束，
 * 一个畸形条目会静默清空所有结果，代价远大于放弃它。
 */
function normalizeDomains(value: unknown): string[] | undefined {
  const domains = toStringArray(value)
    .map((d) =>
      d
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .trim()
    )
    .filter((d) => d.length >= 3 && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(d));
  if (domains.length === 0) return undefined;
  return Array.from(new Set(domains)).slice(0, MAX_DOMAINS);
}

/** 来源类型：只接受白名单内的枚举值 */
function normalizeSourceTypes(value: unknown): SearchSourceType[] | undefined {
  const types = toStringArray(value)
    .map((t) => t.toLowerCase())
    .filter((t): t is SearchSourceType => (VALID_SOURCE_TYPES as string[]).includes(t));
  if (types.length === 0) return undefined;
  return Array.from(new Set(types));
}

/** 语言代码：统一小写，只保留看起来像语言标签的值 */
function normalizeLanguages(value: unknown): string[] | undefined {
  const langs = toStringArray(value)
    .map((l) => l.toLowerCase())
    .filter((l) => /^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(l));
  if (langs.length === 0) return undefined;
  return Array.from(new Set(langs)).slice(0, MAX_LANGUAGES);
}

/**
 * 把外部（可能不可靠的）入参规范化为 SearchFilters。
 *
 * 支持常见别名，因为 URL query 习惯用短名（after / before / limit / lang），
 * 而 POST body 习惯用完整名。两者都接受，避免调用方为了"能生效"而改传参形态。
 */
export function normalizeSearchFilters(input: unknown): SearchFilters | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;

  const filters: SearchFilters = {};

  const publishedAfter = toIsoDate(raw.publishedAfter ?? raw.after ?? raw.since);
  if (publishedAfter) filters.publishedAfter = publishedAfter;

  const publishedBefore = toIsoDate(raw.publishedBefore ?? raw.before ?? raw.until);
  if (publishedBefore) filters.publishedBefore = publishedBefore;

  const freshnessDays = toPositiveInt(
    raw.freshnessDays ?? raw.freshness ?? raw.days,
    MAX_FRESHNESS_DAYS
  );
  if (freshnessDays) filters.freshnessDays = freshnessDays;

  const includeDomains = normalizeDomains(raw.includeDomains ?? raw.domains ?? raw.sites);
  if (includeDomains) filters.includeDomains = includeDomains;

  const excludeDomains = normalizeDomains(
    raw.excludeDomains ?? raw.exclude ?? raw.blockDomains
  );
  if (excludeDomains) filters.excludeDomains = excludeDomains;

  const sourceTypes = normalizeSourceTypes(raw.sourceTypes ?? raw.sourceType ?? raw.sources);
  if (sourceTypes) filters.sourceTypes = sourceTypes;

  const languages = normalizeLanguages(raw.languages ?? raw.language ?? raw.lang);
  if (languages) filters.languages = languages;

  const maxResults = toPositiveInt(raw.maxResults ?? raw.limit, MAX_RESULTS_CAP);
  if (maxResults) filters.maxResults = maxResults;

  const minResults = toPositiveInt(raw.minResults ?? raw.min, MAX_RESULTS_CAP);
  if (minResults) filters.minResults = minResults;

  // 全部字段都没解析出来 → 视作没有筛选，而不是返回一个空对象
  // （空对象会让调用方误以为"用户指定了筛选"，进而触发不必要的筛选分支）
  return Object.keys(filters).length > 0 ? filters : undefined;
}

export interface AdCheckItem {
  title?: string;
  snippet?: string;
  url?: string;
}

const AD_URL_REGEX = /(?:bing\.com\/(?:aclick|ck\/a)|googleadservices\.com|googlesyndication\.com|doubleclick\.net|cpro\.baidu\.com|pos\.baidu\.com|union\.baidu\.com|e\.baidu\.com|adservice\.google|s\.click\.taobao\.com|union\.jd\.com|cps\.jd\.com|\/aclick|\bad_id=|\badurl=|\badclick\b|\bclick_id=|\bspm=|\bref=ad|\butm_medium=cpc|\butm_source=ad|\bp4p\b)/i;

const AD_DOMAIN_REGEX = /(?:^|\.)(?:ad|ads|adserver|affiliate|p4p|track|click|promote|advert)\.[a-z0-9\-]+$/i;

const AD_TITLE_OR_SNIPPET_REGEX = /(?:^|[【\[(（\s])(?:广告|商业推广|推广|赞助商?|AD|Sponsored|Advertisement|Ad)(?:[】\])）:：·\-\s]|$)|(?:广告推广|赞助商链接|商业赞助|商业推广链接|竞价推广|竞价排名|广告合作|广告位招租|广告投放|点击查看优惠|限时秒杀|立即抢购|立即购买|加微信|加V:|免费领取优惠券|招商加盟|免费加盟|专场特惠|全场包邮|正品低价.*点击选购|直降.*元|点击咨询|免费预约|官方正品.*点击购买)/i;

/**
 * 判断给定的检索结果是否属于广告、商业推广、竞价链接或追踪重定向
 */
export function isAdOrSpamResult(item: AdCheckItem): boolean {
  if (!item) return false;
  const url = (item.url || "").trim();
  if (url) {
    if (AD_URL_REGEX.test(url)) return true;
    try {
      const hostname = new URL(url).hostname;
      if (AD_DOMAIN_REGEX.test(hostname)) return true;
    } catch {
      // ignore malformed url
    }
  }
  const title = (item.title || "").trim();
  if (title && AD_TITLE_OR_SNIPPET_REGEX.test(title)) {
    return true;
  }
  const snippet = (item.snippet || "").trim();
  if (snippet && AD_TITLE_OR_SNIPPET_REGEX.test(snippet)) {
    return true;
  }
  return false;
}

/**
 * 清除文本中混杂的广告/推广标记或整段商业营销语
 */
export function sanitizeAdPrefix(text: string): string {
  if (!text) return "";
  let clean = text
    .replace(/^[【\[(（]?(?:广告|商业推广|推广|赞助商?|AD|Sponsored|Advertisement)[】\])）]?[:：·\-\s]+/i, "")
    .replace(/[【\[(（]?(?:广告|商业推广|推广|赞助商?|AD|Sponsored|Advertisement)[】\])）]?$/i, "")
    .replace(/[-*•]?\s*[【\[(（]?(?:广告|商业推广|推广|赞助商?)[】\])）][^\n]*/gi, "")
    .replace(/(?:点击查看优惠|限时秒杀|立即抢购|立即购买|加微信|加V:|免费领取优惠券|招商加盟|免费加盟|专场特惠)[^\n。！？]*/gi, "")
    .trim();
  return clean;
}
