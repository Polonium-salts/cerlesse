/**
 * Tencent Cloud EdgeOne Pages / Cloud Functions TypeScript Definitions
 * Compatible with EdgeOne Functions & Cloudflare Pages Functions
 */

export interface EventContext<Env = Record<string, string | undefined>, P extends string = any, Data = any> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

export type PagesFunction<
  Env = Record<string, string | undefined>,
  P extends string = any,
  Data = any
> = (context: EventContext<Env, P, Data>) => Response | Promise<Response>;

export function jsonResponse(data: any, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      ...(init?.headers || {})
    }
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, { status });
}
