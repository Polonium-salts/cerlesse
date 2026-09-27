import { manifest } from "./manifest.js";
import { documentPreviewAdapter } from "./adapter.js";
import { DocumentPreviewWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { DocumentPreviewData } from "./types.js";

const documentPreviewExtension: WidgetExtension<DocumentPreviewData> = {
  manifest,
  adapter: documentPreviewAdapter,
  component: DocumentPreviewWidget
};

export default documentPreviewExtension;
export { manifest, documentPreviewAdapter, DocumentPreviewWidget };
