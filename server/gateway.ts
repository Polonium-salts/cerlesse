/**
 * 统一聚合网关层 (Gateway Layer)
 * 支持 UnoRouter (https://api.unorouter.com/v1) 与 OpenRouter (https://openrouter.ai/api/v1)
 * 提供自动探测、优先级解析、模型目录与故障切换辅助。
 */

export type GatewayProvider = "unorouter" | "openrouter" | "none";

export interface GatewayModelDef {
  id: string;
  name: string;
  description: string;
  contextLength?: string;
  pricing?: string;
  isRecommended?: boolean;
}

export interface GatewayConfig {
  id: Exclude<GatewayProvider, "none">;
  name: string;
  baseUrl: string;
  envKeys: string[];
  defaultModel: string;
  pricingEndpoint?: string;
}

export const UNOROUTER_PRESET_MODELS: GatewayModelDef[] = [
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3 (Chat)",
    description: "高性能高性价比推理模型，支持 64k 上下文与函数调用",
    contextLength: "64k",
    pricing: "低费率",
    isRecommended: true
  },
  {
    id: "deepseek/deepseek-reasoner",
    name: "DeepSeek R1 (Reasoner)",
    description: "深度思维推理模型，长逻辑链推演与代码解算",
    contextLength: "64k",
    pricing: "低费率",
    isRecommended: true
  },
  {
    id: "anthropic/claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    description: "前沿混合推理模型，具备卓越的代码生成与长文分析能力",
    contextLength: "200k",
    pricing: "按量计费",
    isRecommended: true
  },
  {
    id: "anthropic/claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    description: "业界顶尖视觉多模态与逻辑分析模型",
    contextLength: "200k",
    pricing: "按量计费"
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    description: "OpenAI 全能多模态旗舰模型",
    contextLength: "128k",
    pricing: "按量计费"
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "极速轻量级模型，适合高并发检索摘要",
    contextLength: "128k",
    pricing: "超低费率"
  },
  {
    id: "openai/o3-mini",
    name: "OpenAI o3-mini",
    description: "专为科学、数学和编程设计的高性价比推理模型",
    contextLength: "200k",
    pricing: "按量计费"
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    description: "新一代极速多模态模型，支持下一代实时交互",
    contextLength: "1000k",
    pricing: "低费率",
    isRecommended: true
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    description: "通义千问开源旗舰大模型，中文及多语言能力极强",
    contextLength: "128k",
    pricing: "超低费率"
  }
];

export const GATEWAY_REGISTRY: Record<Exclude<GatewayProvider, "none">, GatewayConfig> = {
  unorouter: {
    id: "unorouter",
    name: "UnoRouter",
    baseUrl: "https://api.unorouter.com/v1",
    envKeys: ["UNOROUTER_API_KEY", "UNOROUTER_KEY", "LLM_API_KEY", "AI_API_KEY"],
    defaultModel: "deepseek/deepseek-chat",
    pricingEndpoint: "https://api.unorouter.com/api/pricing"
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKeys: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
    defaultModel: "openrouter/free",
    pricingEndpoint: "https://openrouter.ai/api/v1/models"
  }
};

export interface ResolvedGateway {
  provider: GatewayProvider;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
}

function isValidKeyString(val?: string): boolean {
  if (!val || typeof val !== "string") return false;
  const t = val.trim();
  return Boolean(
    t &&
    t !== "undefined" &&
    t !== "null" &&
    !t.startsWith("your_") &&
    t.length >= 8
  );
}

/**
 * 检查网关是否被配置为强制禁用
 */
export function isGatewayDisabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}
): boolean {
  const e = env as Record<string, string | undefined>;
  return (
    e.AI_API_DISABLED?.trim().toLowerCase() === "true" ||
    e.GATEWAY_DISABLED?.trim().toLowerCase() === "true" ||
    e.OPENROUTER_DISABLED?.trim().toLowerCase() === "true"
  );
}

/**
 * 解析当前可用的聚合网关
 * 探测规则：
 * 1. 检查是否显式禁用
 * 2. 检查 MODEL_GATEWAY 显式偏好 (unorouter / openrouter)
 * 3. 默认探测顺序：UNOROUTER_API_KEY -> OPENROUTER_API_KEY
 */
export function resolveGateway(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}
): ResolvedGateway {
  const source = env as Record<string, string | undefined>;

  if (isGatewayDisabled(source)) {
    return { provider: "none" };
  }

  const preferred = source.MODEL_GATEWAY?.trim().toLowerCase() as GatewayProvider | undefined;
  const configuredBase = (source.LLM_BASE_URL || source.UNOROUTER_BASE_URL || source.AI_API_BASE_URL || "").trim().toLowerCase();

  const probeOrder: Array<Exclude<GatewayProvider, "none">> =
    preferred && (preferred === "unorouter" || preferred === "openrouter")
      ? [preferred]
      : configuredBase.includes("openrouter")
        ? ["openrouter", "unorouter"]
        : ["unorouter", "openrouter"];

  for (const provider of probeOrder) {
    const config = GATEWAY_REGISTRY[provider];
    const candidateKeys = [...config.envKeys];
    if (preferred === provider || configuredBase.includes(provider)) {
      candidateKeys.push("AI_API_KEY", "LLM_API_KEY");
    }
    for (const keyName of candidateKeys) {
      const candidate = source[keyName];
      if (isValidKeyString(candidate)) {
        const effectiveBaseUrl =
          (source.LLM_BASE_URL?.trim()) ||
          (source.UNOROUTER_BASE_URL?.trim()) ||
          (preferred === provider && source.AI_API_BASE_URL?.trim()) ||
          config.baseUrl;
        return {
          provider,
          name: config.name,
          baseUrl: effectiveBaseUrl,
          apiKey: candidate!.trim(),
          defaultModel: source.LLM_MODEL?.trim() || source.AI_MODEL?.trim() || config.defaultModel
        };
      }
    }
  }

  return { provider: "none" };
}

/**
 * 获取网关可用模型列表（优先动态探测，未命中时回退到网关预设列表）
 */
export async function loadGatewayModels(
  gateway: ResolvedGateway
): Promise<GatewayModelDef[]> {
  if (gateway.provider === "none" || !gateway.baseUrl) {
    return [];
  }

  // 尝试从网关的 /models 或 /v1/models 接口动态拉取真实可用模型
  if (gateway.apiKey && gateway.baseUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      let endpoint = `${gateway.baseUrl.replace(/\/+$/, "")}/models`;
      let res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${gateway.apiKey}`,
          "User-Agent": "Cerlesse-Gateway-Detector/1.0"
        },
        signal: controller.signal
      });

      if (res.status === 404 && !gateway.baseUrl.endsWith("/v1")) {
        endpoint = `${gateway.baseUrl.replace(/\/+$/, "")}/v1/models`;
        res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${gateway.apiKey}`,
            "User-Agent": "Cerlesse-Gateway-Detector/1.0"
          },
          signal: controller.signal
        });
      }

      clearTimeout(timer);
      if (res.ok) {
        const body = await res.json();
        const rawList = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        if (rawList.length > 0) {
          return rawList.map((item: any) => ({
            id: String(item.id || item.name || ""),
            name: String(item.name || item.id || ""),
            description: item.description || `网关可用模型 (${item.id})`,
            contextLength: item.context_length ? `${Math.round(item.context_length / 1000)}k` : "128k",
            pricing: item.pricing?.prompt ? `$${item.pricing.prompt}/M` : undefined,
            isRecommended: item.id === gateway.defaultModel || item.id?.includes("deepseek")
          }));
        }
      }
    } catch {
      // 忽略探测异常，平滑降级
    }
  }

  // UnoRouter 预设目录
  if (gateway.provider === "unorouter") {
    return UNOROUTER_PRESET_MODELS;
  }

  // 返回当前网关默认模型
  if (gateway.defaultModel) {
    return [
      {
        id: gateway.defaultModel,
        name: gateway.defaultModel,
        description: `${gateway.name || "网关"} 默认模型 (${gateway.defaultModel})`,
        contextLength: "128k",
        isRecommended: true
      }
    ];
  }

  return [];
}
