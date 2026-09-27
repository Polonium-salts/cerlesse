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

export const GATEWAY_REGISTRY: Record<Exclude<GatewayProvider, "none">, GatewayConfig> = {
  unorouter: {
    id: "unorouter",
    name: "UnoRouter",
    baseUrl: "https://api.unorouter.com/v1",
    envKeys: ["UNOROUTER_API_KEY", "UNOROUTER_KEY"],
    defaultModel: "deepseek/deepseek-v4-flash",
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
  const probeOrder: Array<Exclude<GatewayProvider, "none">> =
    preferred && (preferred === "unorouter" || preferred === "openrouter")
      ? [preferred]
      : ["unorouter", "openrouter"];

  for (const provider of probeOrder) {
    const config = GATEWAY_REGISTRY[provider];
    const candidateKeys = [...config.envKeys];
    if (preferred === provider || source.AI_API_BASE_URL?.includes(provider)) {
      candidateKeys.push("AI_API_KEY");
    }
    for (const keyName of candidateKeys) {
      const candidate = source[keyName];
      if (isValidKeyString(candidate)) {
        return {
          provider,
          name: config.name,
          baseUrl: (preferred === provider && source.AI_API_BASE_URL?.trim()) || config.baseUrl,
          apiKey: candidate!.trim(),
          defaultModel: config.defaultModel
        };
      }
    }
  }

  return { provider: "none" };
}

/**
 * 获取网关可用免费/精选模型列表
 */
export async function loadGatewayModels(
  gateway: ResolvedGateway
): Promise<GatewayModelDef[]> {
  if (gateway.provider === "none" || !gateway.baseUrl) {
    return [];
  }

  if (gateway.provider === "unorouter") {
    return [
      {
        id: "deepseek/deepseek-v4-flash",
        name: "DeepSeek V4 Flash (UnoRouter)",
        description: "UnoRouter 免费/快速调度模型",
        contextLength: "1,000k",
        pricing: "Free / Pay-as-you-go",
        isRecommended: true
      },
      {
        id: "deepseek/deepseek-chat",
        name: "DeepSeek V3 (UnoRouter)",
        description: "UnoRouter 托管通用大语言模型",
        contextLength: "64k",
        pricing: "低费率",
        isRecommended: true
      },
      {
        id: "deepseek/deepseek-reasoner",
        name: "DeepSeek R1 (UnoRouter)",
        description: "UnoRouter 深度推理模型",
        contextLength: "64k",
        pricing: "低费率",
        isRecommended: true
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        description: "Meta 开源前沿大模型",
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
  }

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
