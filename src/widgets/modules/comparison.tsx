import { WidgetModule } from "../sdk/types.js";
import { ComparisonWidget } from "../components/ComparisonWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：多维对比评测矩阵 (comparison)
 */
export const comparisonModule: WidgetModule = {
  ...manifestMeta("comparison"),
  render: (ctx) => {
    return (
      <ComparisonWidget
        activeResult={ctx.activeResult}
        query={ctx.activeResult?.query}
        isCompact={ctx.isCompact}
      />
    );
  }
};
