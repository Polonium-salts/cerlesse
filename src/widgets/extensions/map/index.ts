import { manifest } from "./manifest.js";
import { mapAdapter } from "./adapter.js";
import { MapWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { MapWidgetData } from "./types.js";

const mapExtension: WidgetExtension<MapWidgetData> = {
  manifest,
  adapter: mapAdapter,
  component: MapWidget
};

export default mapExtension;
export { manifest, mapAdapter, MapWidget };
