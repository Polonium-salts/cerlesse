import { PagesFunction, jsonResponse, getEffectiveEnv } from "../types.js";
import { getAgentHealth } from "../../../server/services/healthService.js";

export const onRequest: PagesFunction = async (context) => {
  const env = getEffectiveEnv(context.env);
  const { status, body } = await getAgentHealth(env);
  return jsonResponse(body, { status });
};
