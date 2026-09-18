import { manifest } from "./manifest.js";
import { aiAnswerAdapter } from "./adapter.js";
import { AiAnswerExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { AiAnswerData } from "./types.js";

const aiAnswerExtension: WidgetExtension<AiAnswerData> = {
  manifest,
  adapter: aiAnswerAdapter,
  component: AiAnswerExtensionWidget
};

export default aiAnswerExtension;
export { manifest, aiAnswerAdapter, AiAnswerExtensionWidget };
