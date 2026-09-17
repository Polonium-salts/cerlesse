/**
 * 尺寸决策引擎 (Widget Size Predictor)
 * 根据组件类型、信息量、内容重要度、优先级与当前屏幕栅格列数，动态计算卡片尺寸 (w, h)
 */

import { StandardWidget, WidgetSizeCategory, WidgetGridDimensions } from "./WidgetSchema.js";

/**
 * 默认基础尺寸映射表 (基于 12 列基准)
 */
export const BASE_SIZE_DIMENSIONS_12: Record<WidgetSizeCategory, WidgetGridDimensions> = {
  small:  { w: 3, h: 2, minW: 3, maxW: 4, minH: 2, maxH: 3 },  // 25% 紧凑磁贴
  medium: { w: 6, h: 3, minW: 4, maxW: 8, minH: 2, maxH: 5 },  // 50% 标准磁贴
  wide:   { w: 9, h: 3, minW: 6, maxW: 12, minH: 2, maxH: 4 }, // 75% 宽幅磁贴 (如图片画廊、长链接)
  tall:   { w: 4, h: 4, minW: 3, maxW: 6, minH: 3, maxH: 6 },  // 纵向磁贴 (如深潜大纲)
  large:  { w: 12, h: 4, minW: 6, maxW: 12, minH: 3, maxH: 6 },// 100% 主视区大卡片
  hero:   { w: 12, h: 5, minW: 8, maxW: 12, minH: 4, maxH: 7 } // 超大主焦点磁贴
};

/**
 * 8 列（平板）基础尺寸映射表
 */
export const BASE_SIZE_DIMENSIONS_8: Record<WidgetSizeCategory, WidgetGridDimensions> = {
  small:  { w: 2, h: 2, minW: 2, maxW: 4, minH: 2, maxH: 3 },
  medium: { w: 4, h: 3, minW: 3, maxW: 6, minH: 2, maxH: 4 },
  wide:   { w: 6, h: 3, minW: 4, maxW: 8, minH: 2, maxH: 4 },
  tall:   { w: 3, h: 4, minW: 2, maxW: 4, minH: 3, maxH: 5 },
  large:  { w: 8, h: 4, minW: 4, maxW: 8, minH: 3, maxH: 5 },
  hero:   { w: 8, h: 5, minW: 6, maxW: 8, minH: 4, maxH: 6 }
};

/**
 * 4 列（手机）基础尺寸映射表
 */
export const BASE_SIZE_DIMENSIONS_4: Record<WidgetSizeCategory, WidgetGridDimensions> = {
  small:  { w: 2, h: 2, minW: 2, maxW: 4, minH: 2, maxH: 3 },
  medium: { w: 4, h: 3, minW: 2, maxW: 4, minH: 2, maxH: 4 },
  wide:   { w: 4, h: 3, minW: 4, maxW: 4, minH: 2, maxH: 4 },
  tall:   { w: 2, h: 3, minW: 2, maxW: 4, minH: 2, maxH: 4 },
  large:  { w: 4, h: 4, minW: 4, maxW: 4, minH: 3, maxH: 5 },
  hero:   { w: 4, h: 4, minW: 4, maxW: 4, minH: 3, maxH: 5 }
};

/**
 * 根据小组件类型推导默认尺寸类别
 */
export function inferDefaultSizeCategory(type: string): WidgetSizeCategory {
  switch (type) {
    case "image_gallery":
    case "image":
      return "wide"; // 75% 宽幅展示
    case "token_usage":
    case "followup":
    case "metrics_telemetry":
    case "mobile_qr":
      return "small"; // 25% 紧凑小卡
    case "ai_overview":
    case "summary":
      return "large"; // 100% 全景研报
    case "search_engine":
    case "translation":
    case "ai_answer":
    case "sources":
    case "takeaways":
    case "related_links":
    case "analytics_trend":
    case "fast_chat":
    case "agent_workflow":
    default:
      return "medium"; // 50% 标准磁贴
  }
}

/**
 * 动态尺寸计算器 (Calculate Dynamic Widget Size)
 * 综合「内容重要性 + 信息量 + 交互复杂度 + 视觉占比」进行打分输出最佳 (w, h)
 */
export function calculateWidgetSize(
  widget: StandardWidget,
  totalColumns: number = 12,
  context?: {
    intent?: string;
    hasImages?: boolean;
    resultCount?: number;
    isPrimaryFocus?: boolean;
  }
): WidgetGridDimensions {
  // 1. 若外部已明确指定 customDimensions 则以自定义为主
  if (widget.customDimensions?.w && widget.customDimensions?.h) {
    const rawW = widget.customDimensions.w;
    const clampedW = Math.min(totalColumns, Math.max(1, rawW));
    return {
      w: clampedW,
      h: widget.customDimensions.h,
      minW: widget.customDimensions.minW || 1,
      maxW: widget.customDimensions.maxW || totalColumns,
      minH: widget.customDimensions.minH || 1,
      maxH: widget.customDimensions.maxH || 8
    };
  }

  // 2. 推断尺寸类别
  let category: WidgetSizeCategory = widget.size || inferDefaultSizeCategory(widget.type);

  // 3. 动态升级/降级判定 (基于优先级与重要性)
  if (context?.isPrimaryFocus || widget.priority >= 95) {
    if (category === "medium") category = "wide";
    else if (category === "wide") category = "large";
  } else if (widget.priority < 35 && category === "medium") {
    category = "small";
  }

  // 特例处理：图库严格固定 75% (12 列下的 9 格)
  if (widget.type === "image_gallery" && totalColumns === 12) {
    category = "wide";
  }

  // 4. 根据当前栅格列数 (12 / 8 / 4) 提取对应尺寸
  let dimTable: Record<WidgetSizeCategory, WidgetGridDimensions>;
  if (totalColumns <= 4) {
    dimTable = BASE_SIZE_DIMENSIONS_4;
  } else if (totalColumns <= 8) {
    dimTable = BASE_SIZE_DIMENSIONS_8;
  } else {
    dimTable = BASE_SIZE_DIMENSIONS_12;
  }

  const base = dimTable[category] || dimTable.medium;
  const w = Math.min(totalColumns, Math.max(1, base.w));

  return {
    w,
    h: base.h,
    minW: base.minW,
    maxW: base.maxW,
    minH: base.minH,
    maxH: base.maxH
  };
}
