import { useState, useCallback, useRef } from "react";
import { WidgetPlanItem } from "../contracts";

export interface AgentStep {
  message: string;
  toolName?: string;
  toolInput?: any;
  resultCount?: number;
  timestamp?: number;
}

export interface AgentStreamState {
  status: "idle" | "streaming" | "success" | "provider_error" | "error";
  statusMessage: string;
  tokens: string;
  steps: AgentStep[];
  widgetPlan: WidgetPlanItem[];
  result: any | null;
  error: string | null;
  retryable: boolean;
}

export interface UseAgentStreamOptions {
  model?: string;
  language?: string;
  customKey?: string;
  customBaseUrl?: string;
  onComplete?: (result: any) => void;
  onError?: (err: { message: string; retryable: boolean; isProviderError: boolean }) => void;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const [state, setState] = useState<AgentStreamState>({
    status: "idle",
    statusMessage: "",
    tokens: "",
    steps: [],
    widgetPlan: [],
    result: null,
    error: null,
    retryable: false
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const startStream = useCallback(
    async (query: string, runOptions?: Partial<UseAgentStreamOptions>) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState({
        status: "streaming",
        statusMessage: "正在连接 Codex 智能研报服务...",
        tokens: "",
        steps: [],
        widgetPlan: [],
        result: null,
        error: null,
        retryable: false
      });

      const activeModel = runOptions?.model || options.model || "";
      const activeLanguage = runOptions?.language || options.language || "zh";
      const customKey = runOptions?.customKey || options.customKey;
      const customBaseUrl = runOptions?.customBaseUrl || options.customBaseUrl;

      const params = new URLSearchParams({
        q: trimmed,
        model: activeModel,
        lang: activeLanguage
      });

      const headers: Record<string, string> = {
        Accept: "text/event-stream"
      };

      if (customKey) {
        headers["x-custom-api-key"] = customKey;
      }
      if (customBaseUrl) {
        headers["x-custom-base-url"] = customBaseUrl;
      }

      try {
        const response = await fetch(`/api/agent/stream?${params.toString()}`, {
          method: "GET",
          headers,
          signal: controller.signal
        });

        if (!response.ok) {
          let errorText = `服务请求异常 (HTTP ${response.status})`;
          try {
            const errData = await response.json();
            if (errData.error) errorText = errData.error;
          } catch {}
          throw new Error(errorText);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("浏览器不支持流式数据读取");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith(":")) continue;

            if (trimmedLine.startsWith("data:")) {
              const jsonStr = trimmedLine.slice(5).trim();
              if (!jsonStr) continue;

              try {
                const data = JSON.parse(jsonStr);
                const eventType = data.type;

                if (eventType === "status") {
                  setState((prev) => ({
                    ...prev,
                    statusMessage: data.message || prev.statusMessage
                  }));
                } else if (eventType === "step") {
                  setState((prev) => ({
                    ...prev,
                    statusMessage: data.message || prev.statusMessage,
                    steps: [
                      ...prev.steps,
                      {
                        message: data.message,
                        toolName: data.toolName,
                        toolInput: data.toolInput,
                        resultCount: data.resultCount,
                        timestamp: Date.now()
                      }
                    ]
                  }));
                } else if (eventType === "token") {
                  setState((prev) => ({
                    ...prev,
                    tokens: prev.tokens + (data.content || "")
                  }));
                } else if (eventType === "widget_plan") {
                  const items: WidgetPlanItem[] = Array.isArray(data.items)
                    ? data.items.map((it: any) => ({
                        widgetId: String(it.widgetId || it.id),
                        presence: it.presence === "resident" ? "resident" : "conditional",
                        gridWidth: it.gridWidth || 50,
                        hasRenderer: it.hasRenderer !== false,
                        priority: it.priority,
                        title: it.title,
                        reason: it.reason
                      }))
                    : [];
                  setState((prev) => ({ ...prev, widgetPlan: items }));
                } else if (eventType === "provider_error") {
                  const errorMsg = data.message || "模型供应商服务暂时不可用";
                  setState((prev) => ({
                    ...prev,
                    status: "provider_error",
                    error: errorMsg,
                    retryable: Boolean(data.retryable)
                  }));
                  options.onError?.({
                    message: errorMsg,
                    retryable: Boolean(data.retryable),
                    isProviderError: true
                  });
                  return;
                } else if (eventType === "error") {
                  const errorMsg = data.error || "研报生成过程中发生错误";
                  setState((prev) => ({
                    ...prev,
                    status: "error",
                    error: errorMsg,
                    retryable: true
                  }));
                  options.onError?.({
                    message: errorMsg,
                    retryable: true,
                    isProviderError: false
                  });
                  return;
                } else if (eventType === "complete") {
                  setState((prev) => ({
                    ...prev,
                    status: "success",
                    result: data.payload,
                    statusMessage: "研报生成完毕"
                  }));
                  options.onComplete?.(data.payload);
                }
              } catch (parseErr) {
                console.warn("[useAgentStream] JSON parse error on chunk:", jsonStr, parseErr);
              }
            }
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        const errorMsg = err?.message || "网络连接中断，请重试";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMsg,
          retryable: true
        }));
        options.onError?.({
          message: errorMsg,
          retryable: true,
          isProviderError: false
        });
      } finally {
        abortControllerRef.current = null;
      }
    },
    [abort, options]
  );

  return {
    state,
    startStream,
    abort,
    isStreaming: state.status === "streaming"
  };
}
