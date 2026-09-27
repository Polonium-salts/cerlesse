import { PagesFunction, jsonResponse } from "./types.js";

export const onRequest: PagesFunction = async () => {
  return jsonResponse({
    status: "ok",
    timestamp: Date.now(),
    platform: "EdgeOne Cloud Functions",
    nodeVersion: typeof process !== "undefined" ? process.version : "edge"
  });
};

export default onRequest;
