import { WidgetModule } from "../sdk/types.js";
import { AnalyticsTrendWidget } from "../components/AnalyticsTrendWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：信源相关度分布 (analytics_trend)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/analytics_trend.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：进度条列表，16:9 时末条会被裁切，故按 DOM 审计抬到 3:2。
 */
export const analyticsTrendModule: WidgetModule = {
  ...manifestMeta("analytics_trend"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return <AnalyticsTrendWidget result={res} />;
  }
};
