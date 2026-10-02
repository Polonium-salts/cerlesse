import { createHash } from "node:crypto";
import { SearchResult, SearchImage } from "../src/types.js";
import { normalizeUrlKey } from "./retrievalRanker.js";
import { acceptLanguageFor, toSearxngLanguage } from "./language.js";
import { collectWebSearchResults, WEB_SEARCH_MAX_SEARXNG_INSTANCES, WEB_SEARCH_RESULT_TARGET } from "./webSearchCollection.js";

export function generateStableSourceId(url: string): string {
  const norm = normalizeUrlKey(url);
  return "src-" + createHash("sha1").update(norm).digest("hex").slice(0, 10);
}

// Active, responsive SearXNG instances verified for JSON output
const VERIFIED_SEARXNG_INSTANCES = [
  "https://search.mectov.my.id",
  "https://baresearch.org",
  "https://searx.be",
  "https://search.ononoki.org",
  "https://searx.perennialte.ch",
  "https://priv.au"
];

/**
 * Read configured nodes from SEARXNG_URLS (comma/newline/space separated),
 * with SEARXNG_URL / SEARX_URL retained for backward compatibility.
 */
export function parseSearxngInstanceUrls(env?: Record<string, string | undefined>): string[] {
  const source = env !== undefined
    ? env
    : (typeof process !== "undefined" ? process.env : undefined);
  const configured = source?.SEARXNG_URLS?.trim();
  const rawUrls = configured
    ? configured.split(/[,;\s]+/)
    : [source?.SEARXNG_URL, source?.SEARX_URL]
        .filter((value): value is string => Boolean(value));
  const urls: string[] = [];
  for (const raw of rawUrls) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null") continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const normalized = trimmed.replace(/\/+$/, "");
      if (!urls.includes(normalized)) urls.push(normalized);
    } catch {
      // Ignore malformed instance URLs; the verified pool remains available.
    }
  }
  return urls;
}

function configuredInstanceUrls(customUrl?: string, env?: Record<string, string | undefined>): string[] {
  const custom = parseSearxngInstanceUrls({ SEARXNG_URLS: customUrl });
  return Array.from(new Set([...custom, ...parseSearxngInstanceUrls(env)]));
}

// In-memory blacklist of instances that recently failed with 403/429/timeout/crash
interface DeadInstanceRecord {
  deadUntil: number;
  failureCount: number;
}
const deadInstances = new Map<string, DeadInstanceRecord>();

interface InstanceStat {
  latencyMs: number;
  successes: number;
  failures: number;
}
const instanceStats = new Map<string, InstanceStat>();

function markInstanceDead(url: string) {
  try {
    const origin = new URL(url).origin;
    const existing = deadInstances.get(origin);
    const count = (existing?.failureCount || 0) + 1;
    // 指数退避：首次失败 2 分钟，二次失败 5 分钟，三次及以上 15 分钟
    const ttlMs = count === 1 ? 2 * 60 * 1000 : count === 2 ? 5 * 60 * 1000 : 15 * 60 * 1000;
    deadInstances.set(origin, {
      deadUntil: Date.now() + ttlMs,
      failureCount: count
    });
    const stat = instanceStats.get(origin) || { latencyMs: 2000, successes: 0, failures: 0 };
    stat.failures++;
    stat.latencyMs = Math.min(3000, stat.latencyMs + 400);
    instanceStats.set(origin, stat);
  } catch {
    deadInstances.set(url, {
      deadUntil: Date.now() + 5 * 60 * 1000,
      failureCount: 1
    });
  }
}

function isInstanceDead(url: string): boolean {
  try {
    const origin = new URL(url).origin;
    const record = deadInstances.get(origin);
    if (!record) return false;
    if (Date.now() > record.deadUntil) {
      deadInstances.delete(origin);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

let cachedDynamicInstances: string[] = [];
let lastDynamicFetch = 0;
const INSTANCE_POOL_TTL_MS = 15 * 60 * 1000;

/**
 * 正在进行的实例池探测。
 * 这是本文件最关键的一处性能修正：多路检索会并发调用 searchSearxng，
 * 旧实现没有任何在途去重，N 条路由就会各自去 fetch 一次 searx.space，
 * 每条都要等满 3.5s 超时才继续——检索因此被这一个探测动作拖住数秒。
 * 现在所有并发调用共享同一个在途 Promise。
 */
let inflightInstanceFetch: Promise<string[]> | null = null;

/** 同步取用当前可用实例池：绝不阻塞检索主路径 */
function currentInstancePool(): { pool: string[]; fresh: boolean } {
  const fresh = cachedDynamicInstances.length > 0 && Date.now() - lastDynamicFetch < INSTANCE_POOL_TTL_MS;
  const base = fresh ? cachedDynamicInstances : VERIFIED_SEARXNG_INSTANCES;
  return { pool: base.filter((u) => !isInstanceDead(u)), fresh };
}

/** 后台预热实例池：不阻塞调用方，成功后在下次检索中自然受益 */
function warmInstancePool(): void {
  void getActiveSearxngInstances().catch(() => { /* 探测失败保持静态池 */ });
}

/**
 * Periodically fetch live public SearXNG instances from searx.space
 */
async function getActiveSearxngInstances(): Promise<string[]> {
  const now = Date.now();
  if (cachedDynamicInstances.length > 0 && now - lastDynamicFetch < INSTANCE_POOL_TTL_MS) {
    return cachedDynamicInstances.filter(u => !isInstanceDead(u));
  }

  if (inflightInstanceFetch) return inflightInstanceFetch;

  inflightInstanceFetch = (async () => {
    try {
      const res = await fetch("https://searx.space/data/instances.json", {
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        const data = await res.json();
        const instances = Object.entries(data.instances || {})
          .filter(([url, info]: [string, any]) => {
            return (
              info.network_type === "normal" &&
              (info.http?.grade === "A+" || info.http?.grade === "A") &&
              !url.includes(".onion") &&
              !url.includes(".i2p") &&
              info.timing?.search?.all?.mean < 3 &&
              !isInstanceDead(url)
            );
          })
          .sort((a: any, b: any) => (a[1].timing?.search?.all?.mean || 999) - (b[1].timing?.search?.all?.mean || 999))
          .map(([url]) => url.replace(/\/$/, ""));

        if (instances.length > 0) {
          cachedDynamicInstances = Array.from(new Set([...VERIFIED_SEARXNG_INSTANCES, ...instances]))
            .filter(u => !isInstanceDead(u))
            .slice(0, 15);
          lastDynamicFetch = now;
          return cachedDynamicInstances;
        }
      }
    } catch {
      // Network or timeout, use fallback pool
    }

    return VERIFIED_SEARXNG_INSTANCES.filter(u => !isInstanceDead(u));
  })().finally(() => {
    inflightInstanceFetch = null;
  });

  return inflightInstanceFetch;
}

function sanitizeSnippet(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Decode Bing's tracking URL into the actual canonical website URL
 * Example: https://www.bing.com/ck/a?!...&u=a1aHR0cHM6Ly9kZWVwc2Vlay5jb20v...
 */
export function decodeBingUrl(url: string): string {
  try {
    const uParam = url.match(/(?:&amp;|&|\?)u=a1([A-Za-z0-9_-]+)/);
    if (uParam) {
      let b64 = uParam[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4 !== 0) b64 += "=";
      const decoded = typeof atob !== "undefined"
        ? atob(b64)
        : (typeof Buffer !== "undefined" ? Buffer.from(b64, "base64").toString("utf-8") : b64);
      if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
        return decoded;
      }
    }
  } catch {
    // ignore
  }
  return url;
}

/** 默认 SearXNG 单节点请求超时（由 1400ms 提高到 2400ms，提升长尾公网节点召回率） */
export const DEFAULT_SEARXNG_TIMEOUT_MS = 2400;

/**
 * Direct web search engine (Bing Web with canonical URL extraction)
 * High reliability, returns authentic websites without requiring third-party bot gateway
 */
export async function searchDirectWeb(query: string, langCode?: string): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2400);

  const acceptLang = acceptLanguageFor(langCode);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(acceptLang ? { "Accept-Language": acceptLang } : {})
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];

    // 多重选择器兜底解析
    let blocks = html.split(/<li[^>]*class="[^"]*(?:b_algo|b_ans)/i);
    if (blocks.length <= 1) {
      // 备用分块规则：按普通结果项或标题块分段
      const secondaryMatches = html.match(/<li[^>]*class="[^"]*b_[^"]*"[^>]*>[\s\S]*?<\/li>/gi);
      if (secondaryMatches && secondaryMatches.length > 0) {
        blocks = ["", ...secondaryMatches];
      }
    }

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const linkMatch =
        block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i) ||
        block.match(/<a[^>]*href="([^"]+)"[^>]*><h2[^>]*>([\s\S]*?)<\/h2><\/a>/i);
      const snippetMatch =
        block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        block.match(/<div[^>]*class="[^"]*b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
        block.match(/<div[^>]*class="[^"]*b_snippet"[^>]*>([\s\S]*?)<\/div>/i) ||
        block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

      if (linkMatch) {
        const rawUrl = linkMatch[1];
        const directUrl = decodeBingUrl(rawUrl);
        const title = sanitizeSnippet(linkMatch[2]);
        const snippet = snippetMatch ? sanitizeSnippet(snippetMatch[1]) : "";

        if (directUrl.startsWith("http")) {
          let hostname = "";
          try {
            hostname = new URL(directUrl).hostname;
          } catch {
            hostname = directUrl;
          }

          results.push({
            id: `web-${Math.random().toString(36).substring(2, 9)}`,
            title,
            url: directUrl,
            snippet,
            engine: "Web Direct",
            category: "general",
            displayDomain: hostname
          });
        }
      }
      if (results.length >= 20) break;
    }

    if (results.length === 0) {
      const h2Global = html.matchAll(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi);
      for (const m of h2Global) {
        const directUrl = decodeBingUrl(m[1]);
        const title = sanitizeSnippet(m[2]);
        if (directUrl.startsWith("http")) {
          let hostname = "";
          try {
            hostname = new URL(directUrl).hostname;
          } catch {
            hostname = directUrl;
          }
          results.push({
            id: `web-${Math.random().toString(36).substring(2, 9)}`,
            title,
            url: directUrl,
            snippet: "",
            engine: "Web Direct",
            category: "general",
            displayDomain: hostname
          });
        }
        if (results.length >= 20) break;
      }
    }

    if (results.length === 0 && html.length > 500) {
      console.warn(`[searchDirectWeb] Bing HTML returned ${html.length} bytes but parsed 0 results for query: "${query}"`);
    }

    return results;
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * SearXNG JSON 查询的公共取数层。
 *
 * 抽出来的唯一理由是 categories 必须可切换（general / images）：两处的请求参数、
 * 请求头、超时与「故障实例记账」口径必须完全一致，各写一份必然会漂移 ——
 * 图片检索若漏掉 markInstanceDead，坏实例会一直留在池子里被反复命中。
 */
async function fetchSearxngResults(
  instance: string,
  query: string,
  categories: string,
  langCode?: string,
  timeoutMs = DEFAULT_SEARXNG_TIMEOUT_MS,
  page?: number
): Promise<any[] | null> {
  const url = new URL(`${instance}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", categories);
  if (page && page > 1) {
    url.searchParams.set("pageno", String(page));
  }
  // 语言过滤是「结果精准」的一道硬闸门：跨语言路由用 en 下发才能真的拿到英文权威源，
  // 其余路由用查询语言过滤才能挡住不对语种的内容农场。统一走 toSearxngLanguage 映射，
  // 不再把 `zh` 这种两字母码裸传给 SearXNG（见 language.ts 的说明）。
  url.searchParams.set("language", toSearxngLanguage(langCode) || "auto");

  const acceptLang = acceptLanguageFor(langCode);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const fetchStart = Date.now();

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
        ...(acceptLang ? { "Accept-Language": acceptLang } : {})
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      markInstanceDead(instance);
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.results)) {
      markInstanceDead(instance);
      return null;
    }

    const elapsed = Date.now() - fetchStart;
    try {
      const origin = new URL(instance).origin;
      const prev = instanceStats.get(origin);
      instanceStats.set(origin, {
        latencyMs: prev ? Math.round((prev.latencyMs * 0.7) + (elapsed * 0.3)) : elapsed,
        successes: (prev?.successes || 0) + 1,
        failures: 0
      });
    } catch {
      // ignore
    }

    return data.results;
  } catch {
    clearTimeout(timeoutId);
    markInstanceDead(instance);
    return null;
  }
}

/**
 * 单实例网页检索：把 SearXNG 的 general 结果映射为 SearchResult
 */
async function searchSingleSearxng(instance: string, query: string, langCode?: string, page?: number): Promise<SearchResult[]> {
  const items = await fetchSearxngResults(instance, query, "general", langCode, DEFAULT_SEARXNG_TIMEOUT_MS, page);
  if (!items) return [];

  const mapped: SearchResult[] = [];
  for (const item of items) {
    if (!item.url || !item.url.startsWith("http")) continue;
    let hostname = "";
    try {
      hostname = new URL(item.url).hostname;
    } catch {
      hostname = item.url;
    }

    mapped.push({
      id: `sx-${Math.random().toString(36).substring(2, 9)}`,
      title: sanitizeSnippet(item.title || "无标题"),
      url: item.url,
      snippet: sanitizeSnippet(item.content || item.snippet || item.parsed_url?.[1] || ""),
      engine: item.engine || item.engines?.[0] || "SearXNG",
      category: item.category || "general",
      publishedDate: item.publishedDate || item.pubdate,
      thumbnail: item.thumbnail,
      displayDomain: hostname
    });
    if (mapped.length >= 25) break;
  }
  return mapped;
}

/**
 * 解析 SearXNG 图像 URL（兼容提取原始 URL、/image_proxy 代理参数以及相对路径）
 */
function extractSearxngImageUrl(raw: unknown, instance?: string): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.includes("image_proxy") && u.searchParams.has("url")) {
        const target = u.searchParams.get("url");
        if (target && /^https?:\/\//i.test(target)) return target;
      }
    } catch {}
    return trimmed;
  }

  // 相对路径或代理路径 /image_proxy?url=https%3A%2F%2F...
  if (trimmed.startsWith("/")) {
    try {
      const dummyBase = instance || "https://searx.be";
      const u = new URL(trimmed, dummyBase);
      if (u.searchParams.has("url")) {
        const target = u.searchParams.get("url");
        if (target && /^https?:\/\//i.test(target)) return target;
      }
      if (instance && /^https?:\/\//i.test(instance)) {
        return new URL(trimmed, instance).toString();
      }
    } catch {}
  }
  return undefined;
}

/**
 * 校验单张图片是否与搜索关键词切题相关（剔除不相干的袋鼠、无关动物或默认图集）
 */
function isImageRelevantToQuery(img: SearchImage, query: string): boolean {
  if (!query || !query.trim()) return true;
  const cleanQ = query.trim().toLowerCase();

  const titleLower = (img.title || "").toLowerCase();
  const domainLower = (img.domain || "").toLowerCase();
  const pageUrlLower = (img.pageUrl || "").toLowerCase();
  const imgUrlLower = (img.imageUrl || "").toLowerCase();
  const fullText = `${titleLower} ${domainLower} ${pageUrlLower} ${imgUrlLower}`;

  if (fullText.includes(cleanQ)) return true;

  const tokens = cleanQ
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return true;

  let matchCount = 0;
  for (const token of tokens) {
    if (fullText.includes(token)) {
      matchCount++;
    }
  }

  // 若搜索词较长（如多个词），命中任一核心 token 即可；单字/短词直接匹配
  return matchCount > 0;
}

/**
 * Direct image search (DuckDuckGo Images API)
 * 全球高清晰度、强相关性图片直出
 */
export async function searchDuckDuckGoImagesFallback(query: string, limit = 36, page = 1): Promise<SearchImage[]> {
  try {
    const controller1 = new AbortController();
    const timer1 = setTimeout(() => controller1.abort(), 3000);
    const res1 = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: controller1.signal
    });
    clearTimeout(timer1);
    if (!res1.ok) return [];
    const text1 = await res1.text();
    const vqdMatch = text1.match(/vqd=([0-9-]+)/) || text1.match(/vqd=["']([0-9-]+)["']/);
    if (!vqdMatch) return [];

    const vqd = vqdMatch[1];
    const offset = Math.max(0, (page - 1) * limit);
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 3500);
    const res2 = await fetch(`https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,${offset > 0 ? `&s=${offset}` : ""}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://duckduckgo.com/"
      },
      signal: controller2.signal
    });
    clearTimeout(timer2);
    if (!res2.ok) return [];
    const data = await res2.json();
    const results: SearchImage[] = [];
    const seen = new Set<string>();

    for (const r of data.results || []) {
      const imageUrl = pickHttpUrl(r.image);
      if (!imageUrl || seen.has(imageUrl)) continue;
      seen.add(imageUrl);

      const pageUrl = pickHttpUrl(r.url);
      const domain = hostOf(pageUrl) || hostOf(imageUrl);
      const title = sanitizeSnippet(r.title || "") || (domain ? `${domain} 图片` : `${query} 相关图片`);

      const imgObj: SearchImage = {
        id: `img-ddg-${Math.random().toString(36).substring(2, 9)}`,
        imageUrl,
        thumbnailUrl: pickHttpUrl(r.thumbnail) || imageUrl,
        title,
        pageUrl,
        source: "DuckDuckGo Images",
        domain,
        resolution: (r.width && r.height) ? `${r.width}×${r.height}` : undefined
      };

      if (isImageRelevantToQuery(imgObj, query)) {
        results.push(imgObj);
      }
      if (results.length >= limit) break;
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Direct image search fallback (Baidu Images JSON API)
 * 高可用极速 API，返回结构化 JSON 图片列表，无需繁重 HTML 正则解析
 */
export async function searchBaiduImagesFallback(query: string, limit = 36, page = 1): Promise<SearchImage[]> {
  try {
    const pn = Math.max(0, (page - 1) * limit);
    const url = `https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&word=${encodeURIComponent(query)}&pn=${pn}&rn=${limit}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://image.baidu.com/"
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }
    const items = data?.data || [];
    const results: SearchImage[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      if (!item || results.length >= limit) continue;
      const imageUrl = pickHttpUrl(item.hoverURL || item.middleURL || item.thumbURL || item.objURL);
      const thumbnailUrl = pickHttpUrl(item.thumbURL || item.middleURL) || imageUrl;
      if (!imageUrl || seen.has(imageUrl)) continue;
      seen.add(imageUrl);

      const pageUrl = pickHttpUrl(item.fromURL || (item.fromURLHost ? `https://${item.fromURLHost}` : undefined));
      const domain = item.fromURLHost || hostOf(pageUrl) || hostOf(imageUrl);
      const rawTitle = item.fromPageTitleEnc || item.title || "";
      const title = sanitizeSnippet(rawTitle.replace(/<[^>]+>/g, "")) || (domain ? `${domain} 图片` : `${query} 相关图片`);

      const imgObj: SearchImage = {
        id: `img-baidu-${Math.random().toString(36).substring(2, 9)}`,
        imageUrl,
        thumbnailUrl: thumbnailUrl || imageUrl,
        title,
        pageUrl,
        source: "Baidu Images",
        domain
      };

      if (isImageRelevantToQuery(imgObj, query)) {
        results.push(imgObj);
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Direct image search fallback (Bing Images)
 * 高可用且带 CDN 缓存的图片检索兜底通道，返回真实高清图与缩略图
 */
export async function searchBingImagesFallback(query: string, limit = 36, page = 1): Promise<SearchImage[]> {
  try {
    const first = Math.max(1, (page - 1) * limit + 1);
    const urls = [
      `https://cn.bing.com/images/async?q=${encodeURIComponent(query)}&first=${first}&count=${limit}&scenario=ImageBasicHover`,
      `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=${first}`
    ];

    const results: SearchImage[] = [];
    const seen = new Set<string>();

    for (const url of urls) {
      if (results.length >= limit) break;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        const html = await res.text();

        // 提取模式 1: iusc 节点的 m 属性 JSON
        const mAttrMatches = html.matchAll(/class="iusc"[^>]*m=(?:["']({[\s\S]*?})["']|&quot;({[\s\S]*?})&quot;)/gi);
        for (const match of mAttrMatches) {
          if (results.length >= limit) break;
          const rawJson = match[1] || match[2];
          if (!rawJson) continue;
          try {
            const decoded = rawJson
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>');
            const data = JSON.parse(decoded);
            const imageUrl = pickHttpUrl(data.murl) || pickHttpUrl(data.turl);
            const thumbnailUrl = pickHttpUrl(data.turl) || imageUrl;
            if (!imageUrl || seen.has(imageUrl)) continue;
            seen.add(imageUrl);

            const pageUrl = pickHttpUrl(data.purl);
            const domain = hostOf(pageUrl) || hostOf(imageUrl);
            const title = sanitizeSnippet(data.t || data.desc || "") || (domain ? `${domain} 图片` : "相关图片");

            const imgObj: SearchImage = {
              id: `img-bing-${Math.random().toString(36).substring(2, 9)}`,
              imageUrl,
              thumbnailUrl: thumbnailUrl || imageUrl,
              title,
              pageUrl,
              source: "Bing Images",
              domain
            };

            if (isImageRelevantToQuery(imgObj, query)) {
              results.push(imgObj);
            }
          } catch {
            // Skip malformed item
          }
        }
      } catch {
        // Continue to next URL
      }
    }

    return results;
  } catch {
    return [];
  }
}

/** 只接受 http(s) 的绝对地址：各上游引擎偶发返回相对路径或空壳 data: */
function pickHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

/** 取域名用于角标展示，失败返回 undefined（绝不抛错） */
function hostOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 图片检索的单实例超时。
 */
const IMAGE_FETCH_TIMEOUT_MS = 2200;

/**
 * 图片检索的整体预算。
 */
const IMAGE_SEARCH_BUDGET_MS = 2500;

/**
 * 图片检索（多引擎高切题聚合检索）。
 * 优先并发结合 DuckDuckGo 图片源、百度图片源与可用 SearXNG 实例，
 * 严格执行搜索词相关度校验，绝不输出不相干的动物或破图。
 */
export async function searchSearxngImages(
  query: string,
  options: {
    customUrl?: string;
    language?: string;
    env?: Record<string, string | undefined>;
    limit?: number;
    page?: number;
  } = {}
): Promise<SearchImage[]> {
  const limit = options.limit && options.limit > 0 ? options.limit : 36;
  const page = options.page && options.page > 0 ? options.page : 1;
  const cleanQ = (query || "").trim();
  if (!cleanQ) return [];

  const validCustomUrl = options.customUrl &&
    typeof options.customUrl === "string" &&
    options.customUrl.startsWith("http") &&
    options.customUrl !== "undefined" &&
    options.customUrl !== "null"
    ? options.customUrl.trim()
    : undefined;

  // 并发请求三路高可用图片引擎
  const [ddgImgs, baiduImgs, searxngImgs] = await Promise.all([
    searchDuckDuckGoImagesFallback(cleanQ, limit, page).catch(() => [] as SearchImage[]),
    searchBaiduImagesFallback(cleanQ, limit, page).catch(() => [] as SearchImage[]),
    (async () => {
      const { pool, fresh } = currentInstancePool();
      if (!fresh) warmInstancePool();
      const allInstances = Array.from(new Set([
        ...configuredInstanceUrls(validCustomUrl, options.env),
        ...pool
      ])).filter((url) => !isInstanceDead(url));

      const candidates = allInstances.slice(0, 3);
      if (candidates.length === 0) return [] as SearchImage[];

      for (const inst of candidates) {
        try {
          const raw = await fetchSearxngResults(inst, cleanQ, "images", options.language, IMAGE_FETCH_TIMEOUT_MS, page);
          if (Array.isArray(raw) && raw.length > 0) {
            const mapped: SearchImage[] = [];
            for (const item of raw) {
              const imageUrl =
                extractSearxngImageUrl(item.img_src) ||
                extractSearxngImageUrl(item.thumbnail_src) ||
                extractSearxngImageUrl(item.thumbnail);
              if (!imageUrl) continue;
              const pageUrl = pickHttpUrl(item.url);
              const domain = hostOf(pageUrl) || hostOf(imageUrl);
              const thumbUrl =
                extractSearxngImageUrl(item.thumbnail_src) ||
                extractSearxngImageUrl(item.thumbnail) ||
                imageUrl;

              const imgObj: SearchImage = {
                id: `img-${Math.random().toString(36).substring(2, 9)}`,
                imageUrl,
                thumbnailUrl: thumbUrl,
                title: sanitizeSnippet(item.title || "") || (domain ? `${domain} 图片` : `${cleanQ} 相关图片`),
                pageUrl,
                source: item.source || item.engine || "SearXNG Images",
                domain,
                resolution: typeof item.resolution === "string" && item.resolution.trim() !== ""
                  ? item.resolution.trim()
                  : undefined
              };

              // 严格校验相关度：丢弃无相关词的脏数据
              if (isImageRelevantToQuery(imgObj, cleanQ)) {
                mapped.push(imgObj);
              }
            }
            if (mapped.length > 0) return mapped;
          }
        } catch {
          // continue
        }
      }
      return [] as SearchImage[];
    })().catch(() => [] as SearchImage[])
  ]);

  const combined: SearchImage[] = [];
  const seen = new Set<string>();

  // 融合三路图片源：按相关性依次加入
  const candidateLists = [ddgImgs, baiduImgs, searxngImgs];
  for (const list of candidateLists) {
    for (const img of list) {
      if (combined.length >= limit) break;
      if (!seen.has(img.imageUrl)) {
        seen.add(img.imageUrl);
        combined.push(img);
      }
    }
  }

  // 若仍不足，使用 Bing 兜底
  if (combined.length < limit) {
    const needed = limit - combined.length;
    const bingImgs = await searchBingImagesFallback(cleanQ, needed, page).catch(() => [] as SearchImage[]);
    for (const img of bingImgs) {
      if (combined.length >= limit) break;
      if (!seen.has(img.imageUrl)) {
        seen.add(img.imageUrl);
        combined.push(img);
      }
    }
  }

  return combined;
}

/**
 * Emergency DuckDuckGo fallback when primary engines are blocked or empty
 */
async function searchDuckDuckGoFallback(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];
    const blocks = html.split(/<div[^>]*class="[^"]*result[^"]*results_links/i);
    for (let i = 1; i < blocks.length; i++) {
      const b = blocks[i];
      const linkM = b.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                    b.match(/<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>/i);
      const titleM = b.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetM = b.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      if (titleM && (linkM || b.includes("uddg="))) {
        let directUrl = linkM ? linkM[1] : "";
        if (b.includes("uddg=")) {
          const u = b.match(/uddg=([^&"]+)/);
          if (u) directUrl = decodeURIComponent(u[1]);
        }
        if (directUrl.startsWith("http")) {
          let hostname = "";
          try {
            hostname = new URL(directUrl).hostname;
          } catch {
            hostname = directUrl;
          }
          results.push({
            id: `ddg-${Math.random().toString(36).substring(2, 9)}`,
            title: sanitizeSnippet(titleM[1]),
            url: directUrl,
            snippet: snippetM ? sanitizeSnippet(snippetM[1]) : `访问 ${titleM[1]} 了解详细内容。`,
            engine: "DuckDuckGo",
            category: "general",
            displayDomain: hostname
          });
        }
      }
      if (results.length >= 10) break;
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Multi-tiered search:
 * 1. Concurrently queries validated SearXNG instances and Direct Web Engine
 * 2. Deduplicates by normalized URL
 * 3. Filters out Wikipedia/Baike unless the user explicitly searched for encyclopedia terms
 * 4. Identifies and prioritizes official homepages/portals
 */
export async function searchSearxng(
  query: string,
  options: {
    customUrl?: string;
    language?: string;
    categories?: string;
    page?: number;
    env?: Record<string, string | undefined>;
    resultTarget?: number;
  } = {}
): Promise<{
  results: SearchResult[];
  instanceUsed: string;
  instancesUsed: string[];
  diagnostics: {
    candidateCount: number;
    uniqueCount: number;
    sourcesUsed: string[];
    sourcesAttempted: string[];
    fallbackUsed: boolean;
    fallbackAttempted: boolean;
    failures: string[];
  };
}> {
  const validCustomUrl = options.customUrl &&
    typeof options.customUrl === "string" &&
    options.customUrl.startsWith("http") &&
    options.customUrl !== "undefined" &&
    options.customUrl !== "null"
    ? options.customUrl.trim()
    : undefined;

  const configuredInstances = configuredInstanceUrls(validCustomUrl, options.env)
    .filter((url) => !isInstanceDead(url));

  const { pool, fresh } = currentInstancePool();
  if (!fresh) warmInstancePool();
  const allInstances = Array.from(new Set([...configuredInstances, ...pool]));
  const configuredSet = new Set(configuredInstances);
  const candidateInstances = allInstances
    .sort((a, b) => {
      // Keep explicitly configured nodes ahead of discovered public nodes.
      const configuredPriority = Number(configuredSet.has(b)) - Number(configuredSet.has(a));
      if (configuredPriority !== 0) return configuredPriority;
      const aStat = instanceStats.get(new URL(a).origin)?.latencyMs ?? 800;
      const bStat = instanceStats.get(new URL(b).origin)?.latencyMs ?? 800;
      return aStat - bStat;
    })
    .slice(0, WEB_SEARCH_MAX_SEARXNG_INSTANCES);

  const collection = await collectWebSearchResults({
    query,
    target: Math.min(WEB_SEARCH_RESULT_TARGET, Math.max(1, options.resultTarget ?? WEB_SEARCH_RESULT_TARGET)),
    direct: () => searchDirectWeb(query, options.language),
    searxng: candidateInstances.map((inst) => ({
      source: `SearXNG ${inst}`,
      search: () => searchSingleSearxng(inst, query, options.language, options.page)
    })),
    fallback: () => searchDuckDuckGoFallback(query)
  });

  let combined = collection.results;
  let diagnostics = collection.diagnostics;
  let instanceUsed = diagnostics.sourcesUsed[0] || "No search source";

  if (combined.length === 0) {
    const cleanedQuery = query.replace(/(官网|官方网站|主页|网址|网站|official website|official site|homepage|公式サイト|ホームページ)/gi, "").trim();
    if (cleanedQuery && cleanedQuery !== query) {
      try {
        const retryWeb = await searchDirectWeb(cleanedQuery, options.language);
        if (retryWeb.length > 0) {
          combined = retryWeb;
          diagnostics = {
            ...diagnostics,
            candidateCount: diagnostics.candidateCount + retryWeb.length,
            uniqueCount: retryWeb.length,
            sourcesUsed: [...diagnostics.sourcesUsed, "Direct Web Cleaned Query"]
          };
          instanceUsed = "Direct Web Cleaned Query";
        }
      } catch (error) {
        diagnostics.failures.push(`Direct Web Cleaned Query: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const userWantsEncyclopedia = /维基|wikipedia|百科/i.test(query);
  const seenUrls = new Set<string>();
  const seenDomainTitles = new Set<string>();
  const filtered: SearchResult[] = [];
  for (const item of combined) {
    if (!item.url) continue;
    const normalizedUrl = normalizeUrlKey(item.url);
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);

    // 同域名下过滤完全同名或同前缀的冗余页面（如多个 Sign-in - Google Accounts 登录入口）
    const host = hostOf(item.url) || "";
    const cleanTitle = (item.title || "").trim().toLowerCase();
    const domainTitleKey = `${host}:::${cleanTitle}`;
    if (seenDomainTitles.has(domainTitleKey)) continue;
    seenDomainTitles.add(domainTitleKey);

    const isWiki = /wikipedia\.org|baike\.baidu\.com/i.test(item.url);
    if (isWiki && !userWantsEncyclopedia) continue;
    item.id = generateStableSourceId(item.url);
    filtered.push(item);
  }
  if (filtered.length === 0 && combined.length > 0) {
    for (const item of combined) {
      if (item.url) item.id = generateStableSourceId(item.url);
    }
    filtered.push(...combined);
  }

  const instancesUsed = diagnostics.sourcesUsed
    .filter((source) => source.startsWith("SearXNG "))
    .map((source) => source.slice("SearXNG ".length));
  return { results: filtered, instanceUsed, instancesUsed, diagnostics };
}
