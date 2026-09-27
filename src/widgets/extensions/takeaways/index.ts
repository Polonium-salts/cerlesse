import { manifest } from "./manifest.js";
import { takeawaysAdapter } from "./adapter.js";
import { TakeawaysExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { TakeawaysData } from "./types.js";

const takeawaysExtension: WidgetExtension<TakeawaysData> = {
  manifest,
  adapter: takeawaysAdapter,
  component: TakeawaysExtensionWidget
};

export default takeawaysExtension;
export { manifest, takeawaysAdapter, TakeawaysExtensionWidget };
