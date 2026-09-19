import { SearchResult, SearchImage } from "../src/types.js";
import { normalizeUrlKey } from "./retrievalRanker.js";
import { acceptLanguageFor, toSearxngLanguage } from "./language.js";

// Active, responsive SearXNG instances verified for JSON output
const VERIFIED_SEARXNG_INSTANCES = [
  "https://search.mectov.my.id",
  "https://sx.xo.st",
  "https://search.lumy.live",
  "https://searx.dresden.network",
  "https://baresearch.org"
];

// In-memory blacklist of instances that recently failed with 403/429/timeout
const deadInstances = new Map<string, number>();
const DEAD_INSTANCE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function markInstanceDead(url: string) {
  try {
    const origin = new URL(url).origin;
    deadInstances.set(origin, Date.now());
  } catch {
    deadInstances.set(url, Date.now());
  }
}

function isInstanceDead(url: string): boolean {
  try {
    const origin = new URL(url).origin;
    const failedAt = deadInstances.get(origin);
    if (!failedAt) return false;
    if (Date.now() - failedAt > DEAD_INSTANCE_TTL_MS) {
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

/**
 * Direct web search engine (Bing Web with canonical URL extraction)
 * High reliability, returns authentic websites without requiring third-party bot gateway
 */
export async function searchDirectWeb(query: string, langCode?: string): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2200);

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

    const blocks = html.split(/<li[^>]*class="[^"]*b_algo/);
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
      const snippetMatch =
        block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        block.match(/<div[^>]*class="[^"]*b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
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
  timeoutMs = 1800,
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
  // 刻意**不**指定 engines。
  //
  // 旧实现写死 `engines=google,bing,duckduckgo,brave,qwant`，本意是排除 wikipedia。
  // 代价有三个，且都由候选池广度买单：
  //   1. 每个 SearXNG 实例实际启用的引擎集合并不相同，写死清单会让部分实例
  //      因"请求了它没有的引擎"而返回空，进而被误判为故障实例打入黑名单；
  //   2. 多引擎共识（同一 URL 被多个引擎同时给出）是重排的核心信号之一，
  //      把引擎池人为压到 5 个，等于主动放弃了共识信号；
  //   3. 各实例的索引覆盖互补性被抹平，长尾权威源进不来。
  // wikipedia 的排除现在由下游统一负责（重排内核按 isEncyclopedia 判定，
  // 且仅在用户明确搜索百科时才放行），比在检索侧写死引擎清单更准确也更可维护。

  const acceptLang = acceptLanguageFor(langCode);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        markInstanceDead(instance);
      }
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.results)) {
      markInstanceDead(instance);
      return null;
    }

    return data.results;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * 单实例网页检索：把 SearXNG 的 general 结果映射为 SearchResult
 */
async function searchSingleSearxng(instance: string, query: string, langCode?: string, page?: number): Promise<SearchResult[]> {
  const items = await fetchSearxngResults(instance, query, "general", langCode, 2800, page);
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
 * Direct image search fallback (Bing Images)
 * 高可用且带 CDN 缓存的图片检索兜底通道，返回真实高清图与缩略图
 */
export async function searchBingImagesFallback(query: string, limit = 36, page = 1): Promise<SearchImage[]> {
  try {
    const first = Math.max(1, (page - 1) * limit + 1);
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=${first}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchImage[] = [];
    const regex = /class="iusc"[^>]*m="({[^"]+})"/g;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((match = regex.exec(html)) !== null && results.length < limit) {
      try {
        const decoded = match[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        const data = JSON.parse(decoded);
        const imageUrl = pickHttpUrl(data.murl) || pickHttpUrl(data.turl);
        const thumbnailUrl = pickHttpUrl(data.turl) || imageUrl;
        if (!imageUrl || !thumbnailUrl || seen.has(imageUrl)) continue;
        seen.add(imageUrl);

        const pageUrl = pickHttpUrl(data.purl);
        const domain = hostOf(pageUrl) || hostOf(imageUrl);
        const title = sanitizeSnippet(data.t || data.desc || "") || (domain ? `${domain} 图片` : "相关图片");

        results.push({
          id: `img-bing-${Math.random().toString(36).substring(2, 9)}`,
          imageUrl,
          thumbnailUrl,
          title,
          pageUrl,
          source: "Bing Images",
          domain
        });
      } catch {
        // Skip malformed item
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
 * 刻意远大于网页检索的 1800ms：images 类目的响应体量级完全不同 ——
 * 实测单次返回可达近百条（每条还带长 URL 与多个尺寸字段），
 * 沿用网页检索的超时会稳定地把能用的实例也判成超时，最终一张图都拿不到。
 */
const IMAGE_FETCH_TIMEOUT_MS = 4500;

/**
 * 图片检索的整体预算。
 * 图片只是配图，绝不能反过来拖住已经跑完的检索主链路：超时就放弃配图，
 * 宁可让「相关图片」组件退回空态，也不让整页为用户多等。
 */
const IMAGE_SEARCH_BUDGET_MS = 5000;

/**
 * 图片检索（SearXNG categories=images）。
 *
 * 与网页检索的差别不只是 category：返回体描述的是「一张图」而不是「一个页面」——
 * 图在 img_src / thumbnail_src，而 url 指向图片所在的网页。因此映射成 SearchImage
 * （图 + 出处）而不是硬塞进 SearchResult，两者的语义维度本就不同。
 *
 * 上游对图源可用性不做任何保证（防盗链、缩略图失效都极常见），所以这里只做
 * 「必须是 http(s) 绝对地址」这一最低校验，剩下的交给前端按图加载失败逐个剔除 ——
 * 在这里判活需要逐张发 HEAD 请求，代价远高于让浏览器顺手报个 onError。
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

  const validCustomUrl = options.customUrl &&
    typeof options.customUrl === "string" &&
    options.customUrl.startsWith("http") &&
    options.customUrl !== "undefined" &&
    options.customUrl !== "null"
    ? options.customUrl.trim()
    : undefined;

  const rawEnvUrl = options.env?.SEARXNG_URL ||
    (typeof process !== "undefined" ? process.env?.SEARXNG_URL : undefined);
  const validEnvUrl = rawEnvUrl && !isInstanceDead(rawEnvUrl) ? rawEnvUrl : undefined;

  // 与网页检索共用同一套实例池与故障记账，但只为凑图打前 3 个实例。
  const { pool, fresh } = currentInstancePool();
  if (!fresh) warmInstancePool();

  const allInstances = Array.from(new Set([
    ...(validCustomUrl ? [validCustomUrl] : []),
    ...(validEnvUrl ? [validEnvUrl] : []),
    ...pool
  ]));

  const candidates = allInstances.slice(0, 3);

  /**
   * 首个非空即采纳，而不是像网页检索那样全量合并。
   *
   * 理由与网页检索恰好相反：那里合并是为了「多引擎共识」这个重排信号，广度本身就是分。
   * 这里合并只有坏处 —— 图片类目单个实例的产出（实测可达近百条）已是所需量的近十倍，
   * 再等第二、第三个实例只会把延迟交给最慢的那一个，而多出来的图最后仍会被上限截掉。
   */
  const items = await new Promise<any[] | null>((resolve) => {
    let pending = candidates.length;
    let done = false;
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (value: any[] | null) => {
      if (done) return;
      done = true;
      if (budgetTimer) clearTimeout(budgetTimer);
      resolve(value);
    };

    budgetTimer = setTimeout(() => finish(null), IMAGE_SEARCH_BUDGET_MS);

    if (pending === 0) {
      finish(null);
      return;
    }

    for (const inst of candidates) {
      fetchSearxngResults(inst, query, "images", options.language, IMAGE_FETCH_TIMEOUT_MS, page)
        .then((res) => {
          if (res && res.length > 0) finish(res);
          else if (--pending === 0) finish(null);
        })
        .catch(() => {
          if (--pending === 0) finish(null);
        });
    }
  });

  const images: SearchImage[] = [];
  const seen = new Set<string>();

  if (items && items.length > 0) {
    for (const item of items) {
      if (images.length >= limit) break;

      // 原图优先，没有原图就退回缩略图（支持从 /image_proxy?url= 提取真实地址）
      const imageUrl =
        extractSearxngImageUrl(item.img_src) ||
        extractSearxngImageUrl(item.thumbnail_src) ||
        extractSearxngImageUrl(item.thumbnail);
      if (!imageUrl || seen.has(imageUrl)) continue;
      seen.add(imageUrl);

      const pageUrl = pickHttpUrl(item.url);
      const domain = hostOf(pageUrl) || hostOf(imageUrl);

      const thumbUrl =
        extractSearxngImageUrl(item.thumbnail_src) ||
        extractSearxngImageUrl(item.thumbnail) ||
        imageUrl;

      images.push({
        id: `img-${Math.random().toString(36).substring(2, 9)}`,
        imageUrl,
        thumbnailUrl: thumbUrl,
        title: sanitizeSnippet(item.title || "") || (domain ? `${domain} 图片` : "相关图片"),
        pageUrl,
        source: item.source || item.engine || "SearXNG Images",
        domain,
        resolution: typeof item.resolution === "string" && item.resolution.trim() !== ""
          ? item.resolution.trim()
          : undefined
      });
    }
  }

  // 若实例池未返回或图片数量不足 limit，使用高可靠 Bing 图片通道补齐，确保相关图片组件能稳定加载足额图片
  if (images.length < limit) {
    try {
      const fallbackImages = await searchBingImagesFallback(query, limit - images.length, page);
      for (const fImg of fallbackImages) {
        if (images.length >= limit) break;
        if (!seen.has(fImg.imageUrl)) {
          seen.add(fImg.imageUrl);
          images.push(fImg);
        }
      }
    } catch {
      // 容灾忽略
    }
  }

  return images;
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
  } = {}
): Promise<{ results: SearchResult[]; instanceUsed: string; instancesUsed: string[] }> {
  const validCustomUrl = options.customUrl && 
    typeof options.customUrl === "string" && 
    options.customUrl.startsWith("http") && 
    options.customUrl !== "undefined" && 
    options.customUrl !== "null"
    ? options.customUrl.trim()
    : undefined;

  const rawEnvUrl = options.env?.SEARXNG_URL || 
    (typeof process !== "undefined" ? process.env?.SEARXNG_URL : undefined);

  const validEnvUrl = rawEnvUrl && !isInstanceDead(rawEnvUrl)
    ? rawEnvUrl
    : undefined;

  const instances = [
    ...(validCustomUrl ? [validCustomUrl] : []),
    ...(validEnvUrl ? [validEnvUrl] : [])
  ];

  // 实例池绝不挡在检索主路径前面：先用确定可用的静态池立即开跑，
  // 动态探测放到后台预热，下次检索自然受益。旧实现 await 这个探测，
  // 让每条路由都白等最多 3.5s——这正是检索耗时居高不下的元凶。
  const { pool, fresh } = currentInstancePool();
  if (!fresh) warmInstancePool();

  const allInstances = Array.from(new Set([...instances, ...pool]));

  // 并发下发 Direct Web (Bing) 与 Top 5 SearXNG 实例，最大化基础召回广度
  const candidateInstances = allInstances.slice(0, 5);
  const directPromise = searchDirectWeb(query, options.language);
  const searxngPromises = candidateInstances.map(inst =>
    searchSingleSearxng(inst, query, options.language, options.page)
      .then(res => ({ inst, res }))
      .catch(() => ({ inst, res: [] as SearchResult[] }))
  );

  const instancesUsed: string[] = [];
  let instanceUsed = "Direct Web Engine";

  const collectFromSettled = (settled: any[]) => {
    const merged: SearchResult[] = [];
    for (const item of settled) {
      if (item && item.res && item.res.length > 0) {
        merged.push(...item.res);
        instancesUsed.push(item.inst);
      }
    }
    if (instancesUsed.length > 0) {
      instanceUsed = instancesUsed[0];
    }
    return merged;
  };

  // 统一搜索时间预算 3000ms：Bing 与 SearXNG 5 个实例全部平等参与并发召回，
  // 避免因为 Bing 率先返回 12 条就把 SearXNG 实例结果直接剔除。
  const SEARCH_BUDGET_MS = 3000;

  const [directWebResults, searxngSettled] = await Promise.all([
    directPromise.catch(() => [] as SearchResult[]),
    Promise.race([
      Promise.all(searxngPromises),
      new Promise<any[]>(resolve => setTimeout(() => resolve([]), SEARCH_BUDGET_MS))
    ])
  ]);

  const searxngResults = collectFromSettled(searxngSettled);

  // Combine and deduplicate
  const combined = [...searxngResults, ...directWebResults];

  if (combined.length === 0) {
    // Try cleaning query if exact query had 0
    const cleanedQuery = query.replace(/(官网|官方网站|主页|网址|网站|official website|official site|homepage|公式サイト|ホームページ)/gi, "").trim();
    if (cleanedQuery && cleanedQuery !== query) {
      const retryWeb = await searchDirectWeb(cleanedQuery, options.language);
      combined.push(...retryWeb);
    }
  }

  // If still empty, try DuckDuckGo fallback
  if (combined.length === 0) {
    const ddgFallback = await searchDuckDuckGoFallback(query);
    if (ddgFallback.length > 0) {
      combined.push(...ddgFallback);
      instanceUsed = "DuckDuckGo Web";
    }
  }

  // Check if user specifically requested Wikipedia or Encyclopedia
  const userWantsEncyclopedia = /维基|wikipedia|百科/i.test(query);

  const seenUrls = new Set<string>();
  const filtered: SearchResult[] = [];

  for (const item of combined) {
    if (!item.url) continue;

    // 归一化去重：复用重排内核的 normalizeUrlKey。
    // 旧实现只做 `split("#")[0].replace(/\/$/,"").toLowerCase()` —— 不去 www、不去追踪参数，
    // 于是 https://www.x.com/a?utm_source=t 与 http://x.com/a 会被当成两条独立结果。
    // 这里提前收紧口径，避免它们在进入重排前就白白占掉信源名额。
    const normalizedUrl = normalizeUrlKey(item.url);
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);

    // If user did NOT ask for Wikipedia, strictly filter out Wikipedia / Baidu Baike
    const isWiki = /wikipedia\.org|baike\.baidu\.com/i.test(item.url);
    if (isWiki && !userWantsEncyclopedia) {
      continue;
    }

    filtered.push(item);
  }

  if (filtered.length === 0 && combined.length > 0) {
    // If strict filter removed everything, restore combined
    filtered.push(...combined);
  }

  // ── 关于「全部引擎失败时的兜底」────────────────────────────────────
  // 旧实现在这里捏造 3 条结果：标题伪装成「X 官方权威入口与全景参考」，摘要写
  // 「为您汇总关于 X 的官方主页…」，URL 指向 bing.com/search?q=X 等搜索页，其中一条
  // 还标了 isOfficial: true。
  //
  // 这是"结果不精准"中最伤的一种：它不是排序失误，而是**凭空造出信源**。
  //   · 假摘要含有"官方""权威"等高价值词，会被重排当作真实内容加分；
  //   · bing.com / github.com 落在权威域名表内，反而让伪造条目拿到最高权威分，
  //     实测足以把真正的官方文档挤出 Top1；
  //   · 用户完全无法分辨这是搜索结果还是系统编造的。
  //
  // 现在的处理：**如实返回空结果**。检索失败是一个需要被上层如实告知的事实，
  // 而不是一个该被编造内容掩盖的空白。重排内核也会硬剔除搜索结果页类 URL
  // （见 retrievalRanker.isSearchEndpoint），因此这类条目即便混进来也进不了信源集。

  return {
    results: filtered,
    instanceUsed,
    instancesUsed
  };
}
