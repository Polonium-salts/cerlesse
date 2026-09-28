/**
 * Unified HTTP and Web Standard helpers for EdgeOne Functions, Express, and Serverless APIs.
 */

export function cleanParam(val?: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

export function extractAuthHeaders(source: Request | { headers?: Record<string, any>; query?: Record<string, any>; body?: Record<string, any> }) {
  let apiKey: string | undefined;
  let apiBaseUrl: string | undefined;
  let provider: string | undefined;

  if (typeof (source as Request).headers?.get === "function") {
    const req = source as Request;
    const reqHeaders = req.headers;
    apiKey =
      cleanParam(reqHeaders.get("x-custom-api-key")) ||
      cleanParam(reqHeaders.get("authorization")?.replace(/^Bearer\s+/i, ""));
    apiBaseUrl = cleanParam(reqHeaders.get("x-custom-base-url"));
    provider = cleanParam(reqHeaders.get("x-custom-provider"));
  } else {
    const obj = source as { headers?: Record<string, any>; query?: Record<string, any>; body?: Record<string, any> };
    const headers = obj.headers || {};
    apiKey =
      cleanParam(headers["x-custom-api-key"]) ||
      cleanParam(typeof headers["authorization"] === "string" ? headers["authorization"].replace(/^Bearer\s+/i, "") : undefined) ||
      cleanParam(obj.body?.apiKey) ||
      cleanParam(obj.query?.apiKey);
    apiBaseUrl =
      cleanParam(headers["x-custom-base-url"]) ||
      cleanParam(obj.body?.apiBaseUrl) ||
      cleanParam(obj.query?.apiBaseUrl);
    provider =
      cleanParam(headers["x-custom-provider"]) ||
      cleanParam(obj.body?.provider) ||
      cleanParam(obj.query?.provider);
  }

  return { apiKey, apiBaseUrl, provider };
}

export function getEffectiveEnv(contextEnv?: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    ...(typeof process !== "undefined" ? process.env : {}),
    ...(contextEnv || {})
  };
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, x-custom-api-key, x-custom-base-url, x-custom-provider",
      ...(init?.headers || {})
    }
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, { status });
}
