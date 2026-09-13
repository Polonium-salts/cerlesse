/**
 * 小组件排版 Agent (Widget Layout Agent)
 * ============================================================
 * 专职职责：把「有哪些小组件」翻译成「它们如何占据 12 栅格桌面」。
 *
 * 与其它 Agent 的职责边界（互不重叠）：
 *   - 全网检索 Agent  -> 产出可信信源 (SearchResult[])
 *   - 小组件构建 Agent -> 产出组件能力规划 (WidgetPlan) 与独有卡片 (CustomCardData)
 *   - 小组件排版 Agent -> 产出排版决策 (WidgetLayoutDecision)：启停、阅读序、栅格跨度、视觉焦点、装箱补位
 *
 * 工作流（四相位）：
 *   相位 1  内容密度与意图信号建模
 *   相位 2  确定性装箱求解（能力驱动的排版先验基线，保证永不出错）
 *   相位 3  排版策略精修（大模型语义排序 + 硬约束校验，可降级）
 *   相位 4  决策固化（生成可直接渲染的 AdaptiveLayoutStrategy）
 *
 * 设计原则：LLM 只做「建议」，最终一定会经过确定性求解器与硬约束校验落地，
 * 因此无论有无 API Key、网络是否可用，排版 Agent 始终能给出合法可渲染的结果。
 */

import {
  ResultWidgetKey,
  SearchResult,
  WidgetPlan,
  WidgetLayoutDecision,
  AdaptiveLayoutStrategy,
  AgentPlan,
  ALL_RESULT_WIDGET_KEYS
} from "../src/types.js";
import { determineAdaptiveLayout, generatePlanForQuery } from "./agent.js";
import { detectQueryLanguage, resolveTargetLanguage } from "./language.js";
import { callOpenRouterChat } from "./openrouter.js";
import {
  calculateAdaptiveBinPacking,
  normalizeWidgetSpan,
  getWidgetLabel
} from "../src/lib/adaptiveLayout.js";
import {
  solveTileLayout,
  spanOfTileWidth,
  normalizeTileWidth,
  tileWidthFromSpan,
  DEFAULT_CONTAINER_WIDTH_PX,
  TILE_COLUMN_GAP_PX,
  TILE_ROW_GAP_PX,
  type TileWidth
} from "../src/lib/tileLayoutEngine.js";

/** 磁贴桌面（TileDesktopView）的基准栅格列数，排版预演与渲染必须使用同一口径 */
const LAYOUT_PREVIEW_COLUMNS = 12;

/** 排版 Agent 的对外身份标识 */
export const WIDGET_LAYOUT_AGENT_NAME = "小组件排版 Agent";

/**
 * 磁贴宽度档位 -> 12 栅格跨度（排版 Agent 的核心换算表）。
 * 全链路只有一套宽度词汇表（25 / 50 / 75 / 100），历史档位名由 normalizeTileWidth 兜底吸附。
 */
function widthToSpan(width: unknown): number | undefined {
  if (width === undefined || width === null || width === "") return undefined;
  return spanOfTileWidth(normalizeTileWidth(width as TileWidth | number | string), LAYOUT_PREVIEW_COLUMNS);
}

/** 排版 Agent 允许操作的小组件白名单（防止大模型臆造组件 ID） */
const LAYOUT_ALLOWED_KEYS: ResultWidgetKey[] = [...ALL_RESULT_WIDGET_KEYS];

export interface WidgetLayoutAgentOptions {
  query: string;
  results?: SearchResult[];
  /** 可选：主 Agent 的意图计划（不传则内部自建） */
  plan?: AgentPlan;
  /** 可选：小组件构建 Agent 的能力规划（传入即可让排版跟随真实尺寸意图） */
  widgetPlan?: WidgetPlan;
  targetLanguage?: string;
  apiKey?: string;
  model?: string;
  env?: Record<string, string | undefined>;
  /** 是否允许大模型做语义精修（默认开启，无 Key 时自动跳过） */
  enableLlmRefinement?: boolean;
  signals?: {
    comparisonCount?: number;
    mindMapBranches?: number;
    followUpCount?: number;
    /** 内容密度：决定 takeaways / topic_digest 是否有东西可渲染 */
    takeawayCount?: number;
    summaryLength?: number;
    /** 是否已锻造出独有卡片：custom_cards 的数据就绪条件 */
    hasCustomCards?: boolean;
    /** 可展示的图片数（图片检索产出 + 信源缩略图）：image_gallery 的数据就绪条件 */
    imageCount?: number;
  };
}

export interface WidgetLayoutAgentResult {
  decision: WidgetLayoutDecision;
  strategy: AdaptiveLayoutStrategy;
}

interface LlmLayoutSuggestion {
  order?: string[];
  emphasized?: string;
  spans?: Record<string, number>;
  reasoning?: string[];
}

/**
 * 相位 3：大模型语义精修
 * 仅在提供 API Key 时生效；任何解析/校验失败都返回 null，交由确定性求解器兜底。
 */
async function requestLlmLayoutRefinement(params: {
  query: string;
  intentLabel: string;
  enabledKeys: ResultWidgetKey[];
  emphasized: ResultWidgetKey;
  currentSpans: Partial<Record<ResultWidgetKey, number>>;
  targetLanguage: string;
  apiKey?: string;
  model?: string;
  env?: Record<string, string | undefined>;
}): Promise<LlmLayoutSuggestion | null> {
  const isEn = params.targetLanguage === "en";

  const catalog = params.enabledKeys
    .map((key) => `${key} (${getWidgetLabel(key)}) -> 当前跨度 ${params.currentSpans[key] ?? 6}`)
    .join("\n");

  const systemPrompt = `你是一位资深的信息布局排版专家 (Widget Layout Agent)。
你只负责决定小组件的【阅读顺序】【视觉焦点】和【12 栅格跨度】，绝不新增或删除任何组件。
硬约束：
1. order 必须是给定组件列表中元素的一个排列，不得增删、不得臆造 ID；
2. spans 的取值只能是 3 / 6 / 9 / 12（即宽度的 25% / 50% / 75% / 100%）；
3. 各组件跨度由插件清单声明，必须与上方列出的「当前跨度」完全一致，禁止放大或缩小；
4. 单行最多 4 个组件（3+3+3+3=12），避免出现大面积空白。

只输出 JSON，不要任何解释性文字，格式：
{"order":["key1","key2"],"emphasized":"key1","spans":{"key1":12,"key2":6},"reasoning":["依据1","依据2"]}`;

  const userPrompt = isEn
    ? `Task: "${params.query}"\nLayout intent: ${params.intentLabel}\nAvailable widgets:\n${catalog}\n\nProduce the optimal 12-column layout JSON.`
    : `用户任务：“${params.query}”\n排版意图：${params.intentLabel}\n可用组件清单：\n${catalog}\n\n请输出最优的 12 栅格排版 JSON。`;

  const raw = await callOpenRouterChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    model: params.model,
    apiKey: params.apiKey,
    env: params.env,
    responseFormatJson: true,
    timeoutMs: 2200,
    temperature: 0.1,
    maxTokens: 700
  });

  if (!raw) return null;

  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as LlmLayoutSuggestion;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 校验并合并大模型排版建议：以确定性结果为主体，LLM 只做合法范围内的重排与调宽。
 */
function mergeLlmSuggestion(
  suggestion: LlmLayoutSuggestion | null,
  base: {
    order: ResultWidgetKey[];
    emphasized: ResultWidgetKey;
    spans: Partial<Record<ResultWidgetKey, number>>;
  }
): {
  order: ResultWidgetKey[];
  emphasized: ResultWidgetKey;
  spans: Partial<Record<ResultWidgetKey, number>>;
  accepted: boolean;
  reasoning: string[];
} {
  if (!suggestion) {
    return { ...base, accepted: false, reasoning: [] };
  }

  const allowed = new Set(base.order.map(String));
  const validOrder: ResultWidgetKey[] = Array.isArray(suggestion.order)
    ? suggestion.order
        .map((k) => String(k))
        .filter((k, idx, arr) => arr.indexOf(k) === idx)          // 去重
        .filter((k) => allowed.has(k))                            // 阻断臆造 ID
        .filter((k) => LAYOUT_ALLOWED_KEYS.includes(k as ResultWidgetKey)) as ResultWidgetKey[]
    : [];

  // LLM 漏掉的组件必须补回，保证「一个都不丢」
  for (const key of base.order) {
    if (!validOrder.includes(key)) validOrder.push(key);
  }

  const mergedSpans: Partial<Record<ResultWidgetKey, number>> = { ...base.spans };
  if (suggestion.spans && typeof suggestion.spans === "object") {
    for (const [key, span] of Object.entries(suggestion.spans)) {
      if (!allowed.has(key)) continue;
      const numeric = Number(span);
      if (!Number.isFinite(numeric)) continue;
      // 只接受 3/6/9/12，其它值一律交给 normalizeWidgetSpan 吸附到最近合法跨度
      mergedSpans[key as ResultWidgetKey] = normalizeWidgetSpan(numeric);
    }
  }

  const emphasized = allowed.has(String(suggestion.emphasized))
    ? (String(suggestion.emphasized) as ResultWidgetKey)
    : base.emphasized;

  // 注意：焦点只决定阅读序与置顶地位，**不再提权宽度**。
  // 宽度由清单声明（25/50/75/100 四档）唯一决定；此前把焦点硬拉成 9/12 格，
  // 会让窄栏组件（如 related_links）被撑成半屏，破坏四档契约。

  const reasoning = Array.isArray(suggestion.reasoning)
    ? suggestion.reasoning.filter((r) => typeof r === "string" && r.trim() !== "").slice(0, 4)
    : [];

  const accepted = validOrder.length > 0;

  return {
    order: accepted ? validOrder : base.order,
    emphasized,
    spans: mergedSpans,
    accepted,
    reasoning
  };
}

/**
 * 小组件排版 Agent 主入口
 * 输入任务与组件清单，输出排版决策单与可直接渲染的排版策略。
 */
export async function planWidgetLayout(
  options: WidgetLayoutAgentOptions
): Promise<WidgetLayoutAgentResult> {
  const startTime = Date.now();
  const {
    query,
    results = [],
    widgetPlan,
    targetLanguage = "zh-CN",
    apiKey,
    model,
    env,
    enableLlmRefinement = true
  } = options;

  const isEn = targetLanguage === "en";
  const reasoning: string[] = [];

  // ---------------------------------------------------------------
  // 相位 1：内容密度与意图信号建模
  // ---------------------------------------------------------------
  const detectedLang = detectQueryLanguage(query);
  const targetLang = resolveTargetLanguage(targetLanguage, detectedLang);
  const plan: AgentPlan = options.plan || generatePlanForQuery(query, detectedLang, targetLang);

  const hasOfficial = results.some((r) => r.isOfficial);
  const comparisonCount = options.signals?.comparisonCount ?? 0;
  const mindMapBranches = options.signals?.mindMapBranches ?? 0;
  const followUpCount = options.signals?.followUpCount ?? 3;
  const takeawayCount = options.signals?.takeawayCount ?? 0;
  const summaryLength = options.signals?.summaryLength ?? 0;

  // ---------------------------------------------------------------
  // 相位 2：确定性装箱求解 —— 排版先验基线（永不失败的兜底）
  // ---------------------------------------------------------------
  const baseStrategy = determineAdaptiveLayout({
    query,
    plan,
    filteredResults: results,
    comparisonCount,
    mindMapBranches,
    followUpCount,
    hasOfficial,
    targetLanguage,
    widgetPlan,
    // 内容密度信号一路透传：启停裁决必须以真实产出为准，否则会出现空壳磁贴
    takeawayCount,
    summaryLength,
    hasCustomCards: options.signals?.hasCustomCards,
    // 图片就绪信号同理透传：排版 Agent 看不到 relatedImages，只能由调用方告知
    imageCount: options.signals?.imageCount
  });

  // 2.1 阅读主序：以基线启用集为基准，确保组件一个都不丢
  const enabledKeys: ResultWidgetKey[] = baseStrategy.enabledWidgets && baseStrategy.enabledWidgets.length > 0
    ? [...baseStrategy.enabledWidgets]
    : [...baseStrategy.componentOrder];

  const baseOrder: ResultWidgetKey[] = [
    ...baseStrategy.componentOrder.filter((k) => enabledKeys.includes(k)),
    ...enabledKeys.filter((k) => !baseStrategy.componentOrder.includes(k))
  ];
  let safeOrder = baseOrder.length > 0 ? baseOrder : [...enabledKeys];

  // 默认保持官网跳转组件在最上方
  if (safeOrder.includes("related_links")) {
    safeOrder = ["related_links", ...safeOrder.filter((k) => k !== "related_links")];
  }

  // 2.2 跨度求解：优先采纳小组件构建 Agent 的真实尺寸意图，其次回落基线栅格
  const plannedSpans: Partial<Record<ResultWidgetKey, number>> = {};
  if (widgetPlan?.widgets && Array.isArray(widgetPlan.widgets)) {
    for (const item of widgetPlan.widgets) {
      if (!item) continue;
      const key = (typeof item === "string" ? item : item.type) as ResultWidgetKey;
      const size = typeof item === "object" ? (item as any).size : undefined;
      const mapped = widthToSpan(size);
      if (key && mapped) plannedSpans[key] = mapped;
    }
  }

  const spans: Partial<Record<ResultWidgetKey, number>> = {};
  for (const key of safeOrder) {
    const preferred =
      plannedSpans[key] ??
      baseStrategy.customWidgetSpans?.[key] ??
      baseStrategy.gridConfig?.[key]?.colSpanLg ??
      widthToSpan(widgetPlan?.widgets?.find((w: any) => (typeof w === "string" ? w : w?.type) === key)?.size) ??
      (key === "related_links" ? spanOfTileWidth(50, LAYOUT_PREVIEW_COLUMNS) : 6);
    spans[key] = normalizeWidgetSpan(preferred);
  }

  // 官网跳转与 AI 智能回答都封顶半宽（50%），避免任一组件挤占整屏首屏。
  // 下限不做限制：窄于半宽由清单自身的 grid.width / minWidth 决定。
  const HALF_WIDTH_SPAN = spanOfTileWidth(50, LAYOUT_PREVIEW_COLUMNS);
  for (const key of ["related_links", "ai_answer"] as ResultWidgetKey[]) {
    const span = spans[key];
    if (span !== undefined && span > HALF_WIDTH_SPAN) {
      spans[key] = HALF_WIDTH_SPAN;
    }
  }

  // 视觉焦点仅决定阅读序（求解器会把它排在最前），宽度一律回归清单声明的四档。
  // related_links 是置顶焦点，但它的宽度就是清单里的 50%，不因焦点身份被额外撑宽 ——
  // 否则 6+6=12 的整行对齐会被打破。
  let emphasized: ResultWidgetKey = safeOrder.includes("related_links")
    ? "related_links"
    : (enabledKeys.includes(baseStrategy.emphasizedWidget) ? baseStrategy.emphasizedWidget : safeOrder[0]);

  // ---------------------------------------------------------------
  // 相位 3：大模型语义精修（可降级，不影响正确性）
  // ---------------------------------------------------------------
  let llmRefined = false;
  let modelUsed: string | undefined;
  if (enableLlmRefinement && safeOrder.length > 1) {
    const suggestion = await requestLlmLayoutRefinement({
      query,
      intentLabel: baseStrategy.intentLabel,
      enabledKeys: safeOrder,
      emphasized,
      currentSpans: spans,
      targetLanguage,
      apiKey,
      model,
      env
    });

    const merged = mergeLlmSuggestion(suggestion, {
      order: safeOrder,
      emphasized,
      spans
    });

    if (merged.accepted && suggestion) {
      llmRefined = true;
      modelUsed = model || "openrouter/free";
      reasoning.push(...merged.reasoning);
      safeOrder.splice(0, safeOrder.length, ...merged.order);
      emphasized = merged.emphasized;
      Object.keys(spans).forEach((k) => delete (spans as any)[k]);
      Object.assign(spans, merged.spans);
    }
  }

  // ---------------------------------------------------------------
  // 相位 4：装箱固化 —— 与渲染层同构的瀑布流错落预演（决策即渲染）
  // ---------------------------------------------------------------
  const packing = calculateAdaptiveBinPacking(safeOrder, {
    emphasizedWidget: emphasized,
    intentType: baseStrategy.intentType,
    customSpans: spans,
    enabledWidgets: safeOrder,
    autoFillGaps: true,
    autoFillMode: "dense"
  });

  // 4.1 用「磁贴桌面正在使用的那套求解器」把决策先跑一遍：
  //     这样决策单里报告的错落磁贴数、参差度、内部空洞数，与用户最终看到的画面完全一致，
  //     不会出现「Agent 说排成了错落磁贴墙，实际渲染却是一排排对齐的横条」这种口径不一致。
  const preview = solveTileLayout(
    safeOrder.map((key, index) => ({
      id: String(key),
      // 跨度 -> 宽度档位 -> 再回到跨度，保证与渲染层 tileWidthFromSpan 的口径严格一致
      size: (tileWidthFromSpan(spans[key]) ?? 50) as TileWidth,
      // 阅读序越靠前优先级越高；聚焦项由求解器自动前置
      priority: safeOrder.length - index,
      isEmphasized: key === emphasized
    })),
    {
      totalColumns: LAYOUT_PREVIEW_COLUMNS,
      containerWidth: DEFAULT_CONTAINER_WIDTH_PX,
      columnGap: TILE_COLUMN_GAP_PX,
      rowGap: TILE_ROW_GAP_PX
    }
  );

  const disabledWidgets = ALL_RESULT_WIDGET_KEYS.filter((k) => !safeOrder.includes(k));

  // 逐条沉淀可解释的排版决策依据
  reasoning.unshift(
    isEn
      ? `Layout intent resolved as [${baseStrategy.intentLabel}]; reading order derived from ${safeOrder.length} activated widgets.`
      : `任务排版意图判定为【${baseStrategy.intentLabel}】，已按能力相关度确定 ${safeOrder.length} 个组件的主阅读序。`
  );
  reasoning.push(
    isEn
      ? `Visual focus locked on "${getWidgetLabel(emphasized)}" (${spans[emphasized]}/12 grid span).`
      : `视觉焦点锁定「${getWidgetLabel(emphasized)}」并提权至 ${spans[emphasized]}/12 栅格跨度，确保首屏即重点。`
  );
  reasoning.push(
    isEn
      ? `${disabledWidgets.length} redundant widgets auto-slept to eliminate distraction.`
      : `自动休眠 ${disabledWidgets.length} 个与当前任务无关的冗余组件，保持桌面信息纯度。`
  );
  reasoning.push(
    isEn
      ? `Staggered-masonry packing preview: ${preview.staggeredCount}/${preview.items.length} tiles sit on their own top line (${preview.topLineCount} distinct top lines in total), leaving a ${Math.round(preview.raggednessPx)}px ragged bottom edge — the intended irregular tile-wall look.`
      : `瀑布流错落装箱预演：${preview.staggeredCount}/${preview.items.length} 张磁贴独占顶线（桌面共 ${preview.topLineCount} 条顶线），下沿呈 ${Math.round(preview.raggednessPx)}px 自然参差 —— 参差错落本身就是要的磁贴墙质感。`
  );
  reasoning.push(
    preview.gapCount > 0
      ? (isEn
        ? `${preview.gapCount} grid cell(s) remain as genuine interior blanks; no aspect ratio was ever stretched to fill them.`
        : `仅 ${preview.gapCount} 个栅格单元为真实内部空洞，且绝不为凑满而拉伸磁贴、破坏固有比例。`)
      : (isEn
        ? `Zero interior blanks — every slot was sealed by re-sinking a tile, not by distorting it.`
        : `内部零空洞 —— 所有缝隙均由磁贴重新落位闭合，而非拉伸磁贴。`)
  );
  if (preview.adjustedSpanCount > 0) {
    reasoning.push(
      isEn
        ? `${preview.adjustedSpanCount} tile(s) had their width nudged by one step to seal a slot too narrow for any tile's nominal width.`
        : `${preview.adjustedSpanCount} 张磁贴的宽度微调了一档，用于封住瀑布流里"塞不下任何磁贴名义宽度"的窄缝。`
    );
  }
  if (preview.columnHeights && preview.columnHeights.length > 0) {
    reasoning.push(
      isEn
        ? `Column depths (px): [${preview.columnHeights.map((h) => Math.round(h)).join(", ")}] — uneven depths are what produce the staggered rhythm.`
        : `各列深度(px)：[${preview.columnHeights.map((h) => Math.round(h)).join(", ")}] —— 列深不齐正是错落节奏的来源。`
    );
  }
  reasoning.push(
    llmRefined
      ? (isEn
        ? `Layout sequence semantically refined by LLM (${modelUsed}).`
        : `阅读序与大板块跨度已由大模型 (${modelUsed}) 语义精修，兼顾信息密度与视觉节奏。`)
      : (isEn
        ? `Deterministic capability packing applied (LLM refinement skipped or unavailable).`
        : `采用确定性能力装箱求解（大模型精修跳过或不可用），结果稳定可复现。`)
  );

  const executionTimeMs = Date.now() - startTime;

  const decision: WidgetLayoutDecision = {
    agentName: WIDGET_LAYOUT_AGENT_NAME,
    intentType: baseStrategy.intentType,
    intentLabel: baseStrategy.intentLabel,
    componentOrder: [...safeOrder],
    emphasizedWidget: emphasized,
    spans: { ...spans },
    enabledWidgets: [...safeOrder],
    disabledWidgets,
    reasoning,
    packingMethod: "agent-masonry",
    gridRows: preview.totalRows,
    raggednessPx: preview.raggednessPx,
    staggeredTiles: preview.staggeredCount,
    topLines: preview.topLineCount,
    adjustedSpans: preview.adjustedSpanCount,
    interiorGaps: preview.gapCount,
    modelUsed,
    llmRefined,
    executionTimeMs
  };

  const strategy: AdaptiveLayoutStrategy = {
    ...baseStrategy,
    intentType: baseStrategy.intentType,
    intentLabel: baseStrategy.intentLabel,
    explanation: isEn
      ? `Widget Layout Agent arranged ${safeOrder.length} widgets into a staggered masonry wall: focus on "${getWidgetLabel(emphasized)}", ${preview.staggeredCount} staggered tile(s), ${Math.round(preview.raggednessPx)}px ragged bottom edge, ${preview.gapCount} interior blank(s).`
      : `小组件排版 Agent 完成 12 栅格瀑布流错落编排：以「${getWidgetLabel(emphasized)}」为视觉焦点，共排布 ${safeOrder.length} 个小组件，${preview.staggeredCount} 张磁贴呈错落顶线，桌面下沿参差 ${Math.round(preview.raggednessPx)}px，内部空洞仅 ${preview.gapCount} 格。`,
    componentOrder: [...safeOrder],
    emphasizedWidget: emphasized,
    gridConfig: { ...baseStrategy.gridConfig, ...packing.gridConfig },
    totalRows: preview.totalRows,
    packingMethod: "semantic-css-grid",
    enabledWidgets: [...safeOrder],
    disabledWidgets,
    customWidgetSpans: { ...spans },
    // 瀑布流不会去"补满行带"——留白由错落自然吸收，强行 dense 补位只会把磁贴挤成对齐的横条
    autoFillGaps: false,
    autoFillMode: "off",
    filledGapsCount: preview.adjustedSpanCount,
    layoutAgentDecision: decision
  };

  return { decision, strategy };
}
