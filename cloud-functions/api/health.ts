import { PagesFunction, jsonResponse } from "./types.js";
import { getSystemHealth } from "../../server/services/healthService.js";

export const onRequest: PagesFunction = async () => {
  return jsonResponse(getSystemHealth("Tencent Cloud EdgeOne Pages"));
};
