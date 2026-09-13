import { WidgetModule } from "../sdk/types.js";
import { SourcesListWidget } from "../components/SourcesListWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：核验信源库 (sources)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/sources.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：信源条目必须够宽，否则被挤成两行截断。
 * 该比例历史上从 3:1 经 2:1 抬到 3:2 —— DOM 审计发现 2:1 在 6 格 ≈ 667px 宽下
 * 仅 334px 高，被迫缩到 0.62 下限仍溢出。
 */
export const sourcesModule: WidgetModule = {
  ...manifestMeta("sources"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <SourcesListWidget
        results={res.filteredResults}
        rawResultCount={res.rawResultCount}
        isCompact={ctx.isCompact}
        onOpenForgeModal={() => ctx.actions.openForgeModal?.()}
      />
    );
  }
};
