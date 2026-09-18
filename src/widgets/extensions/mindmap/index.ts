import { manifest } from "./manifest.js";
import { mindmapAdapter } from "./adapter.js";
import { MindMapExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { MindMapData } from "./types.js";

const mindmapExtension: WidgetExtension<MindMapData> = {
  manifest,
  adapter: mindmapAdapter,
  component: MindMapExtensionWidget
};

export default mindmapExtension;
export { manifest, mindmapAdapter, MindMapExtensionWidget };
