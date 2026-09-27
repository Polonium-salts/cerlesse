import { APIError } from "@aktagon/llmkit-ts";
import type { Client } from "@aktagon/llmkit-ts";
import { openai } from "@aktagon/llmkit-ts/builders";
import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODELS,
  isDeepSeekEnabled,
  resolveDeepSeekApiKey
} from "./deepseek.js";
import {
  isOpenRouterDisabled,
  resolveOpenRouterApiKey,
  isOpenRouterEnabled,
  loadAvailableFreeModels
} from "./openrouter.js";

export * from "./deepseek.js";
export * from "./openrouter.js";

// Canonical base URL. The llmkit OpenAI provider appends /v1/chat/completions
// itself, so the base is the origin only. /v1 or /chat/completions suffixes in
// AI_API_BASE_URL are accepted and normalized away.
export const DEFAULT_AI_API_BASE_URL = "https://api.openai.com";
export const DEFAULT_AI_MODEL = "gpt-4o-mini";

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
  pricing: "Unknown";
  isRecommended?: boolean;
}

export type ModelProviderType = "deepseek" | "openrouter" | "openai" | "custom" | "none";

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
  hasDeepSeekKey?: boolean;
  hasOpenRouterKey?: boolean;
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
    trimmed !== "your_openrouter_api_key_here" &&
    !trimmed.startsWith("your_") &&
    trimmed.length >= 8
  );
}

export function isAiApiDisabled(env?: Record<string, string | undefined>): boolean {
  const source = environment(env);
  return source.AI_API_DISABLED?.trim().toLowerCase() === "true" ||
    source.OPENROUTER_DISABLED?.trim().toLowerCase() === "true";
}

export function resolveAiApiKey(env?: Record<string, string | undefined>): string | undefined {
  const source = environment(env);
  if (isAiApiDisabled(source)) return undefined;
  if (isValidKeyString(source.AI_API_KEY)) {
    return source.AI_API_KEY!.trim();
  }
  const deepseekKey = resolveDeepSeekApiKey(source);
  if (deepseekKey) {
    return deepseekKey;
  }
  const openrouterKey = resolveOpenRouterApiKey(source);
  if (openrouterKey) {
    return openrouterKey;
  }
  return undefined;
}

function isDeepSeekConfig(source: Record<string, string | undefined>): boolean {
  if (Boolean(resolveDeepSeekApiKey(source))) return true;
  const base = source.AI_API_BASE_URL?.toLowerCase() || "";
  const model = source.AI_MODEL?.toLowerCase() || "";
  return base.includes("deepseek.com") || model.startsWith("deepseek-");
}

function legacyOpenRouterConfig(source: Record<string, string | undefined>): boolean {
  return !source.AI_API_BASE_URL?.trim() &&
    !source.AI_API_KEY?.trim() &&
    Boolean(source.OPENROUTER_API_KEY?.trim() || source.OPENROUTER_KEY?.trim());
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
  // The llmkit OpenAI provider appends /v1/chat/completions itself. Accept
  // common base URL forms with an optional /v1 or /chat/completions suffix.
  let pathname = url.pathname.replace(/\/+$/, "");
  pathname = pathname.replace(/\/chat\/completions$/i, "");
  pathname = pathname.replace(/\/v1$/i, "");
  return `${url.origin}${pathname}`.replace(/\/+$/, "");
}

export function getAiApiConfig(env?: Record<string, string | undefined>): AiApiConfig {
  const source = environment(env);
  const usingDeepSeek = isDeepSeekConfig(source);
  const usingLegacyOpenRouter = !usingDeepSeek && legacyOpenRouterConfig(source);
  const configuredBase = source.AI_API_BASE_URL?.trim() ||
    (usingDeepSeek ? DEEPSEEK_BASE_URL : (usingLegacyOpenRouter ? "https://openrouter.ai/api" : DEFAULT_AI_API_BASE_URL));
  const configuredModel = source.AI_MODEL?.trim() ||
    (usingDeepSeek ? "deepseek-v4-flash" : (usingLegacyOpenRouter ? "openrouter/free" : DEFAULT_AI_MODEL));
  return {
    apiBaseUrl: normalizeBaseUrl(configuredBase),
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
    throw new LlmProviderError("未配置有效的 AI_API_KEY 或 DEEPSEEK_API_KEY。", "missing_api_key", 503);
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
  const deepseekKey = resolveDeepSeekApiKey(source);
  const deepseekReady = !disabled && Boolean(deepseekKey);
  const openrouterKey = resolveOpenRouterApiKey(source);
  const openRouterReady = !disabled && !isOpenRouterDisabled(source) && Boolean(openrouterKey);
  const apiKey = resolveAiApiKey(source);
  const hasKey = Boolean(apiKey);

  if (disabled) {
    return {
      provider: "none",
      ready: false,
      reason: "模型提供商已禁用 (AI_API_DISABLED/OPENROUTER_DISABLED=true)",
      models: [],
      defaultModel: undefined,
      hasApiKey: hasKey,
      hasDeepSeekKey: deepseekReady,
      hasOpenRouterKey: openRouterReady,
      isAiApiDisabled: true
    };
  }

  if (!hasKey) {
    return {
      provider: "none",
      ready: false,
      reason: "未配置 API Key，请在 .env 中设置 DEEPSEEK_API_KEY (或 AI_API_KEY / OPENROUTER_API_KEY)",
      models: [],
      defaultModel: undefined,
      hasApiKey: false,
      hasDeepSeekKey: false,
      hasOpenRouterKey: false,
      isAiApiDisabled: false
    };
  }

  const config = getAiApiConfig(source);
  let providerType: ModelProviderType = "custom";
  const urlLower = config.apiBaseUrl.toLowerCase();
  if (deepseekReady || urlLower.includes("deepseek.com") || config.model.toLowerCase().startsWith("deepseek-")) {
    providerType = "deepseek";
  } else if (urlLower.includes("openrouter.ai") || apiKey?.startsWith("sk-or-") || Boolean(source.OPENROUTER_API_KEY && !source.AI_API_BASE_URL)) {
    providerType = "openrouter";
  } else if (urlLower.includes("api.openai.com")) {
    providerType = "openai";
  }

  let models: ModelInfo[] = [];
  if (providerType === "deepseek") {
    models = DEEPSEEK_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description || `DeepSeek 官方模型 (${m.name})`,
      contextLength: `${(m.contextWindow / 1000).toLocaleString()}k`,
      pricing: m.pricing || "官方按量计费",
      isRecommended: m.isRecommended ?? (m.id === "deepseek-v4-flash")
    }));
    if (!models.some((m) => m.id === config.model)) {
      models.unshift({
        id: config.model,
        name: config.model,
        description: `自定义 DeepSeek 模型 (${config.model})`,
        contextLength: "1,000k",
        pricing: "官方按量计费",
        isRecommended: true
      });
    }
  } else {
    models = [{
      id: config.model,
      name: config.model,
      description: `由 AI_MODEL 配置的 ${providerType.toUpperCase()} 兼容模型`,
      contextLength: "未知",
      pricing: "Unknown",
      isRecommended: true
    }];
  }

  return {
    provider: providerType,
    ready: true,
    models,
    defaultModel: config.model,
    hasApiKey: true,
    hasDeepSeekKey: deepseekReady,
    hasOpenRouterKey: openRouterReady,
    isAiApiDisabled: false
  };
}

/**
 * 主动探测模型服务真实联通性 (最小开销 Ping)
 */
export async function pingModel(
  envOrStatus?: ModelProviderStatus | Record<string, string | undefined>
): Promise<{ ok: boolean; provider: string; latencyMs?: number; error?: string }> {
  const isStatusObj = Boolean(envOrStatus && typeof envOrStatus === "object" && "ready" in envOrStatus);
  const status = isStatusObj
    ? (envOrStatus as ModelProviderStatus)
    : resolveModelProvider(envOrStatus as Record<string, string | undefined> | undefined);

  if (!status.ready) {
    return { ok: false, provider: status.provider, error: status.reason || "模型服务未就绪" };
  }

  const envRecord = isStatusObj ? undefined : (envOrStatus as Record<string, string | undefined> | undefined);
  const source = environment(envRecord);
  const config = getAiApiConfig(source);
  const apiKey = resolveAiApiKey(source);
  const startTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

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
    const code = status === 401
      ? "invalid_api_key"
      : status === 403
        ? "access_denied"
        : status === 429
          ? "rate_limited"
          : "provider_error";
    const message = status === 401
      ? `AI API Key 无效或未获授权（${error.message}）。`
      : status === 403
        ? `AI API 拒绝访问（${error.message}）。`
        : status === 429
          ? `AI API 请求触发限流（${error.message}）。`
          : `AI API 请求失败（HTTP ${status}：${error.message}）。`;
    const httpStatus = status === 401 || status === 403 || status === 429
      ? status
      : 502;
    return new LlmProviderError(message, code, httpStatus);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && error.name === "AbortError") {
    return new LlmProviderError("AI API 请求超时，Agent 未能完成模型调用。", "provider_timeout", 504);
  }
  return new LlmProviderError(`AI API 调用失败：${message}`, "provider_error", 502);
}

export interface AgentErrorResult {
  status: number;
  message: string;
  isProviderIssue: boolean;
}

/** 统一 Agent 错误处理 helper：收敛日志分级与状态码，供 REST 与 SSE 共同调用 */
export function respondAgentError(
  err: unknown,
  sink?: { status: (code: number) => { json: (body: any) => void } } | ((event: string, data: any) => void)
): AgentErrorResult {
  const isProviderIssue = err instanceof LlmProviderError;
  const message = err instanceof Error ? err.message : String(err);
  (isProviderIssue ? console.warn : console.error)("[agent]", message);
  const status = isProviderIssue && err.status ? err.status : 500;
  if (typeof sink === "function") {
    sink("error", { message, status });
  } else if (sink && typeof sink.status === "function") {
    sink.status(status).json({ error: message });
  }
  return { status, message, isProviderIssue };
}

/** Expose the configured model without leaking keys or probing provider-specific model APIs. */
export function loadAvailableModels(env?: Record<string, string | undefined>): AiApiModel[] {
  const config = getAiApiConfig(env);
  if (config.isDisabled) return [];
  const source = environment(env);
  if (isDeepSeekConfig(source)) {
    return DEEPSEEK_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description || `DeepSeek 官方模型 (${m.name})`,
      contextLength: `${(m.contextWindow / 1000).toLocaleString()}k`,
      pricing: "Unknown" as const,
      isRecommended: m.isRecommended ?? (m.id === "deepseek-v4-flash")
    }));
  }
  return [{
    id: config.model,
    name: config.model,
    description: "由 AI_MODEL 配置的 OpenAI-compatible 模型",
    contextLength: "未知",
    pricing: "Unknown",
    isRecommended: true
  }];
}

