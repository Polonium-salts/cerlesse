import React from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { BarChart3 } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";

interface MetricsTelemetryWidgetProps {
  result: SearchSynthesisResult;
}

/**
 * 检索度量 (metrics_telemetry)
 *
 * shadcn/ui 重做要点：
 *   · 此前每格是一张"浅灰底 + 描边"的小卡片（卡片套卡片），
 *     现改为 shadcn Dashboard 经典 stat 网格 —— 单元格不套壳，
 *     只靠 text-xs muted 标签 + text-lg font-semibold tabular-nums 数值建立层级；
 *   · 保留四个**可回溯的真实数字**：合成耗时 / 核验信源 / 官方信源 / 推理模型，
 *     不引入任何编造指标。
 */
export const MetricsTelemetryWidget: React.FC<MetricsTelemetryWidgetProps> = ({ result }) => {
  const sources = result.filteredResults || [];
  const officialCount = sources.filter((s) => s.isOfficial).length;
  const latencySec = ((result.executionTimeMs || 0) / 1000).toFixed(2);
  const modelName = result.modelUsed.split("/").pop()?.replace(":free", "") || "";

  const stats: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: "合成耗时", value: `${latencySec}s`, mono: true },
    { label: "核验信源", value: `${sources.length} 篇`, mono: true },
    { label: "官方信源", value: `${officialCount} 篇`, mono: true },
    { label: "推理模型", value: modelName || "—" }
  ];

  return (
    <IOSWidget
      id="widget-metrics-telemetry"
      title="检索度量"
      icon={<BarChart3 className="size-4" />}
      className="w-full h-full"
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{stat.label}</span>
            <span
              className={`truncate text-lg font-semibold leading-none tracking-tight text-foreground ${
                stat.mono ? "font-mono tabular-nums" : ""
              }`}
              title={stat.value}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </IOSWidget>
  );
};
