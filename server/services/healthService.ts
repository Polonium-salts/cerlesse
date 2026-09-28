import { resolveModelProvider, pingModel } from "../aiProvider.js";
import {
  initializeWidgetExtensions,
  getWidgetRegistryHealth,
  extensionRegistry,
  getExtensionCatalog
} from "../../src/widgets/registry/index.js";

export function getSystemHealth(platform = "Node.js Server") {
  return {
    status: "ok",
    timestamp: Date.now(),
    platform,
    nodeVersion: typeof process !== "undefined" ? process.version : "edge"
  };
}

export async function getAgentHealth(env?: Record<string, string | undefined>) {
  const effectiveEnv = env || (typeof process !== "undefined" ? process.env : {});
  const status = resolveModelProvider(effectiveEnv);
  if (!status.ready) {
    return {
      status: 503,
      body: { ok: false, reason: status.reason, provider: status.provider }
    };
  }
  try {
    const ping = await pingModel(status);
    if (ping.ok) {
      return {
        status: 200,
        body: { ok: true, provider: status.provider, latencyMs: ping.latencyMs }
      };
    }
    return {
      status: 502,
      body: { ok: false, provider: status.provider, reason: ping.error || "provider_unreachable" }
    };
  } catch (_e) {
    return {
      status: 502,
      body: { ok: false, provider: status.provider, reason: "provider_unreachable" }
    };
  }
}

export function getWidgetsHealth() {
  try {
    initializeWidgetExtensions();
    const health = getWidgetRegistryHealth();
    const catalog = getExtensionCatalog();
    const registeredIds = extensionRegistry.getAll().map((ext) => ext.manifest.id);
    const catalogIds = catalog.map((entry) => entry.id);
    const missingInRegistry = catalogIds.filter((id) => !registeredIds.includes(id));
    const isHealthy =
      health.initialized &&
      registeredIds.length > 0 &&
      missingInRegistry.length === 0 &&
      extensionRegistry.has("related_links");

    return {
      status: isHealthy ? 200 : 503,
      body: {
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
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
