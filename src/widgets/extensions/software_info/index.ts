import { manifest } from "./manifest.js";
import { softwareInfoAdapter } from "./adapter.js";
import { SoftwareInfoWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { SoftwareInfoData } from "./types.js";

const softwareInfoExtension: WidgetExtension<SoftwareInfoData> = {
  manifest,
  adapter: softwareInfoAdapter,
  component: SoftwareInfoWidget
};

export default softwareInfoExtension;
export { manifest, softwareInfoAdapter, SoftwareInfoWidget };
