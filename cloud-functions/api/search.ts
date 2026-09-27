import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { executeWebSearch } from "../../server/services/searchService.js";

function cleanParam(val?: any): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const q = cleanParam(url.searchParams.get("q") || url.searchParams.get("query"));
  if (!q) {
    return errorResponse("缺少搜索关键词", 400);
  }

  const customUrl = cleanParam(url.searchParams.get("customUrl") || url.searchParams.get("searxngUrl"));
  const lang = cleanParam(url.searchParams.get("lang") || url.searchParams.get("language"));

  try {
    const res = await executeWebSearch(q, {
      customUrl,
      language: lang,
      limit: 20,
      env: context.env
    });

    return jsonResponse({
      results: res.results,
      instanceUsed: res.sourceEngine,
      instancesUsed: res.instancesUsed,
      totalCandidates: res.rawCount,
      uniqueCandidates: res.uniqueCount
    });
  } catch (err: any) {
    return errorResponse(err?.message || "检索服务不可用", 500);
  }
};

