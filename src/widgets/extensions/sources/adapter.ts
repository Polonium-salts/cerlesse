import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { SourcesData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const sourcesAdapter: WidgetAdapter<SearchSynthesisResult, SourcesData> = {
  canHandle(_query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(
      (result?.sources && result.sources.length > 0) ||
      (result?.filteredResults && result.filteredResults.length > 0)
    );
  },

  transform(_query: string, result?: SearchSynthesisResult): SourcesData {
    const list = result?.sources || result?.filteredResults || [];
    return {
      sources: list,
      count: list.length,
      activeResult: result
    };
  },

  validate(data: SourcesData): boolean {
    return Boolean(data && Array.isArray(data.sources));
  }
};
