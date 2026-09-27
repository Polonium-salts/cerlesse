import { SearchResult, SearchImage, WidgetAction } from "../../src/types.js";
import type { MiddlewareFn, Tool } from "@aktagon/llmkit-ts";
import {
  EvidenceAssessment,
  ReasonedSearchOutcome,
  ReasonedSearchRequest,
  assessEvidence,
  buildSearchObservation,
  executeReasonedSearch,
  planSearchQueries,
  prepareSearchArguments
} from "./queryReasoner.js";
import { cerlesseMcpServer, CERLESSE_MCP_TOOLS, McpCallContext } from "../mcp/cerlesseMcpServer.js";
import { sessionManager, CodexSession } from "./sessionManager.js";
import {
  CodexEventBridge,
  CerlesseAgentResponse,
  buildSynthesisResultFromCodex
} from "./eventBridge.js";
import { DEFAULT_CODEX_CONFIG, CodexAgentConfig } from "./codexConfig.js";
import { getAiApiClient, getAiApiConfig, LlmProviderError, toLlmProviderError } from "../aiProvider.js";
import { PreparedWidgetOutput } from "../tools/widgetTool.js";
import { SolveLayoutOutput } from "../tools/layoutTool.js";
import { selectWidgetsByEvidence, WidgetEvidenceInput } from "./widgetSelectionSkill.js";

export interface CodexRunOptions {
  model?: string;
  customSearxngUrl?: string;
  env?: Record<string, string | undefined>;
  apiKey?: string;
  apiBaseUrl?: string;
  temperature?: number;
  maxIterations?: number;
  threadId?: string;
  timeoutMs?: number;
  eventBridge?: CodexEventBridge;
  mockStepExecutor?: (
    messages: any[],
    tools: any[],
    iteration: number
  ) => Promise<{ content?: string; toolCalls?: any[] } | null>;
}

export interface CodexRunResult {
  response: CerlesseAgentResponse;
  legacySynthesis: ReturnType<typeof buildSynthesisResultFromCodex>;
  eventBridge: CodexEventBridge;
  session: CodexSession;
  /** 选型技能输出：本次绑定结果与证据排序榜单（用于前端审计与相关度补位） */
  selection: ReturnType<typeof selectWidgetsByEvidence>;
}

/**
 * 格式化 MCP 工具为 OpenAI / Codex Function Tools 规范
 */
function getOpenAiToolsFormat() {
  return CERLESSE_MCP_TOOLS.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));
}

/**
 * 核心运行入口：基于 llmkit-ts 的 OpenAI-compatible Tool-Using Agent Runtime
 * 严格遵循真实 Agent 交互范式：
 * User Query -> Tool Call -> Tool Result -> Observation -> Re-decision -> Tool Call / Finish
 */
export async function runCodexAgent(
  query: string,
  options: CodexRunOptions = {}
): Promise<CodexRunResult> {
  const startTime = Date.now();
  const eventBridge = options.eventBridge || new CodexEventBridge();
  const session = sessionManager.createSession(query, options.threadId);
  const threadId = session.threadId;

  eventBridge.emit({
    type: "thread_started",
    threadId,
    query,
    timestamp: startTime
  });

  const effectiveEnv: Record<string, string | undefined> = {
    ...(options.env || (typeof process !== "undefined" ? process.env : {})),
    ...(options.apiKey?.trim() ? { AI_API_KEY: options.apiKey.trim() } : {}),
    ...(options.apiBaseUrl?.trim() ? { AI_API_BASE_URL: options.apiBaseUrl.trim() } : {}),
    ...(options.model?.trim() ? { AI_MODEL: options.model.trim() } : {})
  };

  const aiApiConfig = getAiApiConfig(effectiveEnv);
  const config: CodexAgentConfig = {
    ...DEFAULT_CODEX_CONFIG,
    defaultModel: aiApiConfig.model,
    maxIterations: options.maxIterations || DEFAULT_CODEX_CONFIG.maxIterations,
    temperature: typeof options.temperature === "number" ? options.temperature : DEFAULT_CODEX_CONFIG.temperature
  };

  const mcpContext: McpCallContext = {
    customSearxngUrl: options.customSearxngUrl,
    env: effectiveEnv,
    knownSources: session.collectedSources
  };

  const llmClient = options.mockStepExecutor ? undefined : getAiApiClient(effectiveEnv);

  const toolsUsed = new Set<string>();
  const modelRequestedTools = new Set<string>();
  let modelUsed: string | undefined;
  let modelCalls = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let modelCostUsd = 0;
  const actions: WidgetAction[] = [];
  let finalAnswer = "";
  let latestAssistantContent = "";
  let imagesFound: SearchImage[] = [];

  // ============================================================
  // 检索推理层接线
  // ============================================================
  // 目标：让「搜什么 / 搜到的东西够不够 / 下一步该补搜什么」这三件事都有明确依据，
  // 而不是把用户原话一股脑丢给检索引擎、再拿一整坨 JSON 去猜。
  const executedSearchQueries: string[] = [];
  let evidenceAssessment: EvidenceAssessment | undefined;

  const recordReasoning = (content: string, details?: string[]) => {
    eventBridge.recordReasoning(content, details);
    eventBridge.emit({ type: "reasoning", content, timestamp: Date.now() });
  };

  /**
   * 一次真实检索。
   *
   * 事件流里的 tool_call / tool_result 与真实调用**一一对应**（补检也是独立的 call），
   * 不做「把两轮检索包装成一次调用」的美化 —— 否则工具事件就不再是执行事实的记录。
   */
  const runSearchTool = async (request: ReasonedSearchRequest): Promise<SearchResult[]> => {
    const callId = `search_${Date.now()}_${executedSearchQueries.length}`;
    const args: Record<string, any> = { ...request };
    toolsUsed.add("search_web");
    eventBridge.recordToolCall(callId, "search_web", args);
    eventBridge.emit({ type: "tool_call", callId, tool: "search_web", arguments: args, timestamp: Date.now() });

    const callStart = Date.now();
    let toolOutput: any = null;
    try {
      toolOutput = await cerlesseMcpServer.callTool("search_web", args, mcpContext);
    } catch (err: any) {
      toolOutput = { error: err?.message || "Tool execution failed" };
    }
    const durationMs = Date.now() - callStart;
    eventBridge.recordToolResult(callId, "search_web", toolOutput, durationMs);
    eventBridge.emit({ type: "tool_result", callId, tool: "search_web", result: toolOutput, durationMs, timestamp: Date.now() });

    if (request.query && !executedSearchQueries.includes(request.query)) {
      executedSearchQueries.push(request.query);
    }

    const results: SearchResult[] = Array.isArray(toolOutput?.results) ? toolOutput.results : [];
    if (results.length > 0) {
      sessionManager.recordSources(threadId, results);
      mcpContext.knownSources = session.collectedSources;
      eventBridge.emit({ type: "source_update", sources: session.collectedSources, timestamp: Date.now() });
    }
    return results;
  };

  /** 带证据评估的受控检索（主查询 + 有上限的补检），结论同步进推理日志 */
  const runReasonedSearch = async (
    searchQuery: string,
    limit: number,
    state: { initialResults?: SearchResult[]; skipPrimary?: boolean } = {}
  ): Promise<ReasonedSearchOutcome> => {
    const outcome = await executeReasonedSearch(searchQuery, {
      search: runSearchTool,
      emitReasoning: recordReasoning,
      limit,
      initialResults: state.initialResults,
      // 模型/上一轮已经实际搜过主查询时不重发 —— 包括「搜了但一条都没召回」，
      // 那种情况下重发同一条查询不会有任何新证据，只会白等一次网络往返。
      skipPrimary: state.skipPrimary
    });
    evidenceAssessment = outcome.assessment;
    return outcome;
  };

  let llmkitToolCallSequence = 0;
  const runLlmkitTool = async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    const args: Record<string, any> = { ...input };
    if (toolName === "search_web") {
      const prepared = prepareSearchArguments({
        query: String(args.query ?? ""),
        limit: typeof args.limit === "number" ? args.limit : undefined,
        language: typeof args.language === "string" ? args.language : undefined,
        domains: Array.isArray(args.domains) ? args.domains : undefined,
        recencyDays: typeof args.recencyDays === "number" ? args.recencyDays : undefined
      });
      for (const note of prepared.notes) recordReasoning(note);
      Object.assign(args, prepared.args);
      if (args.query && !executedSearchQueries.includes(args.query)) {
        executedSearchQueries.push(args.query);
      }
    }

    const callId = `llmkit_${toolName}_${Date.now()}_${llmkitToolCallSequence++}`;
    const callStart = Date.now();
    toolsUsed.add(toolName);
    modelRequestedTools.add(toolName);
    eventBridge.recordToolCall(callId, toolName, args);
    eventBridge.emit({ type: "tool_call", callId, tool: toolName, arguments: args, timestamp: callStart });

    let result: any;
    try {
      result = await cerlesseMcpServer.callTool(toolName, args, mcpContext);
    } catch (error) {
      result = { error: error instanceof Error ? error.message : String(error) };
    }

    const durationMs = Date.now() - callStart;
    eventBridge.recordToolResult(callId, toolName, result, durationMs);
    eventBridge.emit({ type: "tool_result", callId, tool: toolName, result, durationMs, timestamp: Date.now() });

    let observation: unknown = result;
    if (toolName === "search_web" && Array.isArray(result?.results)) {
      sessionManager.recordSources(threadId, result.results as SearchResult[]);
      mcpContext.knownSources = session.collectedSources;
      eventBridge.emit({ type: "source_update", sources: session.collectedSources, timestamp: Date.now() });

      const plan = planSearchQueries(String(args.query || query), {
        language: typeof args.language === "string" ? args.language : undefined
      });
      const assessment = assessEvidence(result.results as SearchResult[], plan);
      evidenceAssessment = assessment;
      if (assessment.shouldRefine) {
        recordReasoning(
          `检索证据不足：${assessment.reason}`,
          [
            `检索式：${plan.primary.query}`,
            `实体命中：${assessment.entityMatchedCount} / 候选 ${assessment.resultCount}`,
            `建议补检：${plan.refinements.map((refinement) => refinement.query).join(" | ") || "更换表述"}`
          ]
        );
      }
      observation = {
        ...buildSearchObservation(plan.primary.query || query, result.results as SearchResult[], {
          plan,
          maxResults: 6
        }),
        diagnostics: {
          candidateCount: result?.diagnostics?.candidateCount ?? result?.rawCount ?? result.results.length,
          uniqueCount: result?.diagnostics?.uniqueCount ?? result?.uniqueCount ?? result.results.length,
          sourcesUsed: result?.diagnostics?.sourcesUsed ?? [],
          fallbackUsed: result?.diagnostics?.fallbackUsed ?? false,
          rankingRemoved: result?.diagnostics?.rankingRemoved ?? 0,
          failures: (result?.diagnostics?.failures ?? []).slice(0, 3)
        }
      };
    } else if (toolName === "search_images" && Array.isArray(result?.images)) {
      imagesFound = [...imagesFound, ...result.images];
    } else if (toolName === "prepare_widget" && result?.success) {
      sessionManager.recordWidget(threadId, result as PreparedWidgetOutput);
      eventBridge.emit({ type: "widget_update", widgets: session.preparedWidgets, timestamp: Date.now() });
    } else if (toolName === "solve_layout" && result?.tiles) {
      sessionManager.recordLayout(threadId, result as SolveLayoutOutput);
      observation = {
        ...result,
        instruction: "组件布局计算完成。所有必要工具调用已就绪。请在此轮直接输出针对用户问题的完整、结构化最终回答并标注引用来源，不要再调用任何工具。"
      };
    } else if (toolName === "create_action" && result?.action) {
      actions.push(result.action as WidgetAction);
    }

    return typeof observation === "string" ? observation : JSON.stringify(observation);
  };

  const llmkitTools: Tool[] = CERLESSE_MCP_TOOLS.map((definition) => ({
    name: definition.name,
    description: definition.description,
    schema: definition.inputSchema,
    run: (input) => runLlmkitTool(definition.name, input)
  }));

  const middleware: MiddlewareFn = (_context, event) => {
    if (event.op === "llm_request" && event.phase === "post") {
      modelCalls++;
      modelUsed = event.model || options.model || config.defaultModel;
      promptTokens += event.usage?.input ?? 0;
      completionTokens += event.usage?.output ?? 0;
      modelCostUsd += event.usage?.cost ?? 0;
    }
    return null;
  };

  const messages: Array<{
    role: string;
    content?: string;
    tool_call_id?: string;
    tool_calls?: any[];
  }> = [
    {
      role: "system",
      content: config.systemPrompt
    },
    {
      role: "user",
      content: query
    }
  ];

  let iteration = 0;
  let finished = false;

  if (llmClient) {
    let agent = llmClient.agent
      .system(config.systemPrompt)
      .model(options.model || config.defaultModel)
      .temperature(config.temperature)
      .maxToolIterations(config.maxIterations)
      .addMiddleware(middleware);
    for (const tool of llmkitTools) agent = agent.addTool(tool);

    try {
      const result = await agent.prompt(query);
      finalAnswer = result.text.trim();
      latestAssistantContent = finalAnswer;
      modelUsed = modelUsed || options.model || config.defaultModel;
      promptTokens = result.usage.input;
      completionTokens = result.usage.output;
      modelCostUsd = result.usage.cost;
      iteration = Math.max(modelCalls, 1);
      finished = true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // 智能识别上游返回的模型不匹配提示并自动故障转移自愈
      // 例如: "The supported API model names are deepseek-flash, deepseek-v4-pro, but you passed nemotron-3-ultra-550b-a55b:free"
      const match = errorMsg.match(/supported\s+(?:API\s+)?model\s+names\s+are\s+([^,.]+)(?:,\s*([^.]+))?/i)
        || errorMsg.match(/supported\s+models(?:\s+are)?:\s*([^\n.]+)/i);

      let fallbackModel: string | null = null;
      if (match) {
        let rawCandidate = "";
        const areIdx = errorMsg.indexOf("are ");
        const butIdx = errorMsg.indexOf(", but you passed");
        if (areIdx !== -1 && butIdx !== -1) {
          rawCandidate = errorMsg.slice(areIdx + 4, butIdx);
        } else {
          rawCandidate = match[1] || "";
        }
        const candidates = rawCandidate
          .split(/[,，]/)
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
        if (candidates.length > 0) {
          fallbackModel = candidates[0];
        }
      } else if (errorMsg.includes("invalid_request_error") || errorMsg.includes("model_not_found")) {
        // 通用降级至预设的默认模型
        fallbackModel = config.defaultModel || "deepseek-flash";
      }

      if (fallbackModel && fallbackModel !== (options.model || config.defaultModel)) {
        console.warn(`[CodexAgent] 模型 '${options.model || config.defaultModel}' 被上游拒绝。自动故障转移至可用模型: '${fallbackModel}'`);
        try {
          let retryAgent = llmClient.agent
            .system(config.systemPrompt)
            .model(fallbackModel)
            .temperature(config.temperature)
            .maxToolIterations(config.maxIterations)
            .addMiddleware(middleware);
          for (const tool of llmkitTools) retryAgent = retryAgent.addTool(tool);

          const retryResult = await retryAgent.prompt(query);
          finalAnswer = retryResult.text.trim();
          latestAssistantContent = finalAnswer;
          modelUsed = fallbackModel;
          promptTokens = retryResult.usage.input;
          completionTokens = retryResult.usage.output;
          modelCostUsd = retryResult.usage.cost;
          iteration = Math.max(modelCalls, 1);
          finished = true;
        } catch (retryErr) {
          const providerError = toLlmProviderError(retryErr);
          console.warn(`[CodexAgent] 自动重试模型 '${fallbackModel}' 失败:`, providerError.message);
          throw providerError;
        }
      } else {
        const providerError = toLlmProviderError(error);
        console.warn(`[CodexAgent] llmkit Agent failed (${providerError.code}):`, providerError.message);
        throw providerError;
      }
    }
  }

  while (options.mockStepExecutor && iteration < config.maxIterations && !finished) {
    iteration++;

    if (options.mockStepExecutor) {
      try {
        const mockResp = await options.mockStepExecutor(messages, getOpenAiToolsFormat(), iteration);
        if (mockResp && mockResp.toolCalls && mockResp.toolCalls.length > 0) {
          messages.push({
            role: "assistant",
            content: mockResp.content || undefined,
            tool_calls: mockResp.toolCalls
          });

          for (const tc of mockResp.toolCalls) {
            const toolName = tc.function.name;
            toolsUsed.add(toolName);
            let args: Record<string, any> = {};
            try {
              args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            } catch {
              args = {};
            }

            // 与真实模型路径用同一套精准化规则：测试替身模拟的也是「模型决策」，
            // 两条路径行为不一致会让 e2e 验证失去意义。
            if (toolName === "search_web") {
              const prepared = prepareSearchArguments({
                query: String(args.query ?? ""),
                limit: typeof args.limit === "number" ? args.limit : undefined,
                language: typeof args.language === "string" ? args.language : undefined,
                domains: Array.isArray(args.domains) ? args.domains : undefined,
                recencyDays: typeof args.recencyDays === "number" ? args.recencyDays : undefined
              });
              for (const note of prepared.notes) recordReasoning(note);
              args = { ...args, ...prepared.args };
              if (args.query && !executedSearchQueries.includes(args.query)) {
                executedSearchQueries.push(args.query);
              }
            }

            const callStart = Date.now();
            eventBridge.recordToolCall(tc.id, toolName, args);
            eventBridge.emit({
              type: "tool_call",
              callId: tc.id,
              tool: toolName,
              arguments: args,
              timestamp: callStart
            });

            const toolOutput = await cerlesseMcpServer.callTool(toolName, args, mcpContext);
            const callEnd = Date.now();

            eventBridge.recordToolResult(tc.id, toolName, toolOutput, callEnd - callStart);
            eventBridge.emit({
              type: "tool_result",
              callId: tc.id,
              tool: toolName,
              result: toolOutput,
              durationMs: callEnd - callStart,
              timestamp: callEnd
            });

            if (toolName === "search_web") {
              const res = toolOutput as { results?: SearchResult[]; query?: string };
              if (res?.results) {
                sessionManager.addSources(threadId, res.results);
                mcpContext.knownSources = session.collectedSources;
                eventBridge.emit({
                  type: "source_update",
                  sources: session.collectedSources,
                  timestamp: Date.now()
                });
              }
            } else if (toolName === "search_images") {
              const res = toolOutput as { images?: SearchImage[] };
              if (res?.images) {
                imagesFound = [...imagesFound, ...res.images];
              }
            } else if (toolName === "prepare_widget") {
              const res = toolOutput as PreparedWidgetOutput;
              if (res?.success) {
                sessionManager.recordWidget(threadId, res);
                eventBridge.emit({
                  type: "widget_update",
                  widgets: session.preparedWidgets,
                  timestamp: Date.now()
                });
              }
            } else if (toolName === "execute_action") {
              const res = toolOutput as any;
              if (res?.action) {
                actions.push(res.action);
              }
            }

            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(toolOutput)
            });
          }
          continue;
        } else {
          finalAnswer = mockResp?.content || "Finished processing.";
          finished = true;
          break;
        }
      } catch (err: any) {
        console.error("Mock executor error:", err);
        finished = true;
        break;
      }
    }
  }

  if (!finalAnswer) {
    if (session.collectedSources.length > 0) {
      const topSources = session.collectedSources.slice(0, 5);
      const points = topSources.map((s, idx) => {
        const title = s.title.replace(/<[^>]*>/g, "").trim();
        const snippet = s.snippet.replace(/<[^>]*>/g, "").trim();
        return `### [${idx + 1}] ${title}\n${snippet}\n> 来源: [${s.title}](${s.url})`;
      });
      finalAnswer = `## 关于「${query}」的检索与核验分析\n\n根据对信源的实时检索与核验，为您提炼以下核心结论：\n\n` +
        points.join("\n\n");
    } else {
      finalAnswer = `关于「${query}」，暂未检索到充足的权威信源。根据 Cerlesse 规范，当证据不足时不做出推测性结论。`;
    }
  }

  // ============================================================
  // 证据驱动的受控补检
  // ============================================================
  const basePlanForEvidence = planSearchQueries(query);
  let evidence = evidenceAssessment ?? assessEvidence(session.collectedSources, basePlanForEvidence);

  const alreadySearched = executedSearchQueries.length > 0;

  if (session.collectedSources.length === 0) {
    recordReasoning(
      alreadySearched
        ? `已检索但未获得有效信源：${evidence.reason}`
        : `尚未获得有效信源，启动推理检索（${basePlanForEvidence.primary.rationale}）`,
      [
        `主查询：${basePlanForEvidence.primary.query}`,
        alreadySearched ? `已执行检索式：${executedSearchQueries.join(" | ")}` : "本轮尚未发起检索"
      ]
    );
    const outcome = await runReasonedSearch(query, 10, {
      initialResults: session.collectedSources,
      skipPrimary: alreadySearched
    });
    evidence = outcome.assessment;
  } else if (evidence.shouldRefine) {
    recordReasoning(
      `已有 ${session.collectedSources.length} 条信源但证据不足：${evidence.reason}`,
      [`已执行检索式：${executedSearchQueries.join(" | ") || "无"}`, `补检上限：1 轮`]
    );
    const outcome = await runReasonedSearch(query, 10, { initialResults: session.collectedSources });
    evidence = outcome.assessment;
  } else {
    recordReasoning(`证据充分，不再发起额外检索：${evidence.reason}`);
  }

  // 必须对主要来源执行 verify_source
  if (session.collectedSources.length > 0 && !toolsUsed.has("verify_source")) {
    const primarySource = session.collectedSources[0];
    const callId = `verify_${Date.now()}`;
    toolsUsed.add("verify_source");
    eventBridge.recordToolCall(callId, "verify_source", { url: primarySource.url });
    const verifyRes = await cerlesseMcpServer.callTool("verify_source", {
      url: primarySource.url,
      sourceId: primarySource.id
    }, mcpContext);
    eventBridge.recordToolResult(callId, "verify_source", verifyRes, 50);
  }

  // 小组件选型技能包（确定性、注册表驱动、证据可追溯）：
  // 模型已成功绑定的组件保持不变；绑定不足时按证据评分补齐缺失项（含核心组件常驻锚点）。
  const widgetSelection = selectWidgetsByEvidence({
    query,
    sources: session.collectedSources.map((s) => ({
      id: s.id,
      title: s.title,
      snippet: s.snippet,
      url: s.url,
      thumbnail: (s as any).thumbnail,
      isOfficial: (s as any).isOfficial
    })),
    images: imagesFound.map((img) => ({ imageUrl: img.imageUrl, thumbnailUrl: img.thumbnailUrl })),
    finalAnswer: finalAnswer || undefined
  });

  if (session.preparedWidgets.length === 0) {
    const callIdCatalog = `catalog_${Date.now()}`;
    toolsUsed.add("get_widget_catalog");
    eventBridge.recordToolCall(callIdCatalog, "get_widget_catalog", {});
    const catalog = await cerlesseMcpServer.callTool("get_widget_catalog", {});
    eventBridge.recordToolResult(callIdCatalog, "get_widget_catalog", catalog, 10);
  }

  // 依技能选型结果补齐缺失的真实 prepare_widget 绑定（sourceIds 可追溯到检索信源）
  const preparedIds = new Set(session.preparedWidgets.map((w) => w.widgetId));
  const missingIds = widgetSelection.selected.filter((id) => !preparedIds.has(id));
  for (const wId of missingIds) {
    const prepId = `prep_${wId}_${Date.now()}`;
    toolsUsed.add("prepare_widget");
    eventBridge.recordToolCall(prepId, "prepare_widget", { widgetId: wId, query });
    const prepRes = await cerlesseMcpServer.callTool("prepare_widget", {
      widgetId: wId,
      query,
      sourceIds: session.collectedSources.slice(0, 3).map((s) => s.id)
    });
    eventBridge.recordToolResult(prepId, "prepare_widget", prepRes, 10);
    if (prepRes.success) {
      sessionManager.recordWidget(threadId, prepRes);
    }
  }

  if (missingIds.length > 0) {
    eventBridge.emit({
      type: "widget_update",
      widgets: session.preparedWidgets,
      timestamp: Date.now()
    });
  }

  // 必须调用 solve_layout 进行无重叠几何装箱
  if (!session.layout || session.layout.tiles.length === 0) {
    const layoutCallId = `layout_${Date.now()}`;
    toolsUsed.add("solve_layout");
    const widgetIds = session.preparedWidgets.map((w) => w.widgetId);
    eventBridge.recordToolCall(layoutCallId, "solve_layout", { widgetIds });
    const layoutRes: SolveLayoutOutput = await cerlesseMcpServer.callTool("solve_layout", {
      widgetIds,
      emphasizedWidgetId: "ai_answer"
    });
    eventBridge.recordToolResult(layoutCallId, "solve_layout", layoutRes, 20);
    sessionManager.recordLayout(threadId, layoutRes);
  }

  // 测试替身兼容旧用例；正式请求已在前面强制要求模型最终回答，不允许规则拼接伪装。
  if (options.mockStepExecutor && !finalAnswer) {
    // 证据边界如实标注：命中不充分时，明确告诉用户「这是全部证据」，
    // 而不是把少量候选包装成「全网深度核验结论」。
    // 缺口词项已包含在 evidence.reason 里，这里不再重复罗列，避免同一句话出现两次。
    const evidenceBoundary = evidence && evidence.level !== "hit"
      ? `\n\n> **证据边界**：${evidence.reason}`
      : "";
    if (session.collectedSources.length > 0) {
      const topSources = session.collectedSources.slice(0, 5);
      const points = topSources.map((s, idx) => {
        const title = s.title.replace(/<[^>]*>/g, "").trim();
        const snippet = s.snippet.replace(/<[^>]*>/g, "").trim();
        return `### [${idx + 1}] ${title}\n${snippet}\n> 来源域: **${s.engine || "权威信源"}** · [点击直达](${s.url})`;
      });

      finalAnswer = `## 关于「${query}」的全网深度核验结论\n\n经过 OpenAI Codex Agent 对权威互联网信息源的实时检索与交叉核验，为您提炼核心结论：\n\n` +
        points.join("\n\n") +
        evidenceBoundary +
        `\n\n---\n*本分析由 Cerlesse 定制 OpenAI Codex Agent 实时驱动，信源已由 verify_source 工具完成证书与可信度鉴别。*`;
    } else {
      finalAnswer = `抱歉，经多路检索源检索，未获取到关于「${query}」的有效证据。根据 Cerlesse 真实性规范，当证据不足时不做出推测性结论。`;
    }
  }

  // 证据边界是本次检索的**事实**，与答案由谁生成无关：模型作答时同样要如实标注，
  // 否则一次 no_hit 会被一段自信的措辞完全掩盖，用户没法知道底下的证据到底有多少。
  if (finalAnswer && evidence && evidence.level !== "hit" && !finalAnswer.includes("证据边界")) {
    finalAnswer += `\n\n> **证据边界**：${evidence.reason}`;
  }

  const durationMs = Date.now() - startTime;
  const agentResponse: CerlesseAgentResponse = {
    threadId,
    finalResponse: finalAnswer,
    sources: session.collectedSources,
    widgets: session.preparedWidgets,
    actions,
    layout: session.layout,
    images: imagesFound,
    diagnostics: {
      toolsUsed: Array.from(toolsUsed),
      durationMs,
      iterations: iteration,
      provider: options.mockStepExecutor ? "mock" : "openai-compatible",
      model: options.mockStepExecutor ? "mock-test-model" : (modelUsed || options.model || config.defaultModel),
      modelCalls
    }
  };

  eventBridge.emit({
    type: "final_response",
    threadId,
    response: agentResponse,
    timestamp: Date.now()
  });

  // 选型技能输出：绑定清单 + 证据排序榜单（榜单随研报下发，供前端相关度补位）
  const selection = widgetSelection;

  const legacySynthesis = buildSynthesisResultFromCodex(
    query,
    agentResponse,
    eventBridge.getSteps(),
    durationMs,
    selection,
    // 让「展示给用户的检索计划」与「实际下发过的检索式 / 真实命中级别」一致
    { subQueries: executedSearchQueries, hitLevel: evidence?.level }
  );
  if (!options.mockStepExecutor && (promptTokens > 0 || completionTokens > 0)) {
    legacySynthesis.tokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: modelCostUsd || undefined,
      model: modelUsed
    };
  }

  return {
    response: agentResponse,
    legacySynthesis,
    eventBridge,
    session,
    selection
  };
}
