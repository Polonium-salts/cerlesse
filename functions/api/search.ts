import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { searchAndRankOnce } from "../../server/retrievalAgent.js";

export const onRequest: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const q = url.searchParams.get("q");

    if (!q || q.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const customUrl = url.searchParams.get("customUrl") || undefined;
    const lang = url.searchParams.get("lang") || undefined;

    // 与主链路（/api/agent/*）共用同一套「检索 + 相关性重排」口径。
    // 本端点过去直接吐 searchSearxng 的原始拼接结果 —— 无排序、无归一化去重、
    // 无垃圾与伪信源剔除，与主链路的结果质量完全脱节。
    const ranked = await searchAndRankOnce(q, {
      customUrl,
      language: lang,
      limit: 12,
      env: context.env
    });

    return jsonResponse({
      results: ranked.results,
      instanceUsed: ranked.instanceUsed,
      instancesUsed: ranked.instancesUsed,
      // 把候选池与去重统计一并返回，便于调用方判断本次结果的可信度
      totalCandidates: ranked.totalCandidates,
      uniqueCandidates: ranked.uniqueCandidates
    });
  } catch (error: any) {
    console.error("Edge search error:", error);
    return errorResponse(error.message || "搜索服务暂时不可用", 500);
  }
};
