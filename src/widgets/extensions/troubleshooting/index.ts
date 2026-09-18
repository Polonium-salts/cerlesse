import { manifest } from "./manifest.js";
import { troubleshootingAdapter } from "./adapter.js";
import { TroubleshootingWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { TroubleshootingPlan } from "./types.js";

const troubleshootingExtension: WidgetExtension<TroubleshootingPlan> = {
  manifest,
  adapter: troubleshootingAdapter,
  component: TroubleshootingWidget
};

export default troubleshootingExtension;
export { manifest, troubleshootingAdapter, TroubleshootingWidget };
