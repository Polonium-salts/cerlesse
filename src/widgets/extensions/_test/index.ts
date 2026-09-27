import type { WidgetExtension } from "../../sdk/extension.js";
import { manifest } from "./manifest.js";
import { adapter, TestExtensionData } from "./adapter.js";
import { TestWidget } from "./widget.js";

const testExtension: WidgetExtension<TestExtensionData> = {
  manifest,
  adapter,
  component: TestWidget
};

export default testExtension;
