import { PagesFunction, errorResponse } from "../types.js";
import { runSearchAgent } from "../../../server/agent.js";

function cleanParam(val?: any): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const query = url.searchParams.get("q");

  if (!query || query.trim() === "") {
    return errorResponse("缺少搜索关键词", 400);
  }

  const model = cleanParam(url.searchParams.get("model"));
  const apiKey = cleanParam(url.searchParams.get("apiKey"));
  const customSearxngUrl = cleanParam(url.searchParams.get("searxngUrl"));
  const enableDeepSearch = url.searchParams.get("deep") === "true";
  const targetLanguage = cleanParam(url.searchParams.get("lang"));

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
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};
