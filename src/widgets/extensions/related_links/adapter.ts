import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { RelatedLinksData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const relatedLinksAdapter: WidgetAdapter<SearchSynthesisResult, RelatedLinksData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    // 网站导航与权威跳转：作为核心常驻组件之一，始终能够为查询生成权威入口或搜索直达
    return true;
  },

  transform(query: string, result?: SearchSynthesisResult): RelatedLinksData {
    return {
      query: query || result?.query || "",
      activeResult: result
    };
  },

  validate(data: RelatedLinksData): boolean {
    return Boolean(data);
  }
};
