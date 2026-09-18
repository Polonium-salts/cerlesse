import { manifest } from "./manifest.js";
import { sourcesAdapter } from "./adapter.js";
import { SourcesExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { SourcesData } from "./types.js";

const sourcesExtension: WidgetExtension<SourcesData> = {
  manifest,
  adapter: sourcesAdapter,
  component: SourcesExtensionWidget
};

export default sourcesExtension;
export { manifest, sourcesAdapter, SourcesExtensionWidget };
