import { manifest } from "./manifest.js";
import { comparisonAdapter } from "./adapter.js";
import { ComparisonExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { ComparisonData } from "./types.js";

const comparisonExtension: WidgetExtension<ComparisonData> = {
  manifest,
  adapter: comparisonAdapter,
  component: ComparisonExtensionWidget
};

export default comparisonExtension;
export { manifest, comparisonAdapter, ComparisonExtensionWidget };
