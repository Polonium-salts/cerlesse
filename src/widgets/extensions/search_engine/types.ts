import type { SearchSynthesisResult } from "../../../types.js";

export interface SearchEngineData {
  query: string;
  activeResult?: SearchSynthesisResult;
}
