import { manifest } from "./manifest.js";
import { weatherAdapter } from "./adapter.js";
import { WeatherWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { WeatherData } from "./types.js";

const weatherExtension: WidgetExtension<WeatherData> = {
  manifest,
  adapter: weatherAdapter,
  component: WeatherWidget
};

export default weatherExtension;
export { manifest, weatherAdapter, WeatherWidget };
