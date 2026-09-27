import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { SearchEngineData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const searchEngineAdapter: WidgetAdapter<SearchSynthesisResult, SearchEngineData> = {
  canHandle(query: string): boolean {
    return /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query);
  },

  transform(query: string, result?: SearchSynthesisResult): SearchEngineData {
    return {
      query: query || result?.query || "",
      activeResult: result
    };
  },

  validate(data: SearchEngineData): boolean {
    return Boolean(data);
  }
};
