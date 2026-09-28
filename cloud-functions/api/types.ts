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

export {
  cleanParam,
  extractAuthHeaders,
  getEffectiveEnv,
  jsonResponse,
  errorResponse
} from "../../server/utils/http.js";
