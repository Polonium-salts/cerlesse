import { manifest } from "./manifest.js";
import { downloadAdapter } from "./adapter.js";
import { DownloadWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { DownloadWidgetData } from "./types.js";

const downloadExtension: WidgetExtension<DownloadWidgetData> = {
  manifest,
  adapter: downloadAdapter,
  component: DownloadWidget
};

export default downloadExtension;
export { manifest, downloadAdapter, DownloadWidget };
