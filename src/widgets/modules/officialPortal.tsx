import { WidgetModule } from "../sdk/types.js";
import { OfficialPortalWidget } from "../components/OfficialPortalWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：官方直达认证 (official_portal)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/official_portal.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：底部带操作条的入口类，2:1 时末行会被裁掉，
 * 故按 DOM 审计抬到 3:2。
 *
 * isCompact 必须由这里传下去：组件虽有该入参，但宽度档位只有 ctx 知道
 * （medium 4 列 / large 6 列 / wide 8 列），不传就等于永远按宽档渲染 ——
 * 窄档下的身份区与动作条会被挤坏。
 */
export const officialPortalModule: WidgetModule = {
  ...manifestMeta("official_portal"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    const officialSite = res.filteredResults.find((r) => r.isOfficial);
    return (
      <OfficialPortalWidget
        query={res.query}
        officialWebsite={officialSite}
        rawResultCount={res.rawResultCount}
        filteredCount={res.filteredResults.length}
        isCompact={ctx.isCompact}
      />
    );
  }
};
