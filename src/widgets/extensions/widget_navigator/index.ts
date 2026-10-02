import { manifest } from "./manifest.js";
import { widgetNavigatorAdapter } from "./adapter.js";
import { WidgetNavigatorWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { WidgetNavigatorData } from "./types.js";

const widgetNavigatorExtension: WidgetExtension<WidgetNavigatorData> = {
  manifest,
  adapter: widgetNavigatorAdapter,
  component: WidgetNavigatorWidget
};

export default widgetNavigatorExtension;
export { manifest, widgetNavigatorAdapter, WidgetNavigatorWidget };
