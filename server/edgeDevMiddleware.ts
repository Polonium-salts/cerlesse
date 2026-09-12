import type { Plugin, Connect } from "vite";
import { onRequest as handleConfig } from "../functions/api/config.js";
import { onRequest as handleHealth } from "../functions/api/health.js";
import { onRequest as handleSearch } from "../functions/api/search.js";
import { onRequest as handleIntent } from "../functions/api/intent.js";
import { onRequest as handlePlanner } from "../functions/api/planner.js";
import { onRequest as handleComposer } from "../functions/api/composer.js";
import { onRequest as handleForge } from "../functions/api/cards/forge.js";
import { onRequest as handleAgent } from "../functions/api/agent.js";
import { onRequest as handleAgentRun } from "../functions/api/agent/run.js";
import { onRequest as handleAgentStream } from "../functions/api/agent/stream.js";
import type { PagesFunction } from "../functions/api/types.js";

const routes: Record<string, PagesFunction> = {
  "/api/config": handleConfig,
  "/api/health": handleHealth,
  "/api/search": handleSearch,
  "/api/intent": handleIntent,
  "/api/planner": handlePlanner,
  "/api/composer": handleComposer,
  "/api/cards/forge": handleForge,
  "/api/agent/stream": handleAgentStream,
  "/api/agent/run": handleAgentRun,
  "/api/agent/synthesize": handleAgentRun,
  "/api/agent": handleAgent
};

/**
 * Vite Dev Plugin simulating Tencent EdgeOne Functions locally.
 * Intercepts /api/* requests and executes corresponding functions/api/* handlers
 * with standard Web Request/Response objects and context.env.
 */
export function edgeOneDevPlugin(): Plugin {
  return {
    name: "vite-plugin-edgeone-dev",
    configureServer(server) {
      server.middlewares.use(async (req: Connect.IncomingMessage, res: any, next: Connect.NextFunction) => {
        const rawUrl = req.url || "/";
        const pathname = rawUrl.split("?")[0];

        const handler = routes[pathname];
        if (!handler) {
          return next();
        }

        try {
          const protocol = (req.socket as any)?.encrypted ? "https" : "http";
          const host = req.headers.host || "localhost:3000";
          const fullUrl = new URL(rawUrl, `${protocol}://${host}`);

          // Read body for POST/PUT requests
          let bodyBuffer: Uint8Array | undefined;
          if (req.method !== "GET" && req.method !== "HEAD") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            bodyBuffer = Buffer.concat(chunks);
          }

          const webRequest = new Request(fullUrl.toString(), {
            method: req.method,
            headers: req.headers as HeadersInit,
            body: bodyBuffer
          });

          const context = {
            request: webRequest,
            functionPath: pathname,
            env: process.env,
            params: {},
            data: {},
            waitUntil: (p: Promise<any>) => p,
            next: () => Promise.resolve(new Response("Not found", { status: 404 }))
          };

          const webResponse = await handler(context);

          res.statusCode = webResponse.status;
          webResponse.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          if (webResponse.body) {
            const reader = webResponse.body.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
            } finally {
              res.end();
            }
          } else {
            res.end();
          }
        } catch (err: any) {
          console.error(`EdgeOne dev middleware error on ${pathname}:`, err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Internal Edge Function Error" }));
        }
      });
    }
  };
}
