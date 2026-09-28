import { PagesFunction, jsonResponse } from "./types.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "规划由 Codex 搜索 Agent 统一完成。" }, { status: 410 });
};
