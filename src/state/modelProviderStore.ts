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
      const models: ModelInfo[] = Array.isArray(data.models) ? data.models : [];
      const resolvedProvider = data.provider || "custom";
      const resolvedName = data.providerName || "AI 模型服务";

      // 自动选定模型
      let nextSelectedModel = state.selectedModel;
      if (!nextSelectedModel || !models.some((m) => m.id === nextSelectedModel)) {
        nextSelectedModel = data.defaultModel || models[0]?.id || state.selectedModel;
      }

      const nextStatus: ModelProviderStatus = {
        provider: resolvedProvider,
        ready: true,
        hasApiKey: Boolean(keyToUse || state.status?.hasApiKey),
        isAiApiDisabled: false,
        models,
        defaultModel: data.defaultModel || models[0]?.id,
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
      state = {
        ...state,
        isDetecting: false,
        error: err?.message || "自动探测模型失败"
      };
      emitChange();
      return null;
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
    } catch (err: any) {
      const errorMessage = err?.message || "解析模型配置契约失败";
      state = {
        ...state,
        isLoading: false,
        error: errorMessage
      };
      emitChange();
      return null;
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
