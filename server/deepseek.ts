/**
 * DeepSeek 官方 API 提供商模块
 * 遵循 OpenAI-compatible 规范，连接 https://api.deepseek.com/v1
 */

export interface DeepSeekModelDef {
  id: string;
  name: string;
  contextWindow: number;
  description?: string;
  pricing?: string;
  isRecommended?: boolean;
}

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

export const DEEPSEEK_MODELS: DeepSeekModelDef[] = [
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    contextWindow: 1_000_000,
    description: "DeepSeek 官方超快极速模型，极高性价比与高并发吞吐 (1M 上下文)",
    pricing: "官方按量计费",
    isRecommended: true
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    contextWindow: 1_000_000,
    description: "DeepSeek 官方全功能专业推理模型，强逻辑与深度综合分析 (1M 上下文)",
    pricing: "官方按量计费",
    isRecommended: false
  }
];

export function resolveDeepSeekApiKey(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): string | undefined {
  const source = env || (typeof process !== "undefined" ? process.env : {});
  const key = (source as Record<string, string | undefined>).DEEPSEEK_API_KEY?.trim();
  if (!key || key.length === 0 || key === "your_api_key_here" || key.startsWith("your_")) {
    return undefined;
  }
  return key;
}

export function isDeepSeekEnabled(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  return Boolean(resolveDeepSeekApiKey(env));
}
