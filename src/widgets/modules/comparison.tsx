import { WidgetModule } from "../sdk/types.js";
import { ComparisonMatrixWidget } from "../components/ComparisonMatrixWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：多维对比矩阵 (comparison)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/comparison.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：矩阵需要横向铺陈承载多列观点，8 格 × 16:9 ≈ 830×467px。
 */
export const comparisonModule: WidgetModule = {
  ...manifestMeta("comparison"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <ComparisonMatrixWidget
        comparisonTable={res.comparisonTable}
        query={res.query}
      />
    );
  }
};
