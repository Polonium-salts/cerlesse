import { PagesFunction, jsonResponse } from "../types.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "AI 卡片生成 API 已暂时移除。" }, { status: 503 });
};
