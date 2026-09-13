import { WidgetModule } from "../sdk/types.js";
import { MetricsTelemetryWidget } from "../components/MetricsTelemetryWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：指标遥测 (metrics_telemetry)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/metrics_telemetry.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：指标小卡 4 格 × 1:1 ≈ 365×365px，刚好容纳 2×2 度量网格。
 */
export const metricsTelemetryModule: WidgetModule = {
  ...manifestMeta("metrics_telemetry"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return <MetricsTelemetryWidget result={res} />;
  },
  // 背面已移除：原来的「端到端系统流遥测」是写死的假数据
  // （固定柱状图 / TTFT 280ms / -24% / 集群可用率 99.8%），与本机真实运行状态无关。
};
