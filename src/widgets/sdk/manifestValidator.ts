import type { WidgetManifest } from "./manifest.js";
import { CANONICAL_CAPABILITIES, CANONICAL_INTENTS } from "../capabilityTaxonomy.js";

const VALID_CATEGORIES = new Set([
  "synthesis",
  "analysis",
  "action",
  "portal",
  "data",
  "media",
  "developer",
  "location"
]);

const CANONICAL_CAP_SET = new Set(CANONICAL_CAPABILITIES);
const CANONICAL_INTENT_SET = new Set<string>(CANONICAL_INTENTS);

export function validateManifest(manifest: WidgetManifest, expectedDirectoryId?: string): void {
  if (!manifest) {
    throw new Error("Widget manifest is required");
  }

  if (!manifest.id || typeof manifest.id !== "string" || manifest.id.trim() === "") {
    throw new Error("Widget manifest requires id");
  }

  // 校验目录 ID 与 Manifest ID 是否对齐
  if (expectedDirectoryId) {
    const normalizedDir = expectedDirectoryId.replace(/^_+/, "");
    const normalizedId = manifest.id.replace(/^_+/, "");
    const isMatch = (
      expectedDirectoryId === manifest.id ||
      normalizedDir === normalizedId ||
      (normalizedDir.startsWith("test") && normalizedId.startsWith("test"))
    );
    if (!isMatch) {
      throw new Error(
        `Directory ID "${expectedDirectoryId}" does not match Manifest ID "${manifest.id}"`
      );
    }
  }

  if (!manifest.name || typeof manifest.name !== "string" || manifest.name.trim() === "") {
    throw new Error(`Widget ${manifest.id} requires name`);
  }

  if (!manifest.version || typeof manifest.version !== "string") {
    throw new Error(`Widget ${manifest.id} requires version`);
  }

  if (typeof manifest.apiVersion !== "number" || manifest.apiVersion <= 0) {
    throw new Error(`Widget ${manifest.id} requires valid positive apiVersion`);
  }

  if (!manifest.description || typeof manifest.description !== "string" || manifest.description.trim() === "") {
    throw new Error(`Widget ${manifest.id} requires description`);
  }

  if (!VALID_CATEGORIES.has(manifest.category)) {
    throw new Error(`Widget ${manifest.id} has invalid category: ${manifest.category}`);
  }

  // 能力列表校验
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    throw new Error(`Widget ${manifest.id} requires capabilities`);
  }
  for (const cap of manifest.capabilities) {
    if (!CANONICAL_CAP_SET.has(cap as any)) {
      throw new Error(`Widget ${manifest.id} has invalid capability: ${cap}`);
    }
  }

  // 意图列表校验
  if (!Array.isArray(manifest.intents) || manifest.intents.length === 0) {
    throw new Error(`Widget ${manifest.id} requires intents`);
  }
  for (const intent of manifest.intents) {
    if (!CANONICAL_INTENT_SET.has(intent)) {
      throw new Error(`Widget ${manifest.id} has invalid intent: ${intent}`);
    }
  }

  // 布局规格校验
  if (!manifest.layout || typeof manifest.layout !== "object") {
    throw new Error(`Widget ${manifest.id} requires layout definition`);
  }

  const { defaultWidth, minWidth, maxWidth } = manifest.layout;
  const validWidths = [25, 50, 75, 100];

  if (!validWidths.includes(defaultWidth)) {
    throw new Error(`Widget ${manifest.id} layout defaultWidth must be 25, 50, 75, or 100`);
  }
  if (!validWidths.includes(minWidth)) {
    throw new Error(`Widget ${manifest.id} layout minWidth must be 25, 50, 75, or 100`);
  }
  if (!validWidths.includes(maxWidth)) {
    throw new Error(`Widget ${manifest.id} layout maxWidth must be 25, 50, 75, or 100`);
  }
  if (minWidth > maxWidth) {
    throw new Error(`Widget ${manifest.id} layout minWidth (${minWidth}) cannot exceed maxWidth (${maxWidth})`);
  }
  if (defaultWidth < minWidth || defaultWidth > maxWidth) {
    throw new Error(
      `Widget ${manifest.id} layout defaultWidth (${defaultWidth}) must be between minWidth (${minWidth}) and maxWidth (${maxWidth})`
    );
  }

  // Agent 配置校验
  if (manifest.agent) {
    if (typeof manifest.agent.minConfidence === "number") {
      if (manifest.agent.minConfidence < 0 || manifest.agent.minConfidence > 1) {
        throw new Error(
          `Widget ${manifest.id} agent minConfidence (${manifest.agent.minConfidence}) must be between 0 and 1`
        );
      }
    }
  }
}

