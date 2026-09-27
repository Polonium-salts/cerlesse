import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { TokenUsageData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const tokenUsageAdapter: WidgetAdapter<SearchSynthesisResult, TokenUsageData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(
      result?.tokenUsage ||
      /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i.test(query)
    );
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
