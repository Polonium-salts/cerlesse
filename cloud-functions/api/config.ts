import { PagesFunction, jsonResponse, getEffectiveEnv } from "./types.js";
import { getSystemConfig } from "../../server/services/modelsService.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  const env = getEffectiveEnv(context.env);
  const config = await getSystemConfig(env);

  return jsonResponse({
    ...config,
    platform: "Tencent Cloud EdgeOne"
  });
};
