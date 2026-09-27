import { WidgetModule } from "../sdk/types.js";
import { ActionsToolboxWidget } from "../components/ActionsToolboxWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：行动工具箱 (actions_toolbox)
 */
export const actionsToolboxModule: WidgetModule = {
  ...manifestMeta("actions_toolbox"),
  render: (ctx) => {
    return (
      <ActionsToolboxWidget
        activeResult={ctx.activeResult}
        query={ctx.activeResult?.query}
        isCompact={ctx.isCompact}
      />
    );
  }
};
