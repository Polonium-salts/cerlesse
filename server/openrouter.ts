/**
 * OpenRouter 兼容层模块
 * 提供对 OpenRouter 供应商环境变量检测与模型列表的辅助支持
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";

export interface OpenRouterModelDef {
  id: string;
  name: string;
  description: string;
  contextLength?: string;
  pricing?: string;
  isRecommended?: boolean;
}

export function isOpenRouterDisabled(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  const source = env || (typeof process !== "undefined" ? process.env : {});
  return (source as Record<string, string | undefined>).OPENROUTER_DISABLED?.trim().toLowerCase() === "true";
}

export function resolveOpenRouterApiKey(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): string | undefined {
  const source = env || (typeof process !== "undefined" ? process.env : {});
  if (isOpenRouterDisabled(source)) return undefined;
  const key = (source as Record<string, string | undefined>).OPENROUTER_API_KEY ||
    (source as Record<string, string | undefined>).OPENROUTER_KEY;
  if (!key || typeof key !== "string") return undefined;
  const trimmed = key.trim();
  if (
    !trimmed ||
    trimmed === "undefined" ||
    trimmed === "null" ||
    trimmed === "your_api_key_here" ||
    trimmed === "your_openrouter_api_key_here" ||
    trimmed.startsWith("your_") ||
    trimmed.length < 8
  ) {
    return undefined;
  }
  return trimmed;
}

export function isOpenRouterEnabled(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  return !isOpenRouterDisabled(env) && Boolean(resolveOpenRouterApiKey(env));
}

export async function loadAvailableFreeModels(
  _env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): Promise<OpenRouterModelDef[]> {
  return [
    {
      id: "openrouter/free",
      name: "OpenRouter Free Router",
      description: "OpenRouter 自动调度免费模型池",
      contextLength: "128k",
      pricing: "Free",
      isRecommended: true
    }
  ];
}
