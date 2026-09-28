import { PagesFunction, jsonResponse } from "../types.js";
import { getWidgetsHealth } from "../../../server/services/healthService.js";

export const onRequest: PagesFunction = async () => {
  const { status, body } = getWidgetsHealth();
  return jsonResponse(body, { status });
};
