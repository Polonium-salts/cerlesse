import { SearchResult } from "../../src/types.js";
import { executeWebSearch, DirectSearchOptions, DirectSearchResult } from "../services/searchService.js";

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

  const searchOptions: DirectSearchOptions = {
    limit: input.limit ?? 10,
    language: input.language,
    domains: input.domains,
    recencyDays: input.recencyDays,
    customUrl: runtimeConfig?.customSearxngUrl,
    env: runtimeConfig?.env
  };
  const response = await executeWebSearch(query, searchOptions);
  return { ...response, total: response.results.length };
}

export type { SearchResult };
