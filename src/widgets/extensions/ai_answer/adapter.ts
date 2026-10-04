import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { AiAnswerData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const aiAnswerAdapter: WidgetAdapter<SearchSynthesisResult, AiAnswerData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(result?.summary || (result as any)?.answer || (result as any)?.content || (result as any)?.chatText || query);
  },

  transform(query: string, result?: SearchSynthesisResult): AiAnswerData {
    const rawSummary =
      result?.summary ||
      (result as any)?.answer ||
      (result as any)?.content ||
      (result as any)?.chatText ||
      (result as any)?.text ||
      (result as any)?.finalResponse ||
      "";
    return {
      query: query || result?.query || "",
      summary: rawSummary,
      activeResult: result
    };
  },

  validate(data: AiAnswerData): boolean {
    return Boolean(data);
  }
};
