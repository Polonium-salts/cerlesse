export interface TrendDataPoint {
  date: string;
  value: number;
  secondaryValue?: number;
  label?: string;
}

export interface TrendChartData {
  title: string;
  subtitle?: string;
  metricName: string;
  secondaryMetricName?: string;
  unit?: string;
  timeRange: string;
  currentValue: string;
  changeRate: string;
  isPositive: boolean;
  points: TrendDataPoint[];
  summaryNote?: string;
}
