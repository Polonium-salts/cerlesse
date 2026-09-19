import { PagesFunction, errorResponse } from "../types.js";
import { runSearchAgent } from "../../../server/agent.js";

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
  let apiKey: string | undefined;
  let customSearxngUrl: string | undefined;
  let enableDeepSearch = true;
  let targetLanguage: string | undefined;

  if (context.request.method === "POST") {
    try {
      const body = await context.request.json();
      query = cleanParam(body?.query);
      model = cleanParam(body?.model);
      apiKey = cleanParam(body?.apiKey);
      customSearxngUrl = cleanParam(body?.customSearxngUrl || body?.searxngUrl);
      enableDeepSearch = body?.enableDeepSearch !== false && body?.deep !== false;
      targetLanguage = cleanParam(body?.targetLanguage || body?.lang);
    } catch {
      // fallback to URL search params
    }
  }

  if (!query) {
    const url = new URL(context.request.url);
    query = cleanParam(url.searchParams.get("q") || url.searchParams.get("query"));
    model = model || cleanParam(url.searchParams.get("model"));
    apiKey = apiKey || cleanParam(url.searchParams.get("apiKey"));
    customSearxngUrl = customSearxngUrl || cleanParam(url.searchParams.get("searxngUrl") || url.searchParams.get("customSearxngUrl"));
    if (url.searchParams.has("deep")) {
      enableDeepSearch = url.searchParams.get("deep") === "true";
    }
    targetLanguage = targetLanguage || cleanParam(url.searchParams.get("lang") || url.searchParams.get("targetLanguage"));
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

  // Keep-alive 心跳
  const keepAliveTimer = setInterval(() => {
    safeWrite(": keepalive\n\n");
  }, 3000);

  // 异步流式调度智能搜索 Agent
  (async () => {
    try {
      await sendEvent("status", { message: "智能搜索 Agent 正在检索与分析中..." });

      const result = await runSearchAgent({
        query: query.trim(),
        model,
        openRouterApiKey: apiKey,
        customSearxngUrl,
        targetLanguage,
        enableDeepSearch,
        env: context.env,
        onStepProgress: (currentStep, allSteps) => {
          sendEvent("step", { currentStep, allSteps });
        }
      });

      await sendEvent("complete", result);
    } catch (error: any) {
      console.error("EdgeOne search agent stream error:", error);
      await sendEvent("error", { message: error.message || "搜索 Agent 执行过程发生异常" });
    } finally {
      clearInterval(keepAliveTimer);
      isClosed = true;
      try {
        await writer.close();
      } catch {
        // stream already closed
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
    }
  });
};

export default onRequest;
