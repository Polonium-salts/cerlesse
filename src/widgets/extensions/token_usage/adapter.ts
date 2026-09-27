import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { TokenUsageData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const tokenUsageAdapter: WidgetAdapter<SearchSynthesisResult, TokenUsageData> = {
  canHandle(_query: string, _result?: SearchSynthesisResult): boolean {
    // 作为系统常驻遥测与监控组件，恒定保持可用
    return true;
  },

  transform(query: string, result?: SearchSynthesisResult): TokenUsageData {
    return {
      query: query || result?.query || "",
      activeResult: result
    };
  },

  validate(data: TokenUsageData): boolean {
    return Boolean(data);
  }
};
