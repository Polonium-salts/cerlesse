/**
 * 统一磁贴与小组件标准 Schema (Unified Widget Schema)
 * 遵循「内容决策 + 尺寸决策 + 布局算法 + 渲染」四层分治原则
 */

export type WidgetType =
  | "search"
  | "search_engine"
  | "weather"
  | "translation"
  | "news"
  | "video"
  | "image"
  | "image_gallery"
  | "map"
  | "music"
  | "website"
  | "related_links"
  | "file"
  | "tool"
  | "text"
  | "ai_answer"
  | "takeaways"
  | "sources"
  | "token_usage"
  | "analytics_trend"
  | "topic_digest"
  | "fast_chat"
  | "followup"
  | "metrics_telemetry"
  | "mobile_qr"
  | "agent_workflow"
  | "ai_overview"
  | "custom";

export type WidgetSizeCategory =
  | "small"   // 1x1 / 3x2 (25% 紧凑磁贴)
  | "medium"  // 2x2 / 6x3 (50% 标准磁贴)
  | "wide"    // 4x1 / 8x2 / 9x3 (75% 横向磁贴)
  | "tall"    // 2x3 / 4x4 (垂直磁贴)
  | "large"   // 4x2 / 12x4 (100% 全景/大号主磁贴)
  | "hero";   // 焦点超大磁贴

export interface WidgetGridDimensions {
  w: number; // 占用栅格列数 (e.g. 3, 6, 9, 12 in 12-col grid)
  h: number; // 占用栅格行数 (e.g. 2, 3, 4)
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

export interface WidgetLayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
  pixelHeight?: number;
  isEmphasized?: boolean;
  score?: number;
}

export interface StandardWidget<T = unknown> {
  id: string;
  type: WidgetType | string;
  priority: number; // 0 - 100
  size?: WidgetSizeCategory;
  customDimensions?: Partial<WidgetGridDimensions>;
  data?: T;
  layout?: WidgetLayoutRect;
  preferredSide?: "left" | "right" | "center" | "auto";
  pinned?: boolean;
}

export interface LayoutEngineOptions {
  totalColumns: number; // 12 (Desktop), 8 (Tablet), 4 (Mobile)
  rowUnitPx?: number; // 默认 64px 基础行高或自适应
  gapPx?: number;     // 默认 16px
  allowSpanFlex?: boolean;
  enableInterleaving?: boolean;
  scoringWeights?: {
    compactness: number; // 默认 0.40
    priority: number;    // 默认 0.25
    alignment: number;   // 默认 0.15
    balance: number;     // 默认 0.10
    stability: number;   // 默认 0.10
  };
  previousLayout?: Map<string, WidgetLayoutRect>;
}

export interface LayoutEngineResult {
  items: Array<StandardWidget & { layout: WidgetLayoutRect }>;
  totalRows: number;
  totalColumns: number;
  compactnessScore: number;
  overallScore: number;
  wasteArea: number; // 空白网格单元数
}
