import { SearchResult } from "../../src/types.js";
import { executeWebSearch, DirectSearchOptions, DirectSearchResult } from "../services/searchService.js";
import { planSearchQueries } from "../codex/queryReasoner.js";

export interface SearchWebInput {
  query: string;
  limit?: number;
  language?: string;
  domains?: string[];
  recencyDays?: number;
}

export interface SearchWebOutput extends DirectSearchResult {
  total: number;
}

/** 契约最低信源数量保障：信源存证最少 7 条 */
export const MIN_SOURCES_REQUIREMENT = 7;

/** search_web performs deterministic multi-source web retrieval; it never calls an LLM. */
export async function searchWebTool(
  input: SearchWebInput,
  runtimeConfig?: { customSearxngUrl?: string; env?: Record<string, string | undefined> }
): Promise<SearchWebOutput> {
  const query = (input.query || "").trim();
  if (!query) {
    return {
      results: [],
      total: 0,
      query: "",
      rawCount: 0,
      uniqueCount: 0,
      sourceEngine: "none",
      instancesUsed: [],
      diagnostics: {
        candidateCount: 0,
        uniqueCount: 0,
        sourcesUsed: [],
        sourcesAttempted: [],
        fallbackUsed: false,
        fallbackAttempted: false,
        failures: [],
        rankingRemoved: 0
      }
    };
  }

  const requestedLimit = input.limit ?? 14;
  const searchOptions: DirectSearchOptions = {
    limit: Math.max(requestedLimit, 12),
    language: input.language,
    domains: input.domains,
    recencyDays: input.recencyDays,
    customUrl: runtimeConfig?.customSearxngUrl,
    env: runtimeConfig?.env
  };
  let response = await executeWebSearch(query, searchOptions);

  // 契约规则：若单次搜索内容较少（少于 7 条），自动触发重新再搜索一次（补检/扩展检索）
  if (response.results.length < MIN_SOURCES_REQUIREMENT) {
    const plan = planSearchQueries(query, { language: input.language });
    const alternativeQuery = plan.refinements[0]?.query ||
      (plan.primary.query && plan.primary.query !== query ? plan.primary.query : `${query} 官方`);

    const retryOptions: DirectSearchOptions = {
      ...searchOptions,
      limit: Math.max(searchOptions.limit ?? 12, 16)
    };

    try {
      const retryResponse = await executeWebSearch(alternativeQuery, retryOptions);
      if (retryResponse.results.length > 0) {
        const seenUrls = new Set(response.results.map((r) => r.url));
        const mergedResults = [...response.results];
        for (const item of retryResponse.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            mergedResults.push(item);
          }
        }

        const mergedInstances = Array.from(new Set([...response.instancesUsed, ...retryResponse.instancesUsed]));
        const mergedSourcesUsed = Array.from(new Set([
          ...(response.diagnostics?.sourcesUsed || []),
          ...(retryResponse.diagnostics?.sourcesUsed || [])
        ]));
        const mergedSourcesAttempted = Array.from(new Set([
          ...(response.diagnostics?.sourcesAttempted || []),
          ...(retryResponse.diagnostics?.sourcesAttempted || [])
        ]));

        response = {
          ...response,
          results: mergedResults,
          rawCount: (response.rawCount || 0) + (retryResponse.rawCount || 0),
          uniqueCount: mergedResults.length,
          instancesUsed: mergedInstances,
          diagnostics: {
            ...response.diagnostics,
            candidateCount: (response.diagnostics?.candidateCount || 0) + (retryResponse.diagnostics?.candidateCount || 0),
            uniqueCount: mergedResults.length,
            sourcesUsed: mergedSourcesUsed,
            sourcesAttempted: mergedSourcesAttempted,
            fallbackUsed: response.diagnostics?.fallbackUsed || retryResponse.diagnostics?.fallbackUsed || false,
            fallbackAttempted: response.diagnostics?.fallbackAttempted || retryResponse.diagnostics?.fallbackAttempted || false,
            failures: [...(response.diagnostics?.failures || []), ...(retryResponse.diagnostics?.failures || [])]
          }
        };
      }
    } catch {
      // 容错：若重新搜索出现偶发网络问题，保留第一次搜索的有效结果
    }
  }

  return { ...response, total: response.results.length };
}

export type { SearchResult };
