import { WidgetModule } from "../sdk/types.js";
import { KeyTakeawaysWidget } from "../components/KeyTakeawaysWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：核心要点清单 (takeaways)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/takeaways.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：要点清单：6 格 × 3:2 ≈ 615×410px。
 */
export const takeawaysModule: WidgetModule = {
  ...manifestMeta("takeaways"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <KeyTakeawaysWidget
        keyTakeaways={res.keyTakeaways}
        isCompact={ctx.isCompact}
      />
    );
  }
};
