import { manifest } from "./manifest.js";
import { codePlaygroundAdapter } from "./adapter.js";
import { CodePlaygroundWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { CodePlaygroundData } from "./types.js";

const codePlaygroundExtension: WidgetExtension<CodePlaygroundData> = {
  manifest,
  adapter: codePlaygroundAdapter,
  component: CodePlaygroundWidget
};

export default codePlaygroundExtension;
export { manifest, codePlaygroundAdapter, CodePlaygroundWidget };
