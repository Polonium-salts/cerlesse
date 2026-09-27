import type { SearchResult } from "../src/types.js";
import { normalizeUrlKey } from "./retrievalRanker.js";

export const WEB_SEARCH_RESULT_TARGET = 8;
export const WEB_SEARCH_MAX_SEARXNG_INSTANCES = 5;

export interface WebSearchSourceBatch {
  source: string;
  results: SearchResult[];
}

export interface WebSearchDiagnostics {
  candidateCount: number;
  uniqueCount: number;
  sourcesUsed: string[];
  sourcesAttempted: string[];
  fallbackUsed: boolean;
  fallbackAttempted: boolean;
  failures: string[];
}

export interface WebSearchCollection {
  results: SearchResult[];
  diagnostics: WebSearchDiagnostics;
}

const sourcePriority = (source: string): number => {
  if (source === "Direct Web Engine") return 0;
  if (source.startsWith("SearXNG ")) return 1;
  if (source === "DuckDuckGo Web") return 2;
  return 3;
};

/** Stable merge in source priority order; completion order is irrelevant. */
export function mergeWebSearchBatches(batches: WebSearchSourceBatch[]): WebSearchCollection {
  const ordered = [...batches].sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source) || a.source.localeCompare(b.source));
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  const sourcesUsed: string[] = [];
  let candidateCount = 0;

  for (const batch of ordered) {
    const batchResults = Array.isArray(batch.results) ? batch.results : [];
    candidateCount += batchResults.length;
    if (batchResults.length > 0) sourcesUsed.push(batch.source);
    for (const result of batchResults) {
      if (!result?.url) continue;
      const key = normalizeUrlKey(result.url);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(result);
    }
  }

  return {
    results,
    diagnostics: {
      candidateCount,
      uniqueCount: results.length,
      sourcesUsed,
      sourcesAttempted: ordered.map((batch) => batch.source),
      fallbackUsed: sourcesUsed.includes("DuckDuckGo Web"),
      fallbackAttempted: false,
      failures: []
    }
  };
}

export interface WebSearchCollectorOptions {
  query: string;
  direct: () => Promise<SearchResult[]>;
  searxng: Array<{ source: string; search: () => Promise<SearchResult[]> }>;
  fallback: () => Promise<SearchResult[]>;
  target?: number;
}

/** Wait for all scheduled primary sources, then use at most one bounded fallback. */
export async function collectWebSearchResults(
  options: WebSearchCollectorOptions
): Promise<WebSearchCollection> {
  const failures: string[] = [];
  const jobs = [
    { source: "Direct Web Engine", search: options.direct },
    ...options.searxng
  ];
  const settled = await Promise.all(jobs.map(async ({ source, search }) => {
    try {
      return { source, results: await search() };
    } catch (error) {
      failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
      return { source, results: [] as SearchResult[] };
    }
  }));

  let collection = mergeWebSearchBatches(settled);
  const target = Math.max(1, options.target ?? WEB_SEARCH_RESULT_TARGET);
  let fallbackAttempted = false;
  if (collection.results.length < target) {
    fallbackAttempted = true;
    try {
      const fallbackResults = await options.fallback();
      collection = mergeWebSearchBatches([
        ...settled,
        { source: "DuckDuckGo Web", results: fallbackResults }
      ]);
    } catch (error) {
      failures.push(`DuckDuckGo Web: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    results: collection.results,
    diagnostics: {
      ...collection.diagnostics,
      sourcesAttempted: Array.from(new Set([...collection.diagnostics.sourcesAttempted, ...(fallbackAttempted ? ["DuckDuckGo Web"] : [])])),
      fallbackAttempted,
      failures
    }
  };
}
