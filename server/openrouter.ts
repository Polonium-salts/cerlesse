/**
 * OpenRouter & UnoRouter 网关兼容层
 */

import {
  GatewayModelDef,
  isGatewayDisabled,
  resolveGateway,
  loadGatewayModels
} from "./gateway.js";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";

export type OpenRouterModelDef = GatewayModelDef;

export function isOpenRouterDisabled(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  return isGatewayDisabled(env);
}

export function resolveOpenRouterApiKey(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): string | undefined {
  const gw = resolveGateway(env);
  if (gw.provider === "openrouter") {
    return gw.apiKey;
  }
  // 兼顾直接读取 OPENROUTER_API_KEY 的场景
  const source = (env || (typeof process !== "undefined" ? process.env : {})) as Record<string, string | undefined>;
  const rawKey = source.OPENROUTER_API_KEY || source.OPENROUTER_KEY;
  if (rawKey && typeof rawKey === "string" && rawKey.trim().length >= 8 && !rawKey.trim().startsWith("your_")) {
    return rawKey.trim();
  }
  return undefined;
}

export function isOpenRouterEnabled(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  return !isOpenRouterDisabled(env) && Boolean(resolveOpenRouterApiKey(env));
}

export async function loadAvailableFreeModels(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): Promise<OpenRouterModelDef[]> {
  const gw = resolveGateway(env);
  return loadGatewayModels(gw);
}
