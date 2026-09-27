import { manifest } from "./manifest.js";
import { verificationChecklistAdapter } from "./adapter.js";
import { VerificationChecklistWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { VerificationChecklistData } from "./types.js";

const verificationChecklistExtension: WidgetExtension<VerificationChecklistData> = {
  manifest,
  adapter: verificationChecklistAdapter,
  component: VerificationChecklistWidget
};

export default verificationChecklistExtension;
export { manifest, verificationChecklistAdapter, VerificationChecklistWidget };
