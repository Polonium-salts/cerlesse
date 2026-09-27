import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { ComparisonData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const comparisonAdapter: WidgetAdapter<SearchSynthesisResult, ComparisonData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(
      (result?.comparisonTable && result.comparisonTable.length > 0) ||
      /(对比|区别|vs|versus|哪个好|选型|评估|相比)/i.test(query)
    );
  },

  transform(query: string, result?: SearchSynthesisResult): ComparisonData {
    return {
      query: query || result?.query || "",
      comparisonTable: result?.comparisonTable || [],
      activeResult: result
    };
  },

  validate(data: ComparisonData): boolean {
    return Boolean(data);
  }
};
