import { runCodexAgent, CodexEventBridge } from "../codex/index.js";

export interface AgentRunParams {
  query: string;
  model?: string;
  customSearxngUrl?: string;
  apiKey?: string;
  apiBaseUrl?: string;
  env?: Record<string, string | undefined>;
  eventBridge?: CodexEventBridge;
}

export async function executeAgentRun(params: AgentRunParams) {
  const result = await runCodexAgent(params.query.trim(), {
    model: params.model,
    customSearxngUrl: params.customSearxngUrl,
    apiKey: params.apiKey,
    apiBaseUrl: params.apiBaseUrl,
    env: params.env,
    eventBridge: params.eventBridge
  });

  return result;
}
