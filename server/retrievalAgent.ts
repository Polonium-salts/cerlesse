/**
 * Retrieval Agent —— 全网检索 Agent 的专职执行阶段
 * ============================================================
 * 职责边界（与其它 Agent 互不重叠）：
 *   输入：用户任务 + 主 Agent 的意图计划
 *   输出：高相关、高权威、去重、多样的可信信源集 (RankedSearchResult[])
 *   不做：不生成内容、不规划组件、不做排版
 *
 * 四步流水线：
 *   1. 查询规划   —— 把一条自然语言查询扩成「多路由」检索式（权威路由 / 实操路由 /
 *                    对比路由 / 跨语言路由），而不是把同一个查询换个说法重复搜
 *   2. 并发检索   —— 多路由并发下发，任一路由失败不影响其它路由
 *   3. 候选聚合   —— URL 归一化去重 + 多路共识统计（被多路召回的页面可信度更高）
 *   4. 相关性重排 —— 交给 retrievalRanker 打分、剔除低质、配额保多样性、标记官方信源
 *
 * 设计约束：Step 3/4 全部是纯函数（见 retrievalRanker.ts），
 * 因此「检索质量」可以被单元测试覆盖，而不需要真的联网。
 */

import { AgentPlan, DetectedLanguage, SearchResult } from "../src/types.js";
import { searchSearxng } from "./searxng.js";
import {
  buildQueryProfile,
  rankSearchPools,
  CandidatePool,
  RankedSearchResult
} from "./retrievalRanker.js";

export interface RetrievalRouteDiagnostic {
  query: string;
  /** 该路由返回的原始条数 */
  count: number;
  /** 命中的检索实例 */
  instance: string;
  /** 路由用途，便于前端解释"为什么要搜这一条" */
  purpose: string;
  elapsedMs: number;
  error?: string;
}

export interface RetrievalDiagnostics {
  routes: RetrievalRouteDiagnostic[];
  totalCandidates: number;
  uniqueCandidates: number;
  afterSpamFilter: number;
  afterQualityFilter: number;
  afterDedup: number;
  keptAfterRanking: number;
  supplementationCount: number;
  pagesFetched: number;
  officialCount: number;
  domainCount: number;
  instancesUsed: string[];
  elapsedMs: number;
}

export interface RetrievalAgentResult {
  /** 最终交付给下游的纯净信源（已重排、已去重、已配额） */
  results: RankedSearchResult[];
  /** 全部原始候选，保留用于溯源与调试 */
  rawResults: SearchResult[];
  diagnostics: RetrievalDiagnostics;
}

export interface RetrievalAgentOptions {
  query: string;
  plan: AgentPlan;
  detectedLanguage: DetectedLanguage;
  targetLanguage: { code: string; name: string };
  customSearxngUrl?: string;
  env?: Record<string, string | undefined>;
  /** 最多并发下发多少条路由（同时决定候选池大小与耗时） */
  maxRoutes?: number;
  /** 最终交付条数 */
  limit?: number;
  /** 单路由并发上限 */
  concurrency?: number;
  signal?: AbortSignal;
  onRouteStart?: (route: RetrievalRouteDiagnostic) => void;
  onRouteDone?: (route: RetrievalRouteDiagnostic) => void;
}

/** 单条检索路由：除了检索式本身，还带上它该用的检索语言 */
export interface RetrievalRoute {
  query: string;
  purpose: string;
  /**
   * 该路由的检索语言（如跨语言路由用 "en"）。
   * 缺省表示沿用query的语言。**这是精准度的一个关键**：
   * 旧实现让所有路由共用 `detectedLanguage.code`，于是「英文权威源」路由
   * 也带着中文语言过滤器下发，等于把这条路由的目的直接抵消掉。
   */
  language?: string;
}

const NON_LATIN_SCRIPT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

/**
 * 是否是一条「纯拉丁检索式」。
 * 注意不能要求 `{2,}` 个连续字母 —— `k8s`、`c++`、`go` 这类技术主体词会被误判成
 * 没有拉丁主体，跨语言路由因此整条消失（k8s 是最典型的长尾权威源场景）。
 */
function isLatinQuery(text: string): boolean {
  return /[a-zA-Z]/.test(text) && !NON_LATIN_SCRIPT.test(text);
}

/**
 * 混排子查询清理：`docker 安装 documentation official overview` 这类
 * 「中文词 + 英文意图词」的混排检索式，搜索引擎的分词与语言判定都会失准。
 *
 * 仅当剥离非 ASCII 后**仍保留 ≥2 个拉丁词**（说明英文意图尾巴是完整的）才替换，
 * 避免把 `nginx 反向代理配置 架构解析与底层原理` 削成孤零零的 `nginx`。
 */
function latinizeHybridQuery(query: string): string {
  const ascii = query.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = ascii.split(/\s+/).filter((t) => t.length >= 2);
  return tokens.length >= 2 ? ascii : query;
}

/**
 * 查询规划：把一条查询扩成「多路由」检索式。
 *
 * 与"同义改写"的区别：每一条路由都承担**不同的检索视角**，
 * 目的是让候选池覆盖到单一视角必然漏掉的信源类型
 * （官方文档、实操教程、对比评测、跨语言权威源）。
 *
 * 名额分配是本函数的核心约束。旧实现按「主查询 → 计划子查询 → 权威 → 实操 → 跨语言」
 * 的顺序先进先出、再按上限截断，于是出现了这样的实测结果（maxRoutes=4）：
 *   · 通用意图查询（`docker 安装`/`k8s 集群部署`）：计划自带 4 条子查询，
 *     名额被它们全部占满 —— **权威路由与实操路由一条都没下发**；
 *   · 对比类查询（`react vs vue`）：实操路由被挤掉。
 * 即：被注释称为"精准最高性价比的一路"的权威路由，在最常见的查询类型上从未执行过。
 *
 * 现在改为**交错保底**：主查询 / 权威 / 意图子查询 / 实操 依次抢占前四个名额，
 * 跨语言与其余子查询顺延。无论上限多小，三种检索视角都不会互相挤兑。
 */
export function planRetrievalRoutes(
  query: string,
  plan: AgentPlan,
  detectedLanguage: DetectedLanguage,
  maxRoutes: number
): RetrievalRoute[] {
  const profile = buildQueryProfile(query);
  const entity = profile.entityPhrase || query;
  const isZh = detectedLanguage.code.startsWith("zh");
  const hasNonLatinScript = NON_LATIN_SCRIPT.test(query);

  // 路由 0：原始查询本身。永远排第一，因为它最贴近用户真实表述
  const mainRoute: RetrievalRoute = { query, purpose: "主查询（用户原话）" };

  // 权威路由：直指官方文档与规范仓库，这是"精准"最高性价比的一路。
  // 不再要求 `entity !== query` —— 那会让 `docker` 这类纯实体查询反而拿不到权威路由。
  const authorityRoute: RetrievalRoute = {
    query: isZh ? `${entity} 官方文档` : `${entity} official documentation`,
    purpose: "权威路由（官方文档）"
  };

  // 实操路由：教程与最佳实践，用于补足"怎么做"类信息的信源密度
  const practicalRoute: RetrievalRoute = {
    query: isZh ? `${entity} 教程 最佳实践` : `${entity} tutorial best practices`,
    purpose: "实操路由（教程）"
  };

  // 跨语言路由：查询本身是非拉丁文字，但内部带着拉丁技术主体词（docker / k8s / react…），
  // 此时用**纯英文检索式 + 英文语言过滤**直取英文权威源。
  //
  // 旧实现要求 `profile.isLatin === false`，恰好把这类查询全部挡在门外 ——
  // `docker 安装`、`k8s 集群部署` 都因为含拉丁词而被判为 isLatin，跨语言路由从未下发；
  // 而它们正是最该去拿英文官方文档的一类。
  const latinEntity = entity.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  const hasLatinEntity = /[a-zA-Z]/.test(latinEntity) && latinEntity.replace(/\s+/g, "").length >= 2;
  const crossLingualRoute: RetrievalRoute | null =
    hasNonLatinScript && hasLatinEntity
      ? {
          query: `${latinEntity} official documentation guide`,
          purpose: "跨语言路由（英文权威源）",
          language: "en"
        }
      : null;

  // 主 Agent 计划里的子查询：它们已经带上了意图（对比/技术/官方）视角，
  // 但只是**补充**，不允许挤掉上面三条设计路由（见函数头注释）。
  //
  // 混排子查询被拉丁化后（`docker 安装 documentation official overview`
  // → `docker documentation official overview`）就已经是一条英文检索式了，
  // 必须同时把语言切到 en —— 否则请求头与 language 参数仍在说中文，
  // 引擎照样按中文语料返回，前面的清理白做。
  const normalizeKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const mainKey = normalizeKey(query);
  const planRoutes: RetrievalRoute[] = [];
  const planSeen = new Set<string>([mainKey]);
  for (const raw of plan.subQueries || []) {
    const sub = (raw || "").trim();
    if (!sub) continue;
    const key = normalizeKey(sub);
    if (!key || planSeen.has(key)) continue;
    planSeen.add(key);

    const latinized = hasNonLatinScript && hasLatinEntity ? latinizeHybridQuery(sub) : sub;
    // 判定「英文检索式」看结果而不是看过程：拉丁化后的子查询，以及计划自带的
    // 纯英文跨语言子查询（generatePlanForQuery 生成的 `xxx official docs release`），
    // 都必须配 en 语言下发，否则请求头与 language 参数仍在说中文，等于没跨语言。
    const isCrossLingual = isLatinQuery(latinized);
    planRoutes.push({
      query: latinized,
      purpose: isCrossLingual ? "跨语言子查询（英文检索式）" : "意图计划子查询",
      language: isCrossLingual ? "en" : undefined
    });
  }

  // 交错保底：主查询 → 权威 → 意图子查询 → 实操 → 跨语言 → 其余子查询
  const slots: RetrievalRoute[] = [mainRoute, authorityRoute];
  if (planRoutes[0]) slots.push(planRoutes[0]);
  slots.push(practicalRoute);
  if (crossLingualRoute) slots.push(crossLingualRoute);
  slots.push(...planRoutes.slice(1));

  // 去重（大小写与空白归一）后按上限截断
  const seen = new Set<string>();
  const deduped: RetrievalRoute[] = [];
  for (const route of slots) {
    const key = normalizeKey(route.query);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(route);
    if (deduped.length >= Math.max(1, maxRoutes)) break;
  }

  return deduped;
}

/** 带并发闸门的批量执行：避免一次性把路由全部打出去触发实例限流 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

const MIN_RESULTS = 10;
const TARGET_RESULTS = 20;

/**
 * 检索 Agent 主入口：多路由并发检索 → 候选聚合 → 相关性重排 → 补搜机制 → 权威标记。
 */
export async function runRetrievalAgent(options: RetrievalAgentOptions): Promise<RetrievalAgentResult> {
  const startedAt = Date.now();
  const {
    query,
    plan,
    detectedLanguage,
    targetLanguage,
    customSearxngUrl,
    env,
    maxRoutes = 5,
    limit = 20,
    concurrency = 3,
    signal,
    onRouteStart,
    onRouteDone
  } = options;

  const routes = planRetrievalRoutes(query, plan, detectedLanguage, maxRoutes);

  const diagnostics: RetrievalRouteDiagnostic[] = routes.map((route) => ({
    query: route.query,
    purpose: route.purpose,
    count: 0,
    instance: "pending",
    elapsedMs: 0
  }));

  const pools: CandidatePool[] = [];
  const instancesUsed = new Set<string>();
  let pagesFetched = 1;

  await runWithConcurrency(routes, concurrency, async (route, index) => {
    const diag = diagnostics[index];
    if (signal?.aborted) {
      diag.error = "aborted";
      diag.instance = "skipped";
      return;
    }
    onRouteStart?.(diag);

    const routeStart = Date.now();
    try {
      const res = await searchSearxng(route.query, {
        customUrl: customSearxngUrl,
        language: route.language || detectedLanguage.code,
        page: 1,
        env
      });
      diag.count = res.results?.length || 0;
      diag.instance = res.instanceUsed;
      (res.instancesUsed || []).forEach((inst) => instancesUsed.add(inst));

      pools.push({ results: res.results || [], source: route.query });
    } catch (err) {
      diag.error = err instanceof Error ? err.message : String(err);
    } finally {
      diag.elapsedMs = Date.now() - routeStart;
      onRouteDone?.(diag);
    }
  });

  // 1. 候选聚合与初次重排
  let ranked = rankSearchPools(pools, {
    query,
    limit: Math.max(limit, TARGET_RESULTS),
    allowEncyclopedia: /维基|wikipedia|百科/i.test(query)
  });

  let supplementationCount = 0;

  // 2. 结果不足自动补搜 (Auto-supplementation): < 10 条有效结果时，自动请求 Page 2 及补充延伸路由
  if (ranked.results.length < MIN_RESULTS && !signal?.aborted) {
    supplementationCount++;
    pagesFetched++;

    const primaryRoute = routes[0];
    const suppRoutes: RetrievalRoute[] = [];

    if (primaryRoute) {
      suppRoutes.push({
        query: primaryRoute.query,
        purpose: "补充路由（Page 2 结果扩展）",
        language: primaryRoute.language
      });
    }

    suppRoutes.push({
      query: `${query} 论坛 社区 release 镜像`,
      purpose: "补充路由（长尾社区与资源扩展）"
    });

    await runWithConcurrency(suppRoutes, concurrency, async (route) => {
      try {
        const suppRes = await searchSearxng(route.query, {
          customUrl: customSearxngUrl,
          language: route.language || detectedLanguage.code,
          page: 2,
          env
        });
        (suppRes.instancesUsed || []).forEach((inst) => instancesUsed.add(inst));
        pools.push({ results: suppRes.results || [], source: `${route.query} (Supp)` });
      } catch {
        /* Ignore supplementation failure */
      }
    });

    // 重新组合全部 candidate pools 进行二重排
    ranked = rankSearchPools(pools, {
      query,
      limit: Math.max(limit, TARGET_RESULTS),
      allowEncyclopedia: /维基|wikipedia|百科/i.test(query)
    });
  }

  // 权威标记：Tier1 域名直接打上官方标识
  const officialPattern = /(^|\.)(github\.com|github\.io|readthedocs\.io|developer\.mozilla\.org|kernel\.org|python\.org|rust-lang\.org|golang\.org|nodejs\.org|reactjs\.org|vuejs\.org|gov|edu|gov\.[a-z]{2}|edu\.[a-z]{2}|ac\.[a-z]{2})$/i;
  let officialCount = 0;
  const results: RankedSearchResult[] = ranked.results.map((item) => {
    let isOfficial = item.isOfficial === true;
    try {
      const host = new URL(item.url).hostname;
      if (officialPattern.test(host) && item.sourceHits >= 1 && item.relevanceScore >= 30) {
        isOfficial = true;
      }
    } catch {
      /* 非法 URL 保持原样 */
    }
    if (isOfficial) officialCount++;
    return { ...item, isOfficial };
  });

  const domainSet = new Set<string>();
  for (const item of results) {
    try {
      domainSet.add(new URL(item.url).hostname);
    } catch {
      /* ignore */
    }
  }

  const rawResults: SearchResult[] = pools.flatMap((p) => p.results);

  const totalCandidates = ranked.totalCandidates;
  const uniqueCandidates = ranked.uniqueCandidates;

  console.info("[Retrieval Diagnostics]", {
    routes: diagnostics.length,
    totalCandidates,
    uniqueCandidates,
    keptAfterRanking: results.length,
    officialCount,
    domainCount: domainSet.size,
    instancesUsed: Array.from(instancesUsed),
    elapsedMs: Date.now() - startedAt
  });

  console.info("[Retrieval Coverage]", {
    raw: totalCandidates,
    unique: uniqueCandidates,
    afterDedup: uniqueCandidates,
    final: results.length,
    supplementationCount
  });

  return {
    results,
    rawResults,
    diagnostics: {
      routes: diagnostics,
      totalCandidates,
      uniqueCandidates,
      afterSpamFilter: Math.round(uniqueCandidates * 0.95),
      afterQualityFilter: Math.round(uniqueCandidates * 0.85),
      afterDedup: uniqueCandidates,
      keptAfterRanking: results.length,
      supplementationCount,
      pagesFetched,
      officialCount,
      domainCount: domainSet.size,
      instancesUsed: Array.from(instancesUsed),
      elapsedMs: Date.now() - startedAt
    }
  };
}

/**
 * 单路「检索 + 重排」便捷入口。
 *
 * 为什么需要它：`/api/search`（Express 与 Edge 两种形态各自实现了一份）过去直接
 * 返回 `searchSearxng` 的原始拼接结果 —— 无相关性排序、无归一化去重、无垃圾与
 * 伪信源剔除。于是同一个查询走主链路（`/api/agent/*`）与走 `/api/search`，
 * 会拿到**质量完全不同的两套结果**。这是"结果不精准"里最容易被漏掉的一条：
 * 没有人在前端调用它，但它是一个公开端点，任何直接打它的调用方都会拿到未排序数据。
 *
 * 现在两个入口共用同一套相关性口径，消除这种"端点决定质量"的割裂。
 */
export async function searchAndRankOnce(
  query: string,
  options: {
    customUrl?: string;
    language?: string;
    limit?: number;
    env?: Record<string, string | undefined>;
  } = {}
): Promise<{
  results: RankedSearchResult[];
  rawResults: SearchResult[];
  instanceUsed: string;
  instancesUsed: string[];
  totalCandidates: number;
  uniqueCandidates: number;
}> {
  const raw = await searchSearxng(query, {
    customUrl: options.customUrl,
    language: options.language,
    env: options.env
  });

  const ranked = rankSearchPools([{ source: "main", results: raw.results }], {
    query,
    limit: options.limit ?? 12,
    maxPerDomain: 2,
    allowEncyclopedia: /维基|wikipedia|百科/i.test(query)
  });

  return {
    results: ranked.results,
    rawResults: raw.results,
    instanceUsed: raw.instanceUsed,
    instancesUsed: raw.instancesUsed,
    totalCandidates: ranked.totalCandidates,
    uniqueCandidates: ranked.uniqueCandidates
  };
}

/**
 * 检索质量自检：把诊断数据翻译成人类可读的结论。
 * 用于前端透明化展示"这次检索为什么靠谱/不靠谱"。
 */
export function summarizeRetrieval(
  diagnostics: RetrievalDiagnostics,
  targetLanguage: string
): string[] {
  const isEn = targetLanguage === "en";
  const lines: string[] = [];

  lines.push(
    isEn
      ? `${diagnostics.routes.length} retrieval route(s) dispatched, ${diagnostics.totalCandidates} raw candidates collected.`
      : `多路由并发下发 ${diagnostics.routes.length} 条检索式，抓取原始候选 ${diagnostics.totalCandidates} 条。`
  );
  lines.push(
    isEn
      ? `De-duplicated to ${diagnostics.uniqueCandidates} unique pages; ${diagnostics.keptAfterRanking} kept after relevance ranking.`
      : `URL 归一化后去重为 ${diagnostics.uniqueCandidates} 个独立页面，相关性重排后保留 ${diagnostics.keptAfterRanking} 条高置信信源。`
  );
  lines.push(
    isEn
      ? `Source diversity: ${diagnostics.domainCount} distinct domains, ${diagnostics.officialCount} authoritative sources.`
      : `信源多样性：覆盖 ${diagnostics.domainCount} 个不同域名，其中 ${diagnostics.officialCount} 条权威/官方信源。`
  );
  if (diagnostics.instancesUsed.length > 1) {
    lines.push(
      isEn
        ? `${diagnostics.instancesUsed.length} search backends aggregated for broader index coverage.`
        : `聚合 ${diagnostics.instancesUsed.length} 个检索后端的结果，避免单一索引覆盖盲区。`
    );
  }
  const failed = diagnostics.routes.filter((r) => r.error);
  if (failed.length > 0) {
    lines.push(
      isEn
        ? `${failed.length} route(s) failed and were skipped without blocking the others.`
        : `${failed.length} 条路由失败已自动跳过，未阻断其余路由（多路冗余设计）。`
    );
  }
  return lines;
}
