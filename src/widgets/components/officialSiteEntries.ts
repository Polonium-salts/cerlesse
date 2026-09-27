import type { SearchResult } from "../../types.js";

export interface OfficialSiteEntry {
  id: string;
  name: string;
  url: string;
  description: string;
  tag?: string;
  isOfficial?: boolean;
}

export interface OfficialSiteOptions {
  maxEntries?: number;
  minEntries?: number;
  allowSearchFallback?: boolean;
}

export const DEFAULT_MAX_OFFICIAL_ENTRIES = 6;
export const DEFAULT_MIN_OFFICIAL_ENTRIES = 0;

/** 意图修饰词模式：用于从主题中清洗掉"想要什么"，提取真正的品牌/实体主干 */
const INTENT_MODIFIER_PATTERN = /(官网|官方网站|官方平台|官方首页|主页|网址|网站|入口|登录|平台|下载|文档|教程|指南|攻略|对比|比较|区别|优缺点|哪个好|推荐|排行|评测|原理|架构|实现|排查|报错|修复|是什么|什么是|啥是|为什么|怎么样|如何|怎么|怎样|概念|入门|简介|official|website|site|homepage|portal|login|signin|download|docs|documentation|tutorial|guide|compare|vs|best|top|review|architecture|intro|what is|how to)/gi;

const COMMON_STOPWORDS = new Set([
  "的", "了", "是", "在", "和", "与", "或", "及", "对", "为", "把", "被", "让", "给", "从", "到",
  "the", "a", "an", "and", "or", "for", "to", "in", "on", "at", "is", "of", "with"
]);

/** 常见非品牌域名后缀与二段国别后缀 */
const COMMON_TLD_PARTS = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int", "io", "dev", "app", "ai", "co",
  "cn", "com.cn", "org.cn", "net.cn", "gov.cn", "edu.cn", "ac.cn",
  "uk", "co.uk", "org.uk", "ac.uk",
  "jp", "co.jp", "ne.jp", "ac.jp",
  "de", "fr", "ru", "ca", "au", "com.au", "in", "me", "cc", "tv", "xyz", "top", "site", "online", "tech", "info"
]);

/** 提取主机名的主要注册主干（eTLD+1 的主标签，如 docs.docker.com -> docker） */
function extractHostMainLabel(host: string): string {
  if (!host) return "";
  const clean = host.toLowerCase().replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length <= 1) return parts[0] || "";

  if (parts.length >= 3) {
    const twoPartSuffix = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (COMMON_TLD_PARTS.has(twoPartSuffix)) {
      return parts[parts.length - 3] || "";
    }
  }
  return parts[parts.length - 2] || "";
}

/**
 * 规范化精确匹配主机名与查询实体主体
 * 先剔除意图修饰词与停用词，再执行域名标签的精确对应，杜绝无意图关键词的任意子串误判
 */
function isDomainMatchingSubject(url: string, subject: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return false;

    // 1. 剔除意图修饰词
    const cleanedSubject = subject.replace(INTENT_MODIFIER_PATTERN, " ").trim();
    // 2. 提取核心实体词项
    const tokens = (cleanedSubject.match(/[a-z0-9\u4e00-\u9fa5]{2,}/gi) || [])
      .map((t) => t.toLowerCase())
      .filter((t) => !COMMON_STOPWORDS.has(t) && t.length >= 2);

    if (tokens.length === 0) return false;

    const mainLabel = extractHostMainLabel(host);
    const hostLabels = host.split(/[.\-]/).filter(Boolean);

    for (const token of tokens) {
      // 主干完全相等（如 token="docker", mainLabel="docker"）
      if (mainLabel === token) return true;

      // 忽略连字符相符（如 token="rustlang", mainLabel="rust-lang"）
      if (mainLabel.replace(/-/g, "") === token.replace(/-/g, "")) return true;

      // 某一主机段完全相等且长度至少为 3（如 docs.docker.com -> docker）
      if (hostLabels.some((hl) => hl === token && hl.length >= 3)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function getDomainAuthorityScore(url: string, title: string, subject: string, isOfficial?: boolean): number {
  let score = 0;
  if (isOfficial) score += 100;
  const isDirectMatch = isDomainMatchingSubject(url, subject);
  if (isDirectMatch) score += 80;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // 官方首页（根路径）额外权威提权
    if (pathname === "/" || pathname === "") {
      if (isDirectMatch) score += 50;
      else score += 15;
    }

    if (/docs\.|\/docs|documentation/.test(`${host}${pathname}`)) score += 40;
    if (/developer\.|dev\./.test(host)) score += 35;
    if (/\.(gov|edu|org)(\.[a-z]{2})?$/.test(host)) score += 30;
    if (/github\.com|gitee\.com|gitlab\.com/.test(host)) score += 25;
    if (/npmjs\.com|pypi\.org|hub\.docker\.com/.test(host)) score += 20;
  } catch {
    // ignore
  }

  return score;
}

function categorizeLink(title: string, url: string, subject: string, isOfficial?: boolean): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const isDirectMatch = isDomainMatchingSubject(url, subject);

  if (/github\.com|gitee\.com|gitlab\.com/.test(lowerUrl)) return "开源主页";
  if (/docs\.|\/docs|文档|documentation/.test(`${lowerUrl} ${lowerTitle}`)) return (isOfficial || isDirectMatch) ? "官方文档" : "文档页面";
  if (/developer\.|dev\./.test(lowerUrl)) return (isOfficial || isDirectMatch) ? "官方开发者中心" : "开发者页面";
  if (/npmjs\.com|pypi\.org|hub\.docker\.com/.test(lowerUrl)) return "软件发布页";
  if (isDirectMatch) return "官方网站";
  return isOfficial ? "已标记官方" : "检索结果";
}

function searchEntry(query: string, suffix: string, index: number): OfficialSiteEntry {
  const searchQuery = `${query} ${suffix}`.trim();
  return {
    id: `search_${index}`,
    name: `${query} ${suffix}`.trim(),
    url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
    description: `打开搜索结果查找「${query}」的${suffix}；此入口是搜索链接，不代表目标站点已核验。`,
    tag: "搜索入口",
    isOfficial: false
  };
}

/**
 * 构建官网及相关站点列表：
 * 1. 默认展示至多 6 条（支持可配置，后端有足量合格结果时充分展示）；
 * 2. 避免在存在真实结果时强行插入假搜索链接（searchEntry）；
 * 3. 仅在完全没有真实结果时才提供搜索入口兜底。
 */
export function buildOfficialSiteEntries(
  query: string,
  results: SearchResult[] = [],
  options?: number | OfficialSiteOptions
): OfficialSiteEntry[] {
  const maxEntries = typeof options === "number"
    ? options
    : options?.maxEntries ?? DEFAULT_MAX_OFFICIAL_ENTRIES;
  const minEntries = typeof options === "number"
    ? 0
    : options?.minEntries ?? DEFAULT_MIN_OFFICIAL_ENTRIES;

  const subject = query.trim() || "相关主题";
  const selected: OfficialSiteEntry[] = [];
  const seen = new Set<string>();

  const validResults = (results || []).filter((item) => {
    if (!item?.url) return false;
    try {
      const url = new URL(item.url);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });

  const prioritized = [...validResults].sort((a, b) => {
    const scoreA = getDomainAuthorityScore(a.url, a.title || "", subject, a.isOfficial);
    const scoreB = getDomainAuthorityScore(b.url, b.title || "", subject, b.isOfficial);
    return scoreB - scoreA;
  });

  for (const source of prioritized) {
    if (selected.length >= maxEntries || seen.has(source.url)) continue;
    seen.add(source.url);
    const title = (source.title || subject).replace(/<[^>]*>/g, "").trim();
    const isDirectMatch = isDomainMatchingSubject(source.url, subject);
    const effectivelyOfficial = Boolean(source.isOfficial || isDirectMatch);

    selected.push({
      id: `source_${selected.length}`,
      name: title || subject,
      url: source.url,
      description: (source.snippet || (effectivelyOfficial ? "域名权威度核验为目标官方主体站点。" : "来自本次检索的相关页面。"))
        .replace(/<[^>]*>/g, "").trim(),
      tag: categorizeLink(title, source.url, subject, source.isOfficial),
      isOfficial: effectivelyOfficial
    });
  }

  // 仅在真实结果不足指定 minEntries 或完全为空（0 条）时，才补充搜索入口兜底
  if (selected.length === 0 || selected.length < minEntries) {
    const searchFacets = ["官方网站", "官方文档", "官方服务入口"];
    const targetCount = selected.length === 0 ? Math.min(3, maxEntries) : minEntries;
    for (const facet of searchFacets) {
      if (selected.length >= targetCount) break;
      const entry = searchEntry(subject, facet, selected.length);
      if (!seen.has(entry.url)) {
        seen.add(entry.url);
        selected.push(entry);
      }
    }
  }

  return selected.slice(0, maxEntries);
}
