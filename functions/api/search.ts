import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { searchSearxng } from "../../server/searxng.js";

export const onRequest: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const q = url.searchParams.get("q");

    if (!q || q.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const customUrl = url.searchParams.get("customUrl") || undefined;
    const lang = url.searchParams.get("lang") || undefined;

    const result = await searchSearxng(q, {
      customUrl,
      language: lang,
      env: context.env
    });

    return jsonResponse(result);
  } catch (error: any) {
    console.error("Edge search error:", error);
    return errorResponse(error.message || "搜索服务暂时不可用", 500);
  }
};
