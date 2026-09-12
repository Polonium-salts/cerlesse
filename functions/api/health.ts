import { PagesFunction, jsonResponse } from "./types.js";

export const onRequest: PagesFunction = async () => {
  return jsonResponse({
    status: "ok",
    runtime: "edgeone-functions",
    timestamp: Date.now()
  });
};
