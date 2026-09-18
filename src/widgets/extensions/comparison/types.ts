import type { SearchSynthesisResult } from "../../../types.js";

export interface ComparisonData {
  query: string;
  comparisonTable?: any[];
  activeResult?: SearchSynthesisResult;
}
