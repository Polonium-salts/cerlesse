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
import {
  resolveGateway,
  isGatewayDisabled,
  loadGatewayModels,
  GATEWAY_REGISTRY,
  ResolvedGateway
} from "./gateway.js";

export * from "./deepseek.js";
export * from "./openrouter.js";
export * from "./gateway.js";

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
  pricing: "Unknown" | string;
  isRecommended?: boolean;
}

export type ModelProviderType = "deepseek" | "unorouter" | "openrouter" | "openai" | "custom" | "none";

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
    trimmed !== "your_openrouter_api_key_here" &&
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

  // 1. 显式配置的通用 AI_API_KEY 优先
  if (isValidKeyString(source.AI_API_KEY)) {
    return source.AI_API_KEY!.trim();
  }

  // 2. 独立直连 DeepSeek 官方
  const deepseekKey = resolveDeepSeekApiKey(source);
  if (deepseekKey) {
    return deepseekKey;
  }

  // 3. 聚合网关 (UnoRouter / OpenRouter)
  const gateway = resolveGateway(source);
  if (gateway.apiKey) {
    return gateway.apiKey;
  }

  // 4. 兼容直接读取旧变量
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
  // 排除带网关前缀（例如 unorouter 的 deepseek/deepseek-v4-flash）的场景
  if (model.includes("/") || base.includes("unorouter.com") || base.includes("openrouter.ai")) {
    return false;
  }
  return base.includes("deepseek.com") || model.startsWith("deepseek-");
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

export function sanitizeModelForBaseUrl(model: string, baseUrl: string): string {
  if (!model || !model.trim()) return DEFAULT_AI_MODEL;
  const trimmedModel = model.trim();
  const baseLower = (baseUrl || "").toLowerCase();

  // 如果目标上游是 DeepSeek 官方或 DeepSeek 兼容端点，但传入了非 DeepSeek 模型（如 OpenRouter 的 nemotron、:free 模型等）
  if (baseLower.includes("deepseek.com") || baseLower.includes("api.deepseek")) {
    if (trimmedModel.includes(":free") || trimmedModel.includes("/") || trimmedModel.includes("nemotron") || trimmedModel.includes("llama")) {
      return "deepseek-flash";
    }
  }

  // 如果目标上游是 OpenAI 官方，但传入了第三方网关特有模型
  if (baseLower.includes("api.openai.com")) {
    if (trimmedModel.includes(":free") || trimmedModel.includes("/") || trimmedModel.includes("deepseek")) {
      return "gpt-4o-mini";
    }
  }

  return trimmedModel;
}

export function getAiApiConfig(env?: Record<string, string | undefined>): AiApiConfig {
  const source = environment(env);
  const usingDeepSeek = isDeepSeekConfig(source);
  const gateway = resolveGateway(source);

  let defaultBase = DEFAULT_AI_API_BASE_URL;
  let defaultModel = DEFAULT_AI_MODEL;

  if (usingDeepSeek) {
    defaultBase = DEEPSEEK_BASE_URL;
    defaultModel = "deepseek-v4-flash";
  } else if (gateway.provider !== "none") {
    defaultBase = gateway.baseUrl || DEFAULT_AI_API_BASE_URL;
    defaultModel = gateway.defaultModel || DEFAULT_AI_MODEL;
  }

  const configuredBase = source.AI_API_BASE_URL?.trim() || defaultBase;
  const normalizedBase = normalizeBaseUrl(configuredBase);
  const rawModel = source.AI_MODEL?.trim() || defaultModel;
  const configuredModel = sanitizeModelForBaseUrl(rawModel, normalizedBase);

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
    throw new LlmProviderError("未配置有效的 AI_API_KEY、UNOROUTER_API_KEY 或 DEEPSEEK_API_KEY。", "missing_api_key", 503);
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
  const gateway = resolveGateway(source);
  const unoRouterReady = !disabled && gateway.provider === "unorouter";
  const openRouterReady = !disabled && (gateway.provider === "openrouter" || Boolean(resolveOpenRouterApiKey(source)));
  const apiKey = resolveAiApiKey(source);
  const hasKey = Boolean(apiKey);

  if (disabled) {
    return {
      provider: "none",
      ready: false,
      reason: "模型提供商已禁用 (AI_API_DISABLED/OPENROUTER_DISABLED/GATEWAY_DISABLED=true)",
      models: [],
      defaultModel: undefined,
      hasApiKey: hasKey,
      hasDeepSeekKey: deepseekReady,
      hasOpenRouterKey: openRouterReady,
      hasUnoRouterKey: unoRouterReady,
      isAiApiDisabled: true
    };
  }

  if (!hasKey) {
    return {
      provider: "none",
      ready: false,
      reason: "未配置 API Key，请在 .env 中设置 UNOROUTER_API_KEY、DEEPSEEK_API_KEY 或 AI_API_KEY",
      models: [],
      defaultModel: undefined,
      hasApiKey: false,
      hasDeepSeekKey: false,
      hasOpenRouterKey: false,
      hasUnoRouterKey: false,
      isAiApiDisabled: false
    };
  }

  const config = getAiApiConfig(source);
  let providerType: ModelProviderType = "custom";
  const urlLower = config.apiBaseUrl.toLowerCase();

  if (deepseekReady || (urlLower.includes("deepseek.com") && !urlLower.includes("unorouter") && !urlLower.includes("openrouter"))) {
    providerType = "deepseek";
  } else if (gateway.provider === "unorouter" || urlLower.includes("unorouter.com")) {
    providerType = "unorouter";
  } else if (gateway.provider === "openrouter" || urlLower.includes("openrouter.ai") || apiKey?.startsWith("sk-or-")) {
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
  } else if (providerType === "unorouter") {
    models = [
      {
        id: "deepseek/deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        description: "UnoRouter 免费/快速调度模型",
        contextLength: "128k",
        pricing: "Free / Standard",
        isRecommended: true
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        description: "Meta 高性能开源大模型",
        contextLength: "128k",
        pricing: "Pay-as-you-go"
      },
      {
        id: "google/gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Google 轻量级多模态高速模型",
        contextLength: "1,000k",
        pricing: "Pay-as-you-go"
      }
    ];
    if (!models.some((m) => m.id === config.model)) {
      models.unshift({
        id: config.model,
        name: config.model,
        description: `UnoRouter 自定义模型 (${config.model})`,
        contextLength: "128k",
        pricing: "Gateway",
        isRecommended: true
      });
    }
  } else if (providerType === "openrouter") {
    models = [
      {
        id: "openrouter/free",
        name: "OpenRouter Free Router",
        description: "OpenRouter 自动调度免费模型池",
        contextLength: "128k",
        pricing: "Free",
        isRecommended: true
      }
    ];
    if (!models.some((m) => m.id === config.model)) {
      models.unshift({
        id: config.model,
        name: config.model,
        description: `OpenRouter 自定义模型 (${config.model})`,
        contextLength: "128k",
        pricing: "Gateway",
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
    hasUnoRouterKey: unoRouterReady,
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

export interface DetectedProviderResult {
  success: boolean;
  provider: ModelProviderType;
  providerName: string;
  apiBaseUrl: string;
  models: ModelInfo[];
  defaultModel?: string;
  source: "remote_api" | "preset_catalog" | "env";
  message?: string;
}

/**
 * 自动根据填入的 API Key / Base URL 探测识别上游服务与动态加载可用模型列表
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
  let providerType: ModelProviderType = "custom";
  let providerName = "自定义兼容服务";
  let defaultModel = "gpt-4o-mini";

  const keyLower = rawKey.toLowerCase();
  const baseLower = rawBase.toLowerCase();

  if (baseLower.includes("unorouter.com") || params.provider === "unorouter") {
    providerType = "unorouter";
    providerName = "UnoRouter 聚合网关";
    rawBase = rawBase || "https://api.unorouter.com/v1";
    defaultModel = "deepseek/deepseek-v4-flash";
  } else if (keyLower.startsWith("sk-or-") || baseLower.includes("openrouter.ai") || params.provider === "openrouter") {
    providerType = "openrouter";
    providerName = "OpenRouter 聚合网关";
    rawBase = rawBase || "https://openrouter.ai/api/v1";
    defaultModel = "openrouter/free";
  } else if (baseLower.includes("deepseek.com") || params.provider === "deepseek") {
    providerType = "deepseek";
    providerName = "DeepSeek 官方直连";
    rawBase = rawBase || "https://api.deepseek.com/v1";
    defaultModel = "deepseek-v4-flash";
  } else if (keyLower.startsWith("gsk_") || baseLower.includes("groq.com") || params.provider === "groq") {
    providerType = "custom";
    providerName = "Groq 极速云引擎";
    rawBase = rawBase || "https://api.groq.com/openai/v1";
    defaultModel = "llama-3.3-70b-versatile";
  } else if (baseLower.includes("openai.com") || keyLower.startsWith("sk-proj-") || params.provider === "openai") {
    providerType = "openai";
    providerName = "OpenAI 官方 API";
    rawBase = rawBase || "https://api.openai.com/v1";
    defaultModel = "gpt-4o-mini";
  } else if (rawBase) {
    providerType = "custom";
    providerName = "自定义 OpenAI 兼容网关";
    defaultModel = "gpt-4o-mini";
  } else {
    // 默认如果服务端已有配置，按服务端配置回退
    const status = resolveModelProvider(env);
    if (status.ready) {
      const config = getAiApiConfig(env);
      return {
        success: true,
        provider: status.provider,
        providerName: status.provider === "deepseek" ? "DeepSeek 官方直连" : status.provider === "unorouter" ? "UnoRouter 聚合网关" : "默认配置服务",
        apiBaseUrl: config.apiBaseUrl,
        models: status.models,
        defaultModel: status.defaultModel || status.models[0]?.id,
        source: "env"
      };
    }
    rawBase = "https://api.deepseek.com/v1";
    providerType = "deepseek";
    providerName = "DeepSeek 官方直连";
    defaultModel = "deepseek-v4-flash";
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
            const isRec = id.includes("deepseek-v4") || id.includes("gpt-4o") || id.includes("claude-3-5") || id.includes("free");
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
    } catch (fetchErr) {
      clearTimeout(timeout);
      // 远程探测失败，平滑降级至内置预设列表
    }
  }

  // 3. 降级回退：加载该提供商的标准预设模型库
  let fallbackModels: ModelInfo[] = [];
  if (providerType === "deepseek") {
    fallbackModels = DEEPSEEK_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description || `DeepSeek 官方模型 (${m.name})`,
      contextLength: `${(m.contextWindow / 1000).toLocaleString()}k`,
      pricing: m.pricing || "官方按量计费",
      isRecommended: m.id === "deepseek-v4-flash"
    }));
  } else if (providerType === "unorouter") {
    fallbackModels = [
      { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash (推荐)", description: "UnoRouter 高速推理模型，支持代码与通用研报", contextLength: "1,000k", pricing: "免费/低费率", isRecommended: true },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3 (通用研报)", description: "UnoRouter 托管 DeepSeek-V3", contextLength: "64k", pricing: "低费率", isRecommended: true },
      { id: "deepseek/deepseek-reasoner", name: "DeepSeek R1 (深度思考)", description: "UnoRouter 托管 DeepSeek-R1 强化学习模型", contextLength: "64k", pricing: "低费率", isRecommended: true },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", description: "OpenAI 轻量级高性能模型", contextLength: "128k", pricing: "按量计费", isRecommended: false },
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", description: "Anthropic 极速模型", contextLength: "200k", pricing: "按量计费", isRecommended: false }
    ];
  } else if (providerType === "openrouter") {
    fallbackModels = [
      { id: "openrouter/free", name: "OpenRouter Free Router (免费自动路由)", description: "自动轮询当前可用的免费上游模型", contextLength: "128k", pricing: "免费", isRecommended: true },
      { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3 (Free)", description: "OpenRouter 免费 DeepSeek V3", contextLength: "64k", pricing: "免费", isRecommended: true },
      { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", description: "OpenRouter 免费 DeepSeek R1", contextLength: "64k", pricing: "免费", isRecommended: true }
    ];
  } else {
    fallbackModels = [
      { id: "gpt-4o-mini", name: "GPT-4o Mini (推荐)", description: "OpenAI 高性价比模型", contextLength: "128k", pricing: "按量计费", isRecommended: true },
      { id: "gpt-4o", name: "GPT-4o", description: "OpenAI 旗舰全模态模型", contextLength: "128k", pricing: "按量计费", isRecommended: false },
      { id: "deepseek-chat", name: "DeepSeek Chat", description: "DeepSeek 通用模型", contextLength: "64k", pricing: "按量计费", isRecommended: true }
    ];
  }

  return {
    success: true,
    provider: providerType,
    providerName,
    apiBaseUrl: normalizedBase,
    models: fallbackModels,
    defaultModel: fallbackModels[0]?.id || defaultModel,
    source: "preset_catalog",
    message: `已自动配置 ${providerName}，加载 ${fallbackModels.length} 个推荐模型`
  };
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
    description: "由 AI_MODEL 配置的 OpenAI-compatible 模型",
    contextLength: "未知",
    pricing: "Unknown",
    isRecommended: true
  }];
}
