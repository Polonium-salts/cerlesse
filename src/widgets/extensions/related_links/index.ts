import { manifest } from "./manifest.js";
import { relatedLinksAdapter } from "./adapter.js";
import { RelatedLinksExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { RelatedLinksData } from "./types.js";

const relatedLinksExtension: WidgetExtension<RelatedLinksData> = {
  manifest,
  adapter: relatedLinksAdapter,
  component: RelatedLinksExtensionWidget
};

export default relatedLinksExtension;
export { manifest, relatedLinksAdapter, RelatedLinksExtensionWidget };
