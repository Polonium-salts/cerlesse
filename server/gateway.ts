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
 * 获取网关可用模型列表（优先动态探测，不硬编码内置第三方模型列表）
 */
export async function loadGatewayModels(
  gateway: ResolvedGateway
): Promise<GatewayModelDef[]> {
  if (gateway.provider === "none" || !gateway.baseUrl) {
    return [];
  }

  // 尝试从网关的 /models 接口动态拉取真实可用模型
  if (gateway.apiKey && gateway.baseUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${gateway.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${gateway.apiKey}`,
          "User-Agent": "Cerlesse-Gateway-Detector/1.0"
        },
        signal: controller.signal
      });
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
            isRecommended: item.id === gateway.defaultModel
          }));
        }
      }
    } catch {
      // 忽略探测异常
    }
  }

  // 不再内置硬编码第三方模型列表，仅返回当前网关默认模型
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
