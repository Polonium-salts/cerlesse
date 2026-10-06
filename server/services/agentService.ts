import { runCodexAgent, CodexEventBridge } from "../codex/index.js";
import { SearchResult } from "../../src/types.js";

export interface AgentRunParams {
  query: string;
  model?: string;
  customSearxngUrl?: string;
  mode?: "search" | "followup";
  threadId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  sources?: SearchResult[];
  apiKey?: string;
  apiBaseUrl?: string;
  /**
   * 全局回答语言（settings.language）。`auto` / 空 = 跟随查询语言。
   * 之前这个值只从前端发到 HTTP 层就被丢弃，服务端从未读过。
   */
  targetLanguage?: string;
  env?: Record<string, string | undefined>;
  eventBridge?: CodexEventBridge;
}

export async function executeAgentRun(params: AgentRunParams) {
  const result = await runCodexAgent(params.query.trim(), {
    model: params.model,
    customSearxngUrl: params.customSearxngUrl,
    mode: params.mode,
    threadId: params.threadId,
    history: params.history,
    sources: params.sources,
    apiKey: params.apiKey,
    apiBaseUrl: params.apiBaseUrl,
    targetLanguage: params.targetLanguage,
    env: params.env,
    eventBridge: params.eventBridge
  });

  return result;
}
