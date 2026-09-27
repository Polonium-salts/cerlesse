import { manifest } from "./manifest.js";
import { toolDiscoveryAdapter } from "./adapter.js";
import { ToolDiscoveryWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { ToolDiscoveryData } from "./types.js";

const toolDiscoveryExtension: WidgetExtension<ToolDiscoveryData> = {
  manifest,
  adapter: toolDiscoveryAdapter,
  component: ToolDiscoveryWidget
};

export default toolDiscoveryExtension;
export { manifest, toolDiscoveryAdapter, ToolDiscoveryWidget };
