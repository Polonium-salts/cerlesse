import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { CodexEventBridge } from "./server/codex/index.js";
import { respondAgentError, resolveModelProvider } from "./server/aiProvider.js";
import { cleanParam, extractAuthHeaders } from "./server/utils/http.js";
import { getSystemHealth, getAgentHealth, getWidgetsHealth } from "./server/services/healthService.js";
import { getSystemConfig, detectModels } from "./server/services/modelsService.js";
import { executeWebSearch } from "./server/services/searchService.js";
import { executeImageSearch } from "./server/services/imagesService.js";
import { executeTranslation } from "./server/services/translationService.js";
import { executeLayoutSolve } from "./server/services/layoutService.js";
import { executeAgentRun } from "./server/services/agentService.js";

dotenv.config({ path: [".env.local", ".env"] });

const app = express();
const PORT = 3000;
app.use(express.json());

// 基础健康探测
app.get("/api/health", (_req, res) => {
  res.json(getSystemHealth("Node.js Server"));
});

// Agent 模型与提供商健康探测
app.get("/api/agent/health", async (_req, res) => {
  const { status, body } = await getAgentHealth(process.env);
  res.status(status).json(body);
});

// 小组件注册表健康探测
app.get("/api/widgets/health", (_req, res) => {
  const { status, body } = getWidgetsHealth();
  res.status(status).json(body);
});

// 单一来源转述模型提供商状态，配合搜索与多语言配置
app.get("/api/config", async (_req, res) => {
  const config = await getSystemConfig(process.env);
  res.json(config);
});

// 根据 API Key / Base URL 自动探测上游提供商与动态加载可用模型
app.all(["/api/models/detect", "/api/models"], async (req, res) => {
  try {
    const { apiKey, apiBaseUrl, provider } = extractAuthHeaders(req);
    const result = await detectModels({
      apiKey,
      apiBaseUrl,
      provider,
      env: process.env
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 单一 Codex Agent 执行入口
const handleAgentRun = async (req: express.Request, res: express.Response) => {
  try {
    const { query, model, customSearxngUrl } = req.body || {};
    if (typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "缺少搜索关键词" });
    }
    const { apiKey, apiBaseUrl } = extractAuthHeaders(req);
    const result = await executeAgentRun({
      query: query.trim(),
      model: cleanParam(model),
      customSearxngUrl: cleanParam(customSearxngUrl),
      apiKey: cleanParam(apiKey),
      apiBaseUrl: cleanParam(apiBaseUrl),
      env: process.env
    });
    return res.json(result.legacySynthesis);
  } catch (error) {
    respondAgentError(error, res);
  }
};

app.post("/api/agent", handleAgentRun);
app.post(["/api/agent/run", "/api/agent/synthesize"], handleAgentRun);
app.post("/api/planner", (_req, res) => res.status(410).json({ error: "规划由 Codex 搜索 Agent 完成。" }));
app.post("/api/intent", (_req, res) => res.status(410).json({ error: "意图分析由 Codex 搜索 Agent 完成。" }));
app.post("/api/cards/forge", (_req, res) => res.status(503).json({ error: "AI 卡片生成 API 已暂时移除。" }));

// Codex Agent SSE 流式接口
app.get("/api/agent/stream", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) return res.status(400).json({ error: "缺少搜索关键词" });

  const model = cleanParam(req.query.model);
  const customSearxngUrl = cleanParam(req.query.searxngUrl);
  const { apiKey, apiBaseUrl } = extractAuthHeaders(req);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: unknown) => {
    if (!res.writableEnded && !res.destroyed) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as any).flush?.();
    }
  };
  const keepAlive = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": keepalive\n\n");
  }, 3000);
  res.on("close", () => clearInterval(keepAlive));

  try {
    sendEvent("status", { message: "Cerlesse Agent 正在检索并调用工具..." });
    const eventBridge = new CodexEventBridge();
    eventBridge.subscribe((event) => {
      if (event.type === "tool_call" || event.type === "tool_result") {
        sendEvent("step", { currentStep: event, allSteps: eventBridge.getSteps() });
        sendEvent(event.type, event);
      } else if (event.type === "source_update" || event.type === "widget_update") {
        sendEvent(event.type, event);
      }
    });

    const result = await executeAgentRun({
      query,
      model,
      customSearxngUrl,
      apiKey: cleanParam(apiKey),
      apiBaseUrl: cleanParam(apiBaseUrl),
      env: process.env,
      eventBridge
    });
    sendEvent("complete", result.legacySynthesis);
  } catch (error) {
    respondAgentError(error, sendEvent);
  } finally {
    clearInterval(keepAlive);
    if (!res.writableEnded) res.end();
  }
});

// 纯 Web 独立检索
app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim() === "") return res.status(400).json({ error: "缺少搜索关键词" });
    const response = await executeWebSearch(q, {
      customUrl: cleanParam(req.query.customUrl),
      language: cleanParam(req.query.lang),
      limit: 20
    });
    res.json({
      results: response.results,
      instanceUsed: response.sourceEngine,
      instancesUsed: response.instancesUsed,
      totalCandidates: response.rawCount,
      uniqueCandidates: response.uniqueCount
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "搜索服务暂时不可用" });
  }
});

// 纯图片独立检索
app.get("/api/images", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim() === "") return res.status(400).json({ error: "缺少搜索关键词" });
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 36, 1), 72);
    const result = await executeImageSearch(q, {
      customUrl: cleanParam(req.query.customUrl),
      language: cleanParam(req.query.lang),
      limit,
      page
    });
    res.json(result);
  } catch (error) {
    console.error("Images search error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "图片检索失败" });
  }
});

// 多语言翻译服务
app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLang, targetLang, model } = req.body || {};
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "缺少待翻译文本" });
    }
    const result = await executeTranslation({
      text: text.trim(),
      sourceLang: cleanParam(sourceLang),
      targetLang: cleanParam(targetLang),
      model: cleanParam(model),
      env: process.env
    });
    return res.json(result);
  } catch (error) {
    respondAgentError(error, res);
  }
});

// 确定性装箱排版求解
app.post(["/api/layout/plan", "/api/agent/layout"], (req, res) => {
  try {
    const { widgetIds, widgetPlan } = req.body || {};
    res.json(executeLayoutSolve({ widgetIds, widgetPlan }));
  } catch (error) {
    console.error("Layout solve error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "装箱排版求解异常" });
  }
});

app.get("/api/layout/plan", (req, res) => {
  try {
    const widgetsParam = cleanParam(req.query.widgets);
    const widgetIds = widgetsParam ? widgetsParam.split(",") : ["related_links", "takeaways"];
    res.json(executeLayoutSolve({ widgetIds }));
  } catch (error) {
    console.error("Layout solve error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "装箱排版求解异常" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    const providerStatus = resolveModelProvider(process.env);
    console.info(`[startup] 模型提供商状态: ${providerStatus.ready ? "已就绪" : "未就绪"} (提供商: ${providerStatus.provider}${providerStatus.reason ? `, 原因: ${providerStatus.reason}` : ""})`);
  });
}

startServer();
