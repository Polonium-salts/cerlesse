import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { AiAnswerData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const aiAnswerAdapter: WidgetAdapter<SearchSynthesisResult, AiAnswerData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(result?.summary || query);
  },

  transform(query: string, result?: SearchSynthesisResult): AiAnswerData {
    return {
      query: query || result?.query || "",
      summary: result?.summary || "",
      activeResult: result
    };
  },

  validate(data: AiAnswerData): boolean {
    return Boolean(data);
  }
};
