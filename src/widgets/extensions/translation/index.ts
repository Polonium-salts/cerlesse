import { manifest } from "./manifest.js";
import { translationAdapter } from "./adapter.js";
import { TranslationWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { TranslationData } from "./types.js";

const translationExtension: WidgetExtension<TranslationData> = {
  manifest,
  adapter: translationAdapter,
  component: TranslationWidget
};

export default translationExtension;
export { manifest, translationAdapter, TranslationWidget };
