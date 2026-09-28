import { PagesFunction, jsonResponse, errorResponse, cleanParam } from "./types.js";
import { executeImageSearch } from "../../server/services/imagesService.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  const url = new URL(context.request.url);
  const q = cleanParam(url.searchParams.get("q") || url.searchParams.get("query"));
  if (!q) {
    return errorResponse("缺少搜索关键词", 400);
  }

  const page = Math.max(parseInt(url.searchParams.get("page") || "1") || 1, 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "36") || 36, 1), 72);
  const customUrl = cleanParam(url.searchParams.get("customUrl") || url.searchParams.get("searxngUrl"));
  const lang = cleanParam(url.searchParams.get("lang") || url.searchParams.get("language"));

  try {
    const result = await executeImageSearch(q, {
      customUrl,
      language: lang,
      limit,
      page
    });
    return jsonResponse(result);
  } catch (error) {
    console.error("Images search error:", error);
    return errorResponse(error instanceof Error ? error.message : "图片检索失败", 500);
  }
};
