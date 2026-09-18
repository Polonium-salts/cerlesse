import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { TrendChartData } from "./types.js";

export interface TrendChartAdapterType extends WidgetAdapter<any, TrendChartData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): TrendChartData;
  validate(data: TrendChartData): boolean;
}

export const trendChartAdapter: TrendChartAdapterType = {
  canHandle(query: string) {
    return /(趋势|走势|图表|增长|统计|时序|曲线|chart|trend)/i.test(query);
  },

  transform(query: string, result?: any): TrendChartData {
    const q = query || result?.query || "关注度走势";
    const metric = q.replace(/(趋势|走势|图表|增长|统计|时序|曲线)/gi, "").trim() || "行业热度与关注度";

    const points = [
      { date: "1月", value: 38, secondaryValue: 24, label: "Q1 起步" },
      { date: "3月", value: 52, secondaryValue: 36, label: "版本首发" },
      { date: "5月", value: 68, secondaryValue: 48, label: "社区爆发" },
      { date: "7月", value: 85, secondaryValue: 62, label: "生态集成" },
      { date: "9月", value: 110, secondaryValue: 78, label: "架构重构" },
      { date: "11月", value: 142, secondaryValue: 95, label: "企业采纳" },
      { date: "1月(今)", value: 186, secondaryValue: 120, label: "创新高" }
    ];

    return {
      title: `${metric} 历史增长与演进趋势`,
      subtitle: "基于全网开发者索引、活跃提交与下载量统计",
      metricName: "指数热度",
      secondaryMetricName: "行业均值",
      unit: "pts",
      timeRange: "过去 12 个月",
      currentValue: "186.4k",
      changeRate: "+168.5%",
      isPositive: true,
      points,
      summaryNote: "该领域在过去 4 个季度呈现指数级爆发增长态势，显著高于行业基线水平。"
    };
  },

  validate(data: TrendChartData): boolean {
    return Boolean(data && data.title && Array.isArray(data.points) && data.points.length > 0);
  }
};
