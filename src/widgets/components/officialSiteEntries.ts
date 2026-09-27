import type { SearchResult } from "../../types.js";

export interface OfficialSiteEntry {
  id: string;
  name: string;
  url: string;
  description: string;
  tag?: string;
  isOfficial?: boolean;
}

const MIN_ENTRIES = 3;
const MAX_ENTRIES = 3;

function isDomainMatchingSubject(url: string, subject: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const tokens = subject.toLowerCase().match(/[a-z0-9\u4e00-\u9fa5]{2,}/g) || [];
    for (const token of tokens) {
      if (token.length >= 3 && host.includes(token)) return true;
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

/** Always return a compact, predictable list without presenting unverified links as official. */
export function buildOfficialSiteEntries(query: string, results: SearchResult[] = []): OfficialSiteEntry[] {
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
    if (selected.length >= MAX_ENTRIES || seen.has(source.url)) continue;
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

  const searchFacets = ["官方网站", "官方文档", "官方服务入口"];
  for (const facet of searchFacets) {
    if (selected.length >= MIN_ENTRIES) break;
    const entry = searchEntry(subject, facet, selected.length);
    if (!seen.has(entry.url)) {
      seen.add(entry.url);
      selected.push(entry);
    }
  }
  return selected.slice(0, MAX_ENTRIES);
}
