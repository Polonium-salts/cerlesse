import { WidgetModule } from "../sdk/types.js";
import { VerificationChecklistWidget } from "../components/VerificationChecklistWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：排查与核验清单 (verification_checklist)
 */
export const verificationChecklistModule: WidgetModule = {
  ...manifestMeta("verification_checklist"),
  render: (ctx) => {
    return (
      <VerificationChecklistWidget
        activeResult={ctx.activeResult}
        query={ctx.activeResult?.query}
        isCompact={ctx.isCompact}
      />
    );
  }
};
