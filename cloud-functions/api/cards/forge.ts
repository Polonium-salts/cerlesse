import { PagesFunction, jsonResponse, errorResponse } from "../types.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  return errorResponse("AI 卡片生成 API 已暂时移除。", 503);
};

export default onRequest;
