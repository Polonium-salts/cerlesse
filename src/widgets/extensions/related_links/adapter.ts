import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { RelatedLinksData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const relatedLinksAdapter: WidgetAdapter<SearchSynthesisResult, RelatedLinksData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    const hasOfficialOrUrls = Boolean(
      (result?.filteredResults && result.filteredResults.length > 0) ||
      /(官网|官方|入口|登录|网址|portal|official)/i.test(query)
    );
    return hasOfficialOrUrls;
  },

  transform(query: string, result?: SearchSynthesisResult): RelatedLinksData {
    return {
      query: query || result?.query || "",
      activeResult: result
    };
  },

  validate(data: RelatedLinksData): boolean {
    return Boolean(data);
  }
};
