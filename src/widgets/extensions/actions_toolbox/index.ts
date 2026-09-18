import { manifest } from "./manifest.js";
import { actionsToolboxAdapter } from "./adapter.js";
import { ActionsToolboxExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { ActionsToolboxData } from "./types.js";

const actionsToolboxExtension: WidgetExtension<ActionsToolboxData> = {
  manifest,
  adapter: actionsToolboxAdapter,
  component: ActionsToolboxExtensionWidget
};

export default actionsToolboxExtension;
export { manifest, actionsToolboxAdapter, ActionsToolboxExtensionWidget };
