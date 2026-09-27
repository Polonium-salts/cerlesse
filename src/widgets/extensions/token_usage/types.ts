import type { SearchSynthesisResult } from "../../../types.js";

export interface TokenUsageData {
  query: string;
  activeResult?: SearchSynthesisResult;
}
