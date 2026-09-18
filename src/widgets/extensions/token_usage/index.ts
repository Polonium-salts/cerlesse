import { manifest } from "./manifest.js";
import { tokenUsageAdapter } from "./adapter.js";
import { TokenUsageExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { TokenUsageData } from "./types.js";

const tokenUsageExtension: WidgetExtension<TokenUsageData> = {
  manifest,
  adapter: tokenUsageAdapter,
  component: TokenUsageExtensionWidget
};

export default tokenUsageExtension;
export { manifest, tokenUsageAdapter, TokenUsageExtensionWidget };
