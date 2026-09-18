import { manifest } from "./manifest.js";
import { trendChartAdapter } from "./adapter.js";
import { TrendChartWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { TrendChartData } from "./types.js";

const trendChartExtension: WidgetExtension<TrendChartData> = {
  manifest,
  adapter: trendChartAdapter,
  component: TrendChartWidget
};

export default trendChartExtension;
export { manifest, trendChartAdapter, TrendChartWidget };
