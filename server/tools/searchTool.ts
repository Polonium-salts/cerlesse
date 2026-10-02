import { SearchResult } from "../../src/types.js";
import { executeWebSearch, DirectSearchOptions, DirectSearchResult } from "../services/searchService.js";
import { SEARCH_POLICY } from "../searchPolicy.js";

export interface SearchWebInput {
  query: string;
  limit?: number;
  language?: string;
  domains?: string[];
  recencyDays?: number;
}

export interface SearchWebOutput extends DirectSearchResult {
  total: number;
  /** 当结果条数低于 SEARCH_POLICY.minSources 时标记为 true */
  insufficient: boolean;
  /** 距离最低信源保障线还差多少条，便于 Agent 评估补搜诉求 */
  shortfall: number;
}

/** 契约最低信源数量保障：引用 SEARCH_POLICY.minSources */
export const MIN_SOURCES_REQUIREMENT = SEARCH_POLICY.minSources;

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
      insufficient: true,
      shortfall: SEARCH_POLICY.minSources,
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

  // 严格生效 input.limit，受 targetSources 兜底并受 hardCap 截断
  const limit = Math.min(input.limit ?? SEARCH_POLICY.targetSources, SEARCH_POLICY.hardCap);
  const searchOptions: DirectSearchOptions = {
    limit,
    language: input.language,
    domains: input.domains,
    recencyDays: input.recencyDays,
    customUrl: runtimeConfig?.customSearxngUrl,
    env: runtimeConfig?.env
  };

  const response = await executeWebSearch(query, searchOptions);
  const total = response.results.length;
  const insufficient = total < SEARCH_POLICY.minSources;
  const shortfall = Math.max(0, SEARCH_POLICY.minSources - total);

  return {
    ...response,
    total,
    insufficient,
    shortfall
  };
}

export type { SearchResult };
