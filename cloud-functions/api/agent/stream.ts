import { PagesFunction, errorResponse } from "../types.js";
import { runCodexAgent, CodexEventBridge } from "../../../server/codex/index.js";
import { respondAgentError } from "../../../server/aiProvider.js";

function cleanParam(val?: any): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
      }
    });
  }

  let query: string | undefined;
  let model: string | undefined;
  let customSearxngUrl: string | undefined;

  if (context.request.method === "POST") {
    try {
      const body = await context.request.json();
      query = cleanParam(body?.query);
      model = cleanParam(body?.model);
      customSearxngUrl = cleanParam(body?.customSearxngUrl || body?.searxngUrl);
    } catch {
      // fallback to URL search params
    }
  }

  if (!query) {
    const url = new URL(context.request.url);
    query = cleanParam(url.searchParams.get("q") || url.searchParams.get("query"));
    model = model || cleanParam(url.searchParams.get("model"));
    customSearxngUrl = customSearxngUrl || cleanParam(url.searchParams.get("searxngUrl") || url.searchParams.get("customSearxngUrl"));
  }

  if (!query) {
    return errorResponse("缺少搜索关键词", 400);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  let isClosed = false;
  const safeWrite = async (chunk: string) => {
    if (isClosed) return;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      isClosed = true;
    }
  };

  const sendEvent = async (event: string, data: any) => {
    await safeWrite(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const keepAliveTimer = setInterval(() => {
    safeWrite(": keepalive\n\n");
  }, 3000);

  // 异步流式调度 Codex Agent
  (async () => {
    try {
      await sendEvent("status", { message: "Cerlesse Agent 正在检索并调用工具..." });

      const eventBridge = new CodexEventBridge();
      eventBridge.subscribe(async (ev) => {
        if (ev.type === "tool_call" || ev.type === "tool_result") {
          await sendEvent("step", { currentStep: ev, allSteps: eventBridge.getSteps() });
          await sendEvent(ev.type, ev);
        } else if (ev.type === "source_update" || ev.type === "widget_update") {
          await sendEvent(ev.type, ev);
        }
      });

      const result = await runCodexAgent(query!.trim(), {
        model,
        customSearxngUrl,
        env: context.env,
        eventBridge
      });

      await sendEvent("complete", result.legacySynthesis);
    } catch (err) {
      const { message, status } = respondAgentError(err);
      await sendEvent("error", { message, status });
    } finally {
      clearInterval(keepAliveTimer);
      if (!isClosed) {
        try {
          await writer.close();
        } catch {
          // ignore
        }
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
};

export default onRequest;
