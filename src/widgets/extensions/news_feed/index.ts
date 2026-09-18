import { manifest } from "./manifest.js";
import { newsFeedAdapter } from "./adapter.js";
import { NewsFeedWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { NewsFeedData } from "./types.js";

const newsFeedExtension: WidgetExtension<NewsFeedData> = {
  manifest,
  adapter: newsFeedAdapter,
  component: NewsFeedWidget
};

export default newsFeedExtension;
export { manifest, newsFeedAdapter, NewsFeedWidget };
