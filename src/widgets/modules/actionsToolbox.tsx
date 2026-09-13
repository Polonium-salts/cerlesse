import { WidgetModule } from "../sdk/types.js";
import { ActionPlanWidget } from "../components/ActionPlanWidget.js";
import { QuickActionsToolboxWidget } from "../components/QuickActionsToolboxWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：行动工具箱 (actions_toolbox)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/actions_toolbox.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：单行命令很长，需要方正区域完整展示，6 格 × 1:1 ≈ 615×615px。
 * 该清单还额外声明了 minSpan: 4 —— 命令块宁可旁边留空洞，也不许被收窄到 4 列以下。
 */
export const actionsToolboxModule: WidgetModule = {
  ...manifestMeta("actions_toolbox"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    if (res.actionPlan && res.actionPlan.tasks && res.actionPlan.tasks.length > 0) {
      return (
        <ActionPlanWidget
          actionPlan={res.actionPlan}
          query={res.query}
          isCompact={ctx.isCompact}
        />
      );
    }
    return (
      <QuickActionsToolboxWidget
        result={res}
        onOpenForgeModal={() => ctx.actions.openForgeModal?.()}
      />
    );
  }
  // 背面已移除：它只是把正面的两个动作又抄了一遍（且本模块从未登记 actions，
  // 背面按钮实际点不动），外加一句"支持转存 PDF"的说明文字。
};
