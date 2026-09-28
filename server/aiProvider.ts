import { APIError } from "@aktagon/llmkit-ts";
import type { Client } from "@aktagon/llmkit-ts";
import { openai } from "@aktagon/llmkit-ts/builders";
import {
  resolveGateway,
  isGatewayDisabled,
  loadGatewayModels,
  GATEWAY_REGISTRY,
  ResolvedGateway
} from "./gateway.js";

export * from "./gateway.js";

// 规范默认地址与模型：以 UnoRouter 网关为核心
export const DEFAULT_AI_API_BASE_URL = "https://api.unorouter.com";
export const DEFAULT_AI_MODEL = "deepseek/deepseek-chat";

export interface AiApiConfig {
  apiBaseUrl: string;
  model: string;
  hasApiKey: boolean;
  isDisabled: boolean;
}

export interface AiApiModel {
  id: string;
  name: string;
  description: string;
  contextLength: string;
  pricing: "Unknown" | string;
  isRecommended?: boolean;
}

export type ModelProviderType = "unorouter" | "openai" | "deepseek" | "openrouter" | "custom" | "none";

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength?: string;
  pricing?: string;
  isRecommended?: boolean;
}

export interface ModelProviderStatus {
  provider: ModelProviderType;
  ready: boolean;
  reason?: string;
  models: ModelInfo[];
  defaultModel?: string;
  hasApiKey: boolean;
  hasUnoRouterKey?: boolean;
  isAiApiDisabled: boolean;
}

export class LlmProviderError extends Error {
  constructor(message: string, public readonly code: string, public readonly status?: number) {
    super(message);
    this.name = "LlmProviderError";
  }
}

function environment(env?: Record<string, string | undefined>): Record<string, string | undefined> {
  return env !== undefined
    ? env
    : (typeof process !== "undefined" ? process.env : {});
}

function isValidKeyString(key?: string): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  return Boolean(
    trimmed &&
    trimmed !== "undefined" &&
    trimmed !== "null" &&
    trimmed !== "your_api_key_here" &&
    trimmed !== "your_openai_api_key_here" &&
    trimmed !== "your_unorouter_api_key_here" &&
    !trimmed.startsWith("your_") &&
    trimmed.length >= 8
  );
}

export function isAiApiDisabled(env?: Record<string, string | undefined>): boolean {
  const source = environment(env);
  return isGatewayDisabled(source);
}

export function resolveAiApiKey(env?: Record<string, string | undefined>): string | undefined {
  const source = environment(env);
  if (isAiApiDisabled(source)) return undefined;

  // 1. UnoRouter 网关 API Key
  const gateway = resolveGateway(source);
  if (gateway.apiKey) {
    return gateway.apiKey;
  }

  // 2. 显式配置的通用 AI_API_KEY
  if (isValidKeyString(source.AI_API_KEY)) {
    return source.AI_API_KEY!.trim();
  }

  return undefined;
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new LlmProviderError("AI_API_BASE_URL 必须是有效的绝对 HTTP(S) 地址。", "invalid_base_url", 500);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LlmProviderError("AI_API_BASE_URL 仅支持 HTTP 或 HTTPS。", "invalid_base_url", 500);
  }
  // llmkit 追加 /v1/chat/completions，规范化去除多余后缀
  let pathname = url.pathname.replace(/\/+$/, "");
  pathname = pathname.replace(/\/chat\/completions$/i, "");
  pathname = pathname.replace(/\/v1$/i, "");
  return `${url.origin}${pathname}`.replace(/\/+$/, "");
}

export function sanitizeModelForBaseUrl(model: string, baseUrl: string): string {
  if (!model || !model.trim()) return DEFAULT_AI_MODEL;
  const trimmed = model.trim();
  const baseLower = (baseUrl || "").toLowerCase();

  if (baseLower.includes("api.openai.com")) {
    if (trimmed.includes("/") || trimmed.includes("deepseek")) {
      return "gpt-4o-mini";
    }
  }

  return trimmed;
}

export function getAiApiConfig(env?: Record<string, string | undefined>): AiApiConfig {
  const source = environment(env);
  const gateway = resolveGateway(source);

  const defaultBase = gateway.baseUrl || (source.AI_API_KEY && !source.UNOROUTER_API_KEY ? "https://api.openai.com" : DEFAULT_AI_API_BASE_URL);
  const defaultModel = gateway.defaultModel || DEFAULT_AI_MODEL;

  const configuredBase = source.AI_API_BASE_URL?.trim() || defaultBase;
  const normalizedBase = normalizeBaseUrl(configuredBase);
  const rawModel = source.AI_MODEL?.trim() || defaultModel;
  const configuredModel = source.AI_MODEL ? sanitizeModelForBaseUrl(rawModel, normalizedBase) : defaultModel;

  return {
    apiBaseUrl: normalizedBase,
    model: configuredModel,
    hasApiKey: Boolean(resolveAiApiKey(source)),
    isDisabled: isAiApiDisabled(source)
  };
}

/** Construct an OpenAI-compatible client; credentials and endpoints are server-side only. */
export function getAiApiClient(env?: Record<string, string | undefined>): Client {
  const source = environment(env);
  if (isAiApiDisabled(source)) {
    throw new LlmProviderError("AI API 当前已禁用。", "provider_disabled", 503);
  }
  const apiKey = resolveAiApiKey(source);
  if (!apiKey) {
    throw new LlmProviderError("未配置有效的 UNOROUTER_API_KEY 或 AI_API_KEY。", "missing_api_key", 503);
  }
  const config = getAiApiConfig(source);
  return openai(apiKey).baseURL(config.apiBaseUrl);
}

export function getProviderStatus(env?: Record<string, string | undefined>): {
  hasApiKey: boolean;
  isAiApiDisabled: boolean;
} {
  const source = environment(env);
  return {
    hasApiKey: Boolean(resolveAiApiKey(source)),
    isAiApiDisabled: isAiApiDisabled(source)
  };
}

/**
 * 单一出口解析模型提供商状态 (Single Source of Truth)
 * 统一汇聚状态，供启动日志、/api/config、前端模型选择器与健康检查共用。
 */
export function resolveModelProvider(env?: Record<string, string | undefined>): ModelProviderStatus {
  const source = environment(env);
  const disabled = isAiApiDisabled(source);
  const gateway = resolveGateway(source);
  const unoRouterReady = !disabled && gateway.provider === "unorouter";
  const apiKey = resolveAiApiKey(source);
  const hasKey = Boolean(apiKey);

  if (disabled) {
    return {
      provider: "none",
      ready: false,
      reason: "模型提供商已禁用 (AI_API_DISABLED/GATEWAY_DISABLED=true)",
      models: [],
      defaultModel: undefined,
      hasApiKey: hasKey,
      hasUnoRouterKey: unoRouterReady,
      isAiApiDisabled: true
    };
  }

  if (!hasKey) {
    return {
      provider: "none",
      ready: false,
      reason: "未配置 API Key，请在环境变量或设置中配置 UNOROUTER_API_KEY",
      models: [],
      defaultModel: undefined,
      hasApiKey: false,
      hasUnoRouterKey: false,
      isAiApiDisabled: false
    };
  }

  const config = getAiApiConfig(source);
  let providerType: ModelProviderType = "unorouter";
  const urlLower = config.apiBaseUrl.toLowerCase();

  if (urlLower.includes("api.openai.com")) {
    providerType = "openai";
  } else if (urlLower.includes("unorouter.com") || gateway.provider === "unorouter") {
    providerType = "unorouter";
  } else {
    providerType = "custom";
  }

  // 杜绝静态硬编码第三方模型列表；以当前环境配置或默认 AI_MODEL 为准
  const activeModelId = config.model || (providerType === "unorouter" ? DEFAULT_AI_MODEL : "gpt-4o-mini");
  const models: ModelInfo[] = [
    {
      id: activeModelId,
      name: activeModelId,
      description: `已配置模型 (${activeModelId})`,
      contextLength: "128k",
      pricing: providerType === "unorouter" ? "低费率" : "按量计费",
      isRecommended: true
    }
  ];

  return {
    provider: providerType,
    ready: true,
    models,
    defaultModel: activeModelId,
    hasApiKey: true,
    hasUnoRouterKey: unoRouterReady,
    isAiApiDisabled: false
  };
}

export function respondAgentError(
  error: unknown,
  sink?: any
): { status: number; message: string } {
  const err = error instanceof LlmProviderError ? error : toLlmProviderError(error);
  const status = err.status ?? (err.code === "provider_disabled" || err.code === "missing_api_key" ? 503 : 500);
  const message = err.message;

  if (sink) {
    if (typeof sink === "function") {
      sink("error", { message, status });
    } else if (typeof sink.status === "function") {
      sink.status(status).json({ error: message });
    }
  }

  return { status, message };
}

export async function pingModel(
  _statusOrEnv?: any
): Promise<{ ok: boolean; provider: string; latencyMs?: number; error?: string }> {
  return checkAiHealth(typeof _statusOrEnv === "object" && !("provider" in _statusOrEnv) ? _statusOrEnv : undefined);
}

/** 探测连通性并拉取上游提供商与模型 */
export async function checkAiHealth(
  env?: Record<string, string | undefined>
): Promise<{ ok: boolean; provider: string; latencyMs?: number; error?: string }> {
  const status = resolveModelProvider(env);
  if (!status.ready) {
    return { ok: false, provider: status.provider, error: status.reason || "模型服务未就绪" };
  }

  const config = getAiApiConfig(env);
  const apiKey = resolveAiApiKey(env);
  const startTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    let res = await fetch(`${config.apiBaseUrl}/models`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "Cerlesse-Health-Check/1.0"
      },
      signal: controller.signal
    });
    if (res.status === 404) {
      res = await fetch(`${config.apiBaseUrl}/v1/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "Cerlesse-Health-Check/1.0"
        },
        signal: controller.signal
      });
    }
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, provider: status.provider, error: `API Key 鉴权失败 (HTTP ${res.status})` };
    }
    return { ok: true, provider: status.provider, latencyMs };
  } catch (error) {
    clearTimeout(timer);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, provider: status.provider, error: `模型服务连通性异常: ${message}` };
  }
}

export function toLlmProviderError(error: unknown): LlmProviderError {
  if (error instanceof LlmProviderError) return error;

  if (error instanceof APIError) {
    const status = error.statusCode;
    let extractedMessage = error.message;
    try {
      const parsed = JSON.parse(extractedMessage);
      if (parsed?.error?.message) extractedMessage = parsed.error.message;
    } catch {}

    const isApiKeyError = status === 401 || /api[\s_-]?key.*(?:not found|invalid|missing|please pass)/i.test(extractedMessage);
    const code = isApiKeyError
      ? "invalid_api_key"
      : status === 403
        ? "access_denied"
        : status === 429
          ? "rate_limited"
          : "provider_error";
    const httpStatus = isApiKeyError
      ? 401
      : status === 403 || status === 429
        ? status
        : 502;
    const message = isApiKeyError
      ? `AI API Key 无效或未获授权（${extractedMessage}）。`
      : status === 403
        ? `AI API 拒绝访问（${extractedMessage}）。`
        : status === 429
          ? `AI API 请求触发限流（${extractedMessage}）。`
          : `AI API 请求失败（HTTP ${status}：${extractedMessage}）。`;
    return new LlmProviderError(message, code, httpStatus);
  }

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.includes("timeout") || error.message.includes("aborted")) {
      return new LlmProviderError("AI 模型请求超时，请稍后重试。", "provider_timeout", 504);
    }
    const message = error.message;
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT") || message.includes("ENOTFOUND")) {
      return new LlmProviderError(`无法连接到 AI 提供商（${message}）。请检查网络或 AI_API_BASE_URL。`, "connection_failed", 502);
    }
    return new LlmProviderError(message, "internal_error", 500);
  }

  return new LlmProviderError("未知的 AI 模型错误。", "unknown", 500);
}

export interface DetectedProviderResult {
  success: boolean;
  provider: ModelProviderType;
  providerName: string;
  apiBaseUrl: string;
  models: ModelInfo[];
  defaultModel?: string;
  source: "remote_api" | "preset_catalog" | "env";
  message?: string;
  error?: string;
}

/**
 * 启发式探测上游服务商并尝试实时从 /models 提取可用模型
 */
export async function detectAndFetchModels(params: {
  apiKey?: string;
  apiBaseUrl?: string;
  provider?: string;
  env?: Record<string, string | undefined>;
}): Promise<DetectedProviderResult> {
  const env = environment(params.env);
  const rawKey = params.apiKey?.trim() || resolveAiApiKey(env) || "";
  let rawBase = params.apiBaseUrl?.trim() || "";

  // 1. 启发式识别 Provider 类型与规范 Base URL
  let providerType: ModelProviderType = "unorouter";
  let providerName = "UnoRouter 聚合网关";
  let defaultModel = "deepseek/deepseek-chat";

  const keyLower = rawKey.toLowerCase();
  const baseLower = rawBase.toLowerCase();

  if (baseLower.includes("deepseek.com") || (keyLower.startsWith("sk-") && baseLower.includes("deepseek")) || params.provider === "deepseek") {
    providerType = "deepseek";
    providerName = "DeepSeek 官方 API";
    rawBase = rawBase || "https://api.deepseek.com/v1";
    defaultModel = "deepseek-chat";
  } else if (keyLower.startsWith("sk-or-") || baseLower.includes("openrouter.ai") || params.provider === "openrouter") {
    providerType = "openrouter";
    providerName = "OpenRouter 聚合网关";
    rawBase = rawBase || "https://openrouter.ai/api/v1";
    defaultModel = "openrouter/free";
  } else if (baseLower.includes("openai.com") || keyLower.startsWith("sk-proj-") || params.provider === "openai") {
    providerType = "openai";
    providerName = "OpenAI 官方 API";
    rawBase = rawBase || "https://api.openai.com/v1";
    defaultModel = "gpt-4o-mini";
  } else if (baseLower && !baseLower.includes("unorouter.com") && params.provider === "custom") {
    providerType = "custom";
    providerName = "自定义 OpenAI 兼容网关";
    defaultModel = "gpt-4o-mini";
  } else {
    // 默认首选 UnoRouter 聚合网关
    providerType = "unorouter";
    providerName = "UnoRouter 聚合网关";
    rawBase = rawBase || "https://api.unorouter.com/v1";
    defaultModel = "deepseek/deepseek-chat";
  }

  // 规范化 Base URL
  const normalizedBase = rawBase.replace(/\/+$/, "");

  // 2. 尝试从远程 /models 接口动态探查加载真实可用模型
  if (rawKey && isValidKeyString(rawKey)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      let endpoint = `${normalizedBase}/models`;
      let res = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${rawKey}`,
          "User-Agent": "Cerlesse-Model-Detector/1.0"
        },
        signal: controller.signal
      });

      if (res.status === 404 && !normalizedBase.endsWith("/v1")) {
        endpoint = `${normalizedBase}/v1/models`;
        res = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${rawKey}`,
            "User-Agent": "Cerlesse-Model-Detector/1.0"
          },
          signal: controller.signal
        });
      }

      clearTimeout(timeout);

      if (res.ok) {
        const body = await res.json();
        const rawList = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];

        if (rawList.length > 0) {
          const models: ModelInfo[] = rawList.map((item: any) => {
            const id = String(item.id || item.name || "");
            const name = String(item.name || item.id || "");
            const isRec = id.includes("deepseek-chat") || id.includes("deepseek-reasoner") || id.includes("free");
            return {
              id,
              name,
              description: item.description || `上游实时可用模型 (${id})`,
              contextLength: item.context_length ? `${Math.round(item.context_length / 1000)}k` : "128k",
              pricing: item.pricing?.prompt ? `$${item.pricing.prompt}/M` : "上游计费",
              isRecommended: isRec
            };
          });

          // 排序：推荐模型和常用模型排在前面
          models.sort((a, b) => {
            if (a.isRecommended && !b.isRecommended) return -1;
            if (!a.isRecommended && b.isRecommended) return 1;
            return a.name.localeCompare(b.name);
          });

          const activeDefault = models.some((m) => m.id === defaultModel) ? defaultModel : models[0]?.id;

          return {
            success: true,
            provider: providerType,
            providerName,
            apiBaseUrl: normalizedBase,
            models,
            defaultModel: activeDefault,
            source: "remote_api",
            message: `成功连通 ${providerName}，自动拉取到 ${models.length} 个可用模型`
          };
        }
      }
    } catch {
      clearTimeout(timeout);
      // 远程探测失败，平滑降级至内置预设列表
    }
  }

  // 3. 降级回退：不再内置硬编码静态模型列表，未探测到远程模型时仅保留当前默认配置模型
  const fallbackModels: ModelInfo[] = defaultModel
    ? [
        {
          id: defaultModel,
          name: defaultModel,
          description: `${providerName} 默认模型 (${defaultModel})`,
          contextLength: "128k",
          pricing: "标准",
          isRecommended: true
        }
      ]
    : [];

  return {
    success: true,
    provider: providerType,
    providerName,
    apiBaseUrl: normalizedBase,
    models: fallbackModels,
    defaultModel: fallbackModels[0]?.id || defaultModel,
    source: "preset_catalog",
    message: fallbackModels.length > 0
      ? `已连接 ${providerName}，当前模型为 ${defaultModel}`
      : `已连接 ${providerName}`
  };
}

/** Expose the configured model without leaking keys or probing provider-specific model APIs. */
export function loadAvailableModels(env?: Record<string, string | undefined>): AiApiModel[] {
  const config = getAiApiConfig(env);
  if (config.isDisabled) return [];
  const status = resolveModelProvider(env);
  if (status.ready && status.models && status.models.length > 0) {
    return status.models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      contextLength: m.contextLength || "128k",
      pricing: m.pricing || "Unknown",
      isRecommended: m.isRecommended
    }));
  }
  return [{
    id: config.model,
    name: config.model,
    description: "由 AI_MODEL 配置的 UnoRouter / OpenAI-compatible 模型",
    contextLength: "未知",
    pricing: "Unknown",
    isRecommended: true
  }];
}
