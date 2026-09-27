import { manifest } from "./manifest.js";
import { releaseHistoryAdapter } from "./adapter.js";
import { ReleaseHistoryWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { ReleaseHistoryData } from "./types.js";

const releaseHistoryExtension: WidgetExtension<ReleaseHistoryData> = {
  manifest,
  adapter: releaseHistoryAdapter,
  component: ReleaseHistoryWidget
};

export default releaseHistoryExtension;
export { manifest, releaseHistoryAdapter, ReleaseHistoryWidget };
