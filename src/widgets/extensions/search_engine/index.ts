import { manifest } from "./manifest.js";
import { searchEngineAdapter } from "./adapter.js";
import { SearchEngineExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { SearchEngineData } from "./types.js";

const searchEngineExtension: WidgetExtension<SearchEngineData> = {
  manifest,
  adapter: searchEngineAdapter,
  component: SearchEngineExtensionWidget
};

export default searchEngineExtension;
export { manifest, searchEngineAdapter, SearchEngineExtensionWidget };
