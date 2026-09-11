import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { runSearchAgent } from "./server/agent.js";
import { runAgentTeam } from "./server/agentTeam.js";
import { AVAILABLE_FREE_MODELS } from "./server/openrouter.js";
import { searchSearxng } from "./server/searxng.js";
import { SUPPORTED_LANGUAGES } from "./server/language.js";
import { forgeUniqueCard } from "./server/cardForge.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// --- API Routes ---

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// System & Model Status
app.get("/api/config", (req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
  res.json({
    hasGeminiKey: hasGemini,
    hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== ""),
    hasCustomSearxngUrl: Boolean(process.env.SEARXNG_URL && process.env.SEARXNG_URL.trim() !== ""),
    defaultModel: hasGemini ? "gemini-3.1-flash-lite" : "openrouter/free",
    models: AVAILABLE_FREE_MODELS,
    supportedLanguages: SUPPORTED_LANGUAGES
  });
});

// Raw SearXNG search endpoint
app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "缺少搜索关键词" });
    }
    const customUrl = req.query.customUrl as string | undefined;
    const lang = req.query.lang as string | undefined;
    const result = await searchSearxng(q, { customUrl, language: lang });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "搜索服务暂时不可用" });
  }
});

function cleanParam(val?: any): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

// Real-time Agent Search with Server-Sent Events (SSE)
app.get("/api/agent/stream", async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.trim() === "") {
    return res.status(400).json({ error: "缺少搜索关键词" });
  }

  const model = cleanParam(req.query.model);
  const apiKey = cleanParam(req.query.apiKey);
  const customSearxngUrl = cleanParam(req.query.searxngUrl);
  const enableDeepSearch = req.query.deep === "true";
  const targetLanguage = cleanParam(req.query.lang);

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as any).flush?.();
    }
  };

  // Keep-alive heartbeat every 3 seconds prevents proxies and browsers from timing out
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": keepalive\n\n");
      (res as any).flush?.();
    }
  }, 3000);

  req.on("close", () => {
    clearInterval(keepAliveInterval);
  });

  try {
    sendEvent("status", { message: "AgentTeam 多智能体协作组已就绪，正在并发调度..." });

    const result = await runAgentTeam({
      query: query.trim(),
      model,
      openRouterApiKey: apiKey,
      customSearxngUrl,
      targetLanguage,
      enableDeepSearch,
      onStepProgress: (currentStep, allSteps) => {
        sendEvent("step", { currentStep, allSteps });
      },
      onTeamProgress: (agentTeam) => {
        sendEvent("team_update", { agentTeam });
      }
    });

    sendEvent("complete", result);
  } catch (error: any) {
    console.error("AgentTeam error in SSE:", error);
    sendEvent("error", { message: error.message || "AgentTeam 协作执行过程发生异常" });
  } finally {
    clearInterval(keepAliveInterval);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// JSON POST for non-streaming clients and synthesis requests
app.post(["/api/agent/run", "/api/agent/synthesize"], async (req, res) => {
  try {
    const { query, model, apiKey, customSearxngUrl, enableDeepSearch, targetLanguage } = req.body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({ error: "缺少搜索关键词" });
    }

    const result = await runAgentTeam({
      query: query.trim(),
      model: cleanParam(model),
      openRouterApiKey: cleanParam(apiKey),
      customSearxngUrl: cleanParam(customSearxngUrl),
      targetLanguage: cleanParam(targetLanguage),
      enableDeepSearch: Boolean(enableDeepSearch)
    });

    res.json(result);
  } catch (error: any) {
    console.error("Agent run error:", error);
    res.status(500).json({ error: error.message || "执行搜索 Agent 失败" });
  }
});

// Dynamic Unique Card Forge Endpoint
app.post("/api/cards/forge", async (req, res) => {
  try {
    const { query, results, archetype, userPrompt, themeColor, colSpan, iconName } = req.body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({ error: "缺少搜索关键词" });
    }

    const card = await forgeUniqueCard({
      query: query.trim(),
      results: Array.isArray(results) ? results : [],
      archetype,
      userPrompt,
      themeColor,
      colSpan: typeof colSpan === "number" ? colSpan : 6,
      iconName
    });

    res.json({ card });
  } catch (error: any) {
    console.error("Card forge error:", error);
    res.status(500).json({ error: error.message || "创建独有卡片失败" });
  }
});

// Vite dev middleware or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
