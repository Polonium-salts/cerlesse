import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { MindMapData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const mindmapAdapter: WidgetAdapter<SearchSynthesisResult, MindMapData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(
      (result?.mindMap?.children && result.mindMap.children.length > 0) ||
      /(思维导图|架构|拓扑|体系|全景|导图|知识树|mindmap)/i.test(query)
    );
  },

  transform(query: string, result?: SearchSynthesisResult): MindMapData {
    return {
      query: query || result?.query || "",
      mindMap: result?.mindMap,
      activeResult: result
    };
  },

  validate(data: MindMapData): boolean {
    return Boolean(data);
  }
};
