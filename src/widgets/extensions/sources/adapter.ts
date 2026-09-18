import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { SourcesData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const sourcesAdapter: WidgetAdapter<SearchSynthesisResult, SourcesData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean((result?.filteredResults && result.filteredResults.length > 0) || query);
  },

  transform(query: string, result?: SearchSynthesisResult): SourcesData {
    return {
      query: query || result?.query || "",
      activeResult: result
    };
  },

  validate(data: SourcesData): boolean {
    return Boolean(data);
  }
};
