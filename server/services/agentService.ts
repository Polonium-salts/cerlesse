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
    env: params.env,
    eventBridge: params.eventBridge
  });

  return result;
}
