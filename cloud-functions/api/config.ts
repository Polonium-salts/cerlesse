import { PagesFunction, jsonResponse, getEffectiveEnv } from "./types.js";
import { getSystemConfig } from "../../server/services/modelsService.js";

export const onRequest: PagesFunction = async (context) => {
  const env = getEffectiveEnv(context.env);
  const config = getSystemConfig(env);

  return jsonResponse({
    ...config,
    platform: "Tencent Cloud EdgeOne"
  });
};
