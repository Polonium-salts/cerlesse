import type { SearchResult, SearchSynthesisResult } from "../../../types.js";

export interface SourcesData {
  sources: SearchResult[];
  count: number;
  activeResult?: SearchSynthesisResult;
}
