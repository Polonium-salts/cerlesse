import { PagesFunction, jsonResponse, errorResponse, cleanParam, getEffectiveEnv } from "./types.js";
import { executeWebSearch } from "../../server/services/searchService.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  const url = new URL(context.request.url);
  const q = cleanParam(url.searchParams.get("q") || url.searchParams.get("query"));
  if (!q) {
    return errorResponse("缺少搜索关键词", 400);
  }

  const customUrl = cleanParam(url.searchParams.get("customUrl") || url.searchParams.get("searxngUrl"));
  const lang = cleanParam(url.searchParams.get("lang") || url.searchParams.get("language"));
  const limitParam = cleanParam(url.searchParams.get("limit"));
  const limit = limitParam ? Math.max(1, parseInt(limitParam) || 200) : 200;
  const env = getEffectiveEnv(context.env);

  try {
    const res = await executeWebSearch(q, {
      customUrl,
      language: lang,
      limit,
      env
    });

    return jsonResponse({
      results: res.results,
      instanceUsed: res.sourceEngine,
      instancesUsed: res.instancesUsed,
      totalCandidates: res.rawCount,
      uniqueCandidates: res.uniqueCount
    });
  } catch (err: any) {
    return errorResponse(err?.message || "搜索服务暂时不可用", 500);
  }
};
