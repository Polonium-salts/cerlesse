import { manifest } from "./manifest.js";
import { companyInfoAdapter } from "./adapter.js";
import { CompanyInfoWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { CompanyInfoData } from "./types.js";

const companyInfoExtension: WidgetExtension<CompanyInfoData> = {
  manifest,
  adapter: companyInfoAdapter,
  component: CompanyInfoWidget
};

export default companyInfoExtension;
export { manifest, companyInfoAdapter, CompanyInfoWidget };
