import { PagesFunction, jsonResponse } from "./types.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ disabled: true, message: "Widget Composer has been permanently disabled." });
};
