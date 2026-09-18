import type { SearchSynthesisResult } from "../../../types.js";

export interface AiAnswerData {
  query: string;
  summary: string;
  activeResult?: SearchSynthesisResult;
}
