import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { runCodexAgent, CodexEventBridge } from "./server/codex/index.js";
import {
  getAiApiConfig,
  getProviderStatus,
  loadAvailableModels,
  resolveModelProvider,
  detectAndFetchModels,
  pingModel,
  respondAgentError,
  LlmProviderError
} from "./server/aiProvider.js";
import { SUPPORTED_LANGUAGES } from "./server/language.js";
import { translateText } from "./server/translationAgent.js";
import { executeWebSearch } from "./server/services/searchService.js";
import { solveLayoutTool } from "./server/tools/layoutTool.js";
import { searchSearxngImages } from "./server/searxng.js";
import {
  initializeWidgetExtensions,
  getWidgetRegistryHealth,
  extensionRegistry,
  getExtensionCatalog
} from "./src/widgets/registry/index.js";

dotenv.config({ path: [".env.local", ".env"] });

const app = express();
const PORT = 3000;
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/api/agent/health", async (_req, res) => {
  const status = resolveModelProvider(process.env);
  if (!status.ready) {
    return res.status(503).json({ ok: false, reason: status.reason, provider: status.provider });
  }
  try {
    const ping = await pingModel(status);
    if (ping.ok) {
      return res.json({ ok: true, provider: status.provider, latencyMs: ping.latencyMs });
    }
    return res.status(502).json({ ok: false, provider: status.provider, reason: ping.error || "provider_unreachable" });
  } catch (_e) {
    return res.status(502).json({ ok: false, provider: status.provider, reason: "provider_unreachable" });
  }
});

app.get("/api/widgets/health", (_req, res) => {
  try {
    initializeWidgetExtensions();
    const health = getWidgetRegistryHealth();
    const catalog = getExtensionCatalog();
    const registeredIds = extensionRegistry.getAll().map((ext) => ext.manifest.id);
    const catalogIds = catalog.map((entry) => entry.id);
    const missingInRegistry = catalogIds.filter((id) => !registeredIds.includes(id));
    const isHealthy = health.initialized && registeredIds.length > 0 &&
      missingInRegistry.length === 0 && extensionRegistry.has("related_links");

    res.json({
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: Date.now(),
      health,
      registeredCount: registeredIds.length,
      catalogCount: catalogIds.length,
      missingInRegistry,
      registeredWidgets: registeredIds,
      relatedLinksCheck: {
        registeredInRegistry: extensionRegistry.has("related_links"),
        inCatalog: catalogIds.includes("related_links")
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 单一来源转述模型提供商状态，配合搜索与多语言配置
app.get("/api/config", async (_req, res) => {
  const env = process.env;
  const status = resolveModelProvider(env);
  res.json({
    ...status,
    hasCustomSearxngUrl: Boolean(env.SEARXNG_URL && env.SEARXNG_URL.trim()),
    supportedLanguages: SUPPORTED_LANGUAGES
  });
});

// 根据 API Key / Base URL 自动探测上游提供商与动态加载可用模型
app.all("/api/models/detect", async (req, res) => {
  try {
    const apiKey = (req.headers["x-custom-api-key"] as string) || req.body?.apiKey || (req.query?.apiKey as string);
    const apiBaseUrl = (req.headers["x-custom-base-url"] as string) || req.body?.apiBaseUrl || (req.query?.apiBaseUrl as string);
    const provider = req.body?.provider || (req.query?.provider as string);
    const result = await detectAndFetchModels({
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

const handleAgentRun = async (req: express.Request, res: express.Response) => {
  try {
    const { query, model, customSearxngUrl } = req.body || {};
    if (typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "缺少搜索关键词" });
    }
    const apiKey = (req.headers["x-custom-api-key"] as string) || req.body?.apiKey;
    const apiBaseUrl = (req.headers["x-custom-base-url"] as string) || req.body?.apiBaseUrl;
    const result = await runCodexAgent(query.trim(), {
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
app.post("/api/planner", (_req, res) => res.status(410).json({ error: "规划由搜索 Agent 完成。" }));
app.post("/api/intent", (_req, res) => res.status(410).json({ error: "意图分析由搜索 Agent 完成。" }));
app.post("/api/cards/forge", (_req, res) => res.status(503).json({ error: "AI 卡片生成 API 已暂时移除。" }));

app.get("/api/agent/stream", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) return res.status(400).json({ error: "缺少搜索关键词" });

  const model = cleanParam(req.query.model);
  const customSearxngUrl = cleanParam(req.query.searxngUrl);
  const apiKey = (req.headers["x-custom-api-key"] as string) || (req.query.apiKey as string);
  const apiBaseUrl = (req.headers["x-custom-base-url"] as string) || (req.query.apiBaseUrl as string);
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

    const result = await runCodexAgent(query, {
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

// Independent web search does not use an AI provider.
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

// Independent image search does not use an AI provider.
app.get("/api/images", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim() === "") return res.status(400).json({ error: "缺少搜索关键词" });
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 36, 1), 72);
    const images = await searchSearxngImages(q.trim(), {
      customUrl: cleanParam(req.query.customUrl),
      language: cleanParam(req.query.lang),
      limit,
      page
    });
    res.json({ query: q.trim(), images, page, total: images.length });
  } catch (error) {
    console.error("Images search error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "图片检索失败" });
  }
});

app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLang, targetLang, model } = req.body || {};
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "缺少待翻译文本" });
    }
    const result = await translateText({
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

// Deterministic layout calculations remain available.
app.post(["/api/layout/plan", "/api/agent/layout"], (req, res) => {
  try {
    const { widgetIds, widgetPlan } = req.body || {};
    const targetIds = Array.isArray(widgetIds)
      ? widgetIds
      : widgetPlan?.selectedWidgets
        ? widgetPlan.selectedWidgets.map((widget: any) => widget.type || widget.id)
        : widgetPlan?.widgetOrder || [];
    res.json(solveLayoutTool({ widgetIds: targetIds }));
  } catch (error) {
    console.error("Layout solve error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "装箱排版求解异常" });
  }
});

app.get("/api/layout/plan", (req, res) => {
  try {
    const widgetsParam = cleanParam(req.query.widgets);
    const widgetIds = widgetsParam ? widgetsParam.split(",") : ["related_links", "takeaways"];
    res.json(solveLayoutTool({ widgetIds }));
  } catch (error) {
    console.error("Layout solve error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "装箱排版求解异常" });
  }
});

function cleanParam(value?: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return !trimmed || trimmed === "undefined" || trimmed === "null" ? undefined : trimmed;
}

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
