import { WidgetModule } from "../sdk/types.js";
import { TroubleshootingWidget } from "../components/TroubleshootingWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：故障排查与修复流程 (troubleshooting)
 */
export const troubleshootingModule: WidgetModule = {
  ...manifestMeta("troubleshooting"),
  render: (ctx) => {
    return (
      <TroubleshootingWidget
        activeResult={ctx.activeResult}
        query={ctx.activeResult?.query}
        isCompact={ctx.isCompact}
        actions={ctx.actions}
      />
    );
  }
};
