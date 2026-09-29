import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { AiAnswerData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const aiAnswerAdapter: WidgetAdapter<SearchSynthesisResult, AiAnswerData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(result?.summary || query);
  },

  transform(query: string, result?: SearchSynthesisResult): AiAnswerData {
    const inputChars = result?.summary?.length || 0;
    const outputSummary = result?.summary || "";
    if (typeof console !== "undefined") {
      console.log(`[PipelineMetrics][DataPipeline] inputSummaryChars=${inputChars}, outputSummaryChars=${outputSummary.length}, droppedChars=0 (100% preserved)`);
    }

    return {
      query: query || result?.query || "",
      summary: outputSummary,
      activeResult: result
    };
  },

  validate(data: AiAnswerData): boolean {
    return Boolean(data);
  }
};
