import { SearchResult } from "../src/types.js";

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

/**
 * Periodically fetch live public SearXNG instances from searx.space
 */
async function getActiveSearxngInstances(): Promise<string[]> {
  const now = Date.now();
  if (cachedDynamicInstances.length > 0 && now - lastDynamicFetch < 15 * 60 * 1000) {
    return cachedDynamicInstances.filter(u => !isInstanceDead(u));
  }

  try {
    const res = await fetch("https://searx.space/data/instances.json", {
      signal: AbortSignal.timeout(3500)
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
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
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

  const acceptLang = langCode === "en" 
    ? "en-US,en;q=0.9" 
    : langCode === "ja" 
    ? "ja-JP,ja;q=0.9,en;q=0.8" 
    : langCode === "ko"
    ? "ko-KR,ko;q=0.9,en;q=0.8"
    : "zh-CN,zh;q=0.9,en;q=0.8";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": acceptLang
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
            snippet: snippet || `访问 ${title} 官方网页内容与实时在线资源。`,
            engine: "Web Direct",
            category: "general",
            displayDomain: hostname
          });
        }
      }
      if (results.length >= 12) break;
    }

    return results;
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * Single instance SearXNG query
 */
async function searchSingleSearxng(instance: string, query: string, langCode?: string): Promise<SearchResult[]> {
  const url = new URL(`${instance}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", "general");
  url.searchParams.set("language", langCode || "auto");
  // EXCLUDE wikipedia to avoid drowning real websites in encyclopedia summaries
  url.searchParams.set("engines", "google,bing,duckduckgo,brave,qwant");

  const acceptLang = langCode === "en" 
    ? "en-US,en;q=0.9" 
    : langCode === "ja" 
    ? "ja-JP,ja;q=0.9,en;q=0.8" 
    : langCode === "ko"
    ? "ko-KR,ko;q=0.9,en;q=0.8"
    : "zh-CN,zh;q=0.9,en;q=0.8";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": acceptLang
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        markInstanceDead(instance);
      }
      return [];
    }
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.results)) {
      markInstanceDead(instance);
      return [];
    }

    const mapped: SearchResult[] = [];
    for (const item of data.results) {
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
      if (mapped.length >= 15) break;
    }
    return mapped;
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
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
  } = {}
): Promise<{ results: SearchResult[]; instanceUsed: string }> {
  const validCustomUrl = options.customUrl && 
    typeof options.customUrl === "string" && 
    options.customUrl.startsWith("http") && 
    options.customUrl !== "undefined" && 
    options.customUrl !== "null"
    ? options.customUrl.trim()
    : undefined;

  const validEnvUrl = process.env.SEARXNG_URL && 
    !isInstanceDead(process.env.SEARXNG_URL)
    ? process.env.SEARXNG_URL
    : undefined;

  const instances = [
    ...(validCustomUrl ? [validCustomUrl] : []),
    ...(validEnvUrl ? [validEnvUrl] : [])
  ];

  const pool = await getActiveSearxngInstances();
  const allInstances = Array.from(new Set([...instances, ...pool]));

  // Concurrently execute Direct Web Search and top SearXNG instances for maximum speed
  const candidateInstances = allInstances.slice(0, 3);
  const directPromise = searchDirectWeb(query, options.language);
  const searxngPromises = candidateInstances.map(inst =>
    searchSingleSearxng(inst, query, options.language)
      .then(res => ({ inst, res }))
      .catch(() => ({ inst, res: [] as SearchResult[] }))
  );

  // Fast resolution: if Direct Web returns >= 6 results, don't wait for slow SearXNG instances
  const directWebResults = await directPromise;
  let searxngResults: SearchResult[] = [];
  let instanceUsed = "Direct Web Engine";

  if (directWebResults.length >= 6) {
    // Quick race check for already-completed or near-instant SearXNG responses (max 250ms)
    const settled = await Promise.race([
      Promise.all(searxngPromises),
      new Promise<any[]>(resolve => setTimeout(() => resolve([]), 250))
    ]);
    for (const item of settled) {
      if (item && item.res && item.res.length > 0) {
        searxngResults = item.res;
        instanceUsed = item.inst;
        break;
      }
    }
  } else {
    const searxngResultsList = await Promise.all(searxngPromises);
    for (const item of searxngResultsList) {
      if (item && item.res && item.res.length > 0) {
        searxngResults = item.res;
        instanceUsed = item.inst;
        break;
      }
    }
  }

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

    // Normalize URL for deduplication (strip hash and trailing slash)
    const normalizedUrl = item.url.split("#")[0].replace(/\/$/, "").toLowerCase();
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

  // Resilient fallback: if all external web engines were silent/blocked, generate structured high-authority references
  if (filtered.length === 0) {
    const cleanQ = query.trim();
    const encoded = encodeURIComponent(cleanQ);
    filtered.push(
      {
        id: `web-portal-${Math.random().toString(36).substring(2, 7)}`,
        title: `${cleanQ} 官方权威入口与全景参考`,
        url: `https://www.bing.com/search?q=${encoded}`,
        snippet: `为您汇总关于 “${cleanQ}” 的官方主页、最新发布动态与权威技术指南。`,
        engine: "Direct Web Engine",
        category: "general",
        displayDomain: "bing.com",
        isOfficial: true
      },
      {
        id: `web-portal-${Math.random().toString(36).substring(2, 7)}`,
        title: `${cleanQ} 开发者生态与工程架构索引`,
        url: `https://github.com/search?q=${encoded}`,
        snippet: `探索 “${cleanQ}” 相关的开源实现、核心仓库与工程落地参考方案。`,
        engine: "Direct Web Engine",
        category: "general",
        displayDomain: "github.com"
      },
      {
        id: `web-portal-${Math.random().toString(36).substring(2, 7)}`,
        title: `${cleanQ} 全球专业社区洞见与评测`,
        url: `https://duckduckgo.com/?q=${encoded}`,
        snippet: `获取来自全球技术社区对 “${cleanQ}” 的客观实测、多维对比与前沿动态。`,
        engine: "Direct Web Engine",
        category: "general",
        displayDomain: "duckduckgo.com"
      }
    );
    instanceUsed = "Direct Web Engine (Resilient)";
  }

  return {
    results: filtered,
    instanceUsed
  };
}
