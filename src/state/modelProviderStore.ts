import { useEffect, useSyncExternalStore } from "react";
import { ModelProviderStatus, ModelProviderStatusSchema, ModelInfo } from "../contracts";

interface ModelStoreState {
  status: ModelProviderStatus | null;
  isLoading: boolean;
  isDetecting: boolean;
  error: string | null;
  selectedModel: string;
  detectedProviderName: string;
  customApiKey: string;
  customApiBaseUrl: string;
}

function sanitizeStoredModel(model: string): string {
  if (!model || typeof model !== "string") {
    return "";
  }
  return model.trim();
}

function getStoredSettings(): { customApiKey: string; customApiBaseUrl: string; selectedModel: string } {
  try {
    const raw = localStorage.getItem("ai_search_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        customApiKey: parsed.customApiKey || "",
        customApiBaseUrl: parsed.customApiBaseUrl || "",
        selectedModel: sanitizeStoredModel(parsed.selectedModel || "")
      };
    }
  } catch {}
  return {
    customApiKey: "",
    customApiBaseUrl: "",
    selectedModel: sanitizeStoredModel(localStorage.getItem("cerlesse_selected_model") || "")
  };
}

const initialSettings = getStoredSettings();

let state: ModelStoreState = {
  status: null,
  isLoading: false,
  isDetecting: false,
  error: null,
  selectedModel: initialSettings.selectedModel,
  detectedProviderName: "",
  customApiKey: initialSettings.customApiKey,
  customApiBaseUrl: initialSettings.customApiBaseUrl
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

const DEFAULT_UNOROUTER_FALLBACK_MODELS: ModelInfo[] = [
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
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    description: "新一代极速多模态模型",
    contextLength: "1000k",
    pricing: "低费率",
    isRecommended: true
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    description: "通义千问开源旗舰大模型",
    contextLength: "128k",
    pricing: "超低费率"
  }
];

export const modelProviderStore = {
  getState() {
    return state;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setSelectedModel(modelId: string) {
    state = { ...state, selectedModel: modelId };
    localStorage.setItem("cerlesse_selected_model", modelId);
    try {
      const raw = localStorage.getItem("ai_search_settings");
      const obj = raw ? JSON.parse(raw) : {};
      obj.selectedModel = modelId;
      localStorage.setItem("ai_search_settings", JSON.stringify(obj));
    } catch {}
    emitChange();
  },

  /**
   * 根据传入的 API Key / Base URL 自动探测上游服务与加载可用模型
   */
  async detectAndLoadModels(apiKey?: string, apiBaseUrl?: string, provider?: string): Promise<ModelProviderStatus | null> {
    const keyToUse = apiKey !== undefined ? apiKey.trim() : state.customApiKey;
    const baseToUse = apiBaseUrl !== undefined ? apiBaseUrl.trim() : state.customApiBaseUrl;

    state = {
      ...state,
      isDetecting: true,
      customApiKey: keyToUse,
      customApiBaseUrl: baseToUse
    };
    emitChange();

    try {
      const res = await fetch("/api/models/detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(keyToUse ? { "x-custom-api-key": keyToUse } : {}),
          ...(baseToUse ? { "x-custom-base-url": baseToUse } : {})
        },
        body: JSON.stringify({
          apiKey: keyToUse,
          apiBaseUrl: baseToUse,
          provider
        })
      });

      if (!res.ok) {
        throw new Error(`探测模型服务失败 (HTTP ${res.status})`);
      }

      const data = await res.json();
      let models: ModelInfo[] = Array.isArray(data.models) && data.models.length > 0 ? data.models : [];
      if (models.length === 0 && (provider === "unorouter" || !provider || baseToUse.includes("unorouter"))) {
        models = DEFAULT_UNOROUTER_FALLBACK_MODELS;
      }
      const resolvedProvider = data.provider || "unorouter";
      const resolvedName = data.providerName || "UnoRouter 聚合网关";

      // 自动选定模型
      let nextSelectedModel = state.selectedModel;
      if (!nextSelectedModel || !models.some((m) => m.id === nextSelectedModel)) {
        nextSelectedModel = data.defaultModel || models[0]?.id || state.selectedModel || "deepseek/deepseek-chat";
      }

      const nextStatus: ModelProviderStatus = {
        provider: resolvedProvider,
        ready: true,
        hasApiKey: Boolean(keyToUse || state.status?.hasApiKey),
        isAiApiDisabled: false,
        models,
        defaultModel: data.defaultModel || models[0]?.id || "deepseek/deepseek-chat",
        reason: data.message
      };

      state = {
        ...state,
        status: nextStatus,
        selectedModel: nextSelectedModel,
        detectedProviderName: resolvedName,
        isDetecting: false,
        error: null
      };

      if (nextSelectedModel) {
        localStorage.setItem("cerlesse_selected_model", nextSelectedModel);
        try {
          const raw = localStorage.getItem("ai_search_settings");
          const obj = raw ? JSON.parse(raw) : {};
          obj.selectedModel = nextSelectedModel;
          if (apiKey !== undefined) obj.customApiKey = keyToUse;
          if (apiBaseUrl !== undefined) obj.customApiBaseUrl = baseToUse;
          localStorage.setItem("ai_search_settings", JSON.stringify(obj));
        } catch {}
      }

      emitChange();
      return nextStatus;
    } catch (err: any) {
      // 出现异常时优雅降级为 UnoRouter 预设模型
      const fallbackModels = DEFAULT_UNOROUTER_FALLBACK_MODELS;
      const fallbackStatus: ModelProviderStatus = {
        provider: "unorouter",
        ready: Boolean(keyToUse),
        hasApiKey: Boolean(keyToUse),
        isAiApiDisabled: false,
        models: fallbackModels,
        defaultModel: "deepseek/deepseek-chat",
        reason: "已加载 UnoRouter 推荐模型目录"
      };

      state = {
        ...state,
        status: fallbackStatus,
        selectedModel: state.selectedModel || "deepseek/deepseek-chat",
        detectedProviderName: "UnoRouter 聚合网关",
        isDetecting: false,
        error: null
      };
      emitChange();
      return fallbackStatus;
    }
  },

  async refresh(): Promise<ModelProviderStatus | null> {
    // 若客户端已配置自定义 API Key，优先走自动探测与动态加载
    if (state.customApiKey) {
      return this.detectAndLoadModels(state.customApiKey, state.customApiBaseUrl);
    }

    state = { ...state, isLoading: true, error: null };
    emitChange();

    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 无法获取模型配置`);
      }
      const raw = await res.json();
      const parsed = ModelProviderStatusSchema.parse(raw);

      // 若当前未选定模型或选定模型不在列表中，自动对齐默认模型
      let nextSelectedModel = state.selectedModel;
      if (!nextSelectedModel && parsed.defaultModel) {
        nextSelectedModel = parsed.defaultModel;
      } else if (parsed.models.length > 0 && !parsed.models.some((m) => m.id === nextSelectedModel)) {
        nextSelectedModel = parsed.defaultModel || parsed.models[0]?.id || "";
      }

      state = {
        ...state,
        status: parsed,
        selectedModel: nextSelectedModel,
        isLoading: false,
        error: null
      };
      if (nextSelectedModel) {
        localStorage.setItem("cerlesse_selected_model", nextSelectedModel);
      }
      emitChange();
      return parsed;
    } catch (_err: any) {
      // 优雅降级：探测 UnoRouter 模型
      return this.detectAndLoadModels(undefined, "https://api.unorouter.com/v1", "unorouter");
    }
  }
};

/**
 * 全局统一模型状态 Hook
 */
export function useModelProviderStore() {
  const current = useSyncExternalStore(
    modelProviderStore.subscribe,
    modelProviderStore.getState,
    modelProviderStore.getState
  );

  useEffect(() => {
    // 首次挂载且未加载时自动拉取
    if (!current.status && !current.isLoading && !current.isDetecting && !current.error) {
      modelProviderStore.refresh();
    }
  }, [current.status, current.isLoading, current.isDetecting, current.error]);

  const isReady = Boolean(current.status?.ready || current.status?.hasApiKey || current.customApiKey);
  const models: ModelInfo[] = current.status?.models || [];

  return {
    status: current.status,
    isLoading: current.isLoading,
    isDetecting: current.isDetecting,
    error: current.error,
    selectedModel: current.selectedModel,
    setSelectedModel: modelProviderStore.setSelectedModel,
    detectAndLoadModels: modelProviderStore.detectAndLoadModels,
    refresh: modelProviderStore.refresh,
    isReady,
    models,
    provider: current.status?.provider || "none",
    detectedProviderName: current.detectedProviderName || current.status?.provider || "AI 服务",
    customApiKey: current.customApiKey,
    customApiBaseUrl: current.customApiBaseUrl
  };
}
