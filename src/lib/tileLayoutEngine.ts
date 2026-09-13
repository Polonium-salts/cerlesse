/**
 * TileLayoutEngine v3 —— 不规则磁贴墙（瀑布流错落装箱）
 *
 * 设计契约：
 * 1. 宽高比是「小组件自身的固有属性」，只能从 RATIO_VALUES 目录中取值
 *    (1:1 / 4:3 / 3:2 / 16:9 / 2:1 / 3:1 / 4:5)，一经定义即不随任何条件改变；
 * 2. 宽度四档 TileWidth (25/50/75/100%) 只决定「占列宽度」，基准高度由 width / ratio 推导；
 * 3. 比例是「形状下限」而不是上限 —— 内容量是每次检索都不同的动态量，任何固定
 *    比例都无法保证"加载完整"。渲染层实测出内容自然高度后经 contentHeightPx
 *    回灌，磁贴即为内容让高（见 TILE_CONTENT_MAX_HEIGHT_PX）；
 * 4. 装箱采用「瀑布流错落（Staggered Masonry）」策略：每张磁贴落入当前最低的列区间，
 *    顶部不再逐行对齐 —— 桌面自然呈现参差错落的磁贴墙质感；
 * 5. 内容区一律 overflow:hidden，组件在自身区域内一次性完整呈现，不产生滚动。
 *
 * ── 为什么从「行带对齐」改为「瀑布流错落」──────────────────────────────
 * v2 曾以「零留白 + 同行共顶线」为最高目标，并因此在代码里主动否决瀑布流。
 * 但那样得到的是一张规整的表格：所有磁贴被压成等高的横条，桌面失去节奏与个性。
 * 本项目的视觉主张是「不规则」——错落本身就是美学：
 *   · 顶端参差：磁贴各自落在自己列区间的最低点，顶边不再共享基准线；
 *   · 底端参差：桌面下沿保持自然的起伏，不被强行削平成一条直线；
 *   · 形状混搭：宽高比目录刻意拉开「全景条 / 扁条 / 宽银幕 / 标准 / 方正 / 高瘦」六档，
 *     使同一列上的磁贴高度天然不同，错落因此不会退化成整齐的三列瀑布流。
 * 约束仍然严格：绝不重叠、宽度不越界、比例像素级精确。
 */

// 网格比例的来源 —— 官方小组件的宽高比一律写在各插件清单里
// （src/widgets/manifests/<id>.json 的 grid.ratio），本文件只负责派生。
//
// 依赖方向：本文件在运行时值依赖 manifests/index，而 manifests/index 对本文件
// 只有 `import type`（编译后擦除），因此不构成运行时循环。
import { MANIFEST_RATIOS } from "../widgets/manifests/index.js";

// ==========================================
// 1. 固定宽高比目录（单一事实来源）
// ==========================================

/** 允许的固定宽高比（宽 : 高） */
export type TileRatio = "1:1" | "4:3" | "3:2" | "16:9" | "2:1" | "3:1" | "4:5";

/** 比例的数值表示（width / height），布局计算与 CSS aspect-ratio 共用 */
export const RATIO_VALUES: Record<TileRatio, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
  "2:1": 2,
  "3:1": 3,
  "4:5": 4 / 5
};

/** CSS aspect-ratio 字面量 */
export const RATIO_CSS: Record<TileRatio, string> = {
  "1:1": "1 / 1",
  "4:3": "4 / 3",
  "3:2": "3 / 2",
  "16:9": "16 / 9",
  "2:1": "2 / 1",
  "3:1": "3 / 1",
  "4:5": "4 / 5"
};

export const RATIO_LABELS: Record<TileRatio, string> = {
  "1:1": "1:1 方正",
  "4:3": "4:3 标准",
  "3:2": "3:2 横向",
  "16:9": "16:9 宽银幕",
  "2:1": "2:1 扁横条",
  "3:1": "3:1 全景条",
  "4:5": "4:5 高瘦条"
};

/**
 * 每个官方小组件的固定宽高比 —— 同时承载「形状语汇」，而不只是尺寸。
 *
 * ⚠️ 具体比例已迁移至插件清单：唯一事实来源是
 *    src/widgets/manifests/<id>.json 的 `grid.ratio`，下表由 MANIFEST_RATIOS 派生。
 *    以下论证是迁移前的选型记录，保留用于回答"为什么是这个形状"。
 *
 * 选型原则（两条同时满足）：
 *   a. 与该组件默认宽度组合后，高度落在 200 ~ 400px 的舒适阅读区间；
 *   b. 六档形状在目录里都有 representative，让桌面天然具备形状反差 ——
 *      这正是「不规则磁贴墙」的视觉来源。若所有组件都是 2:1，无论装箱多错落，
 *      看起来仍是一叠等高的横条。
 *
 * 相对 v2 的调整全部是「变高不变矮」（更从容，不存在内容被挤扁的风险）：
 *   takeaways 2:1→3:2、comparison 3:1→16:9、mindmap 2:1→4:3、actions_toolbox 2:1→1:1、
 *   topic_digest 2:1→3:2、verification_checklist 2:1→1:1、ai_overview 16:9→4:3、
 *   fast_chat / followup 1:1→4:5。
 *
 * v4（浏览器实测校准）：把「内容自然高度 > 磁贴可用高度」的组件逐张抬高一档。
 * 判定依据是 DOM 审计 —— 逐个文本节点统计其可见矩形与磁贴裁剪框的交集比，
 * 下列 5 个组件都出现了交集比为 0 的整段文字不可见，故抬高一档：
 *   sources 3:1→2:1→3:2、official_portal 2:1→3:2、agent_workflow 2:1→3:2、
 *   analytics_trend 16:9→3:2、topic_digest 3:2→4:3。
 * 同样遵循「变高不变矮」：只增加高度，不同时牺牲宽度。
 */
export const WIDGET_RATIOS: Record<string, TileRatio> = {
  // —— 官方小组件：比例全部来自插件清单的 grid.ratio 字段。
  //    要改某个磁贴的形状，请编辑 src/widgets/manifests/<id>.json，不要在
  //    这里加特例 —— 那会让"清单外的隐藏比例"重新出现，两边迟早失配。
  ...MANIFEST_RATIOS,
  // —— 非官方插件：用户自定义卡片容器没有清单，比例仍由布局引擎本地维护
  custom_cards: "4:3"
};

/** 自定义卡片原型 -> 固定宽高比（AI 锻造的独有卡片按其原型定型） */
export const ARCHETYPE_RATIOS: Record<string, TileRatio> = {
  download_hub: "4:5",
  timeline: "2:1",
  parameter_matrix: "16:9",
  tool_discovery: "16:9",
  travel_itinerary: "4:3",
  action_checklist: "4:5",
  verdict_summary: "2:1",
  pros_cons: "4:3",
  quote_dossier: "3:1",
  schema: "4:3"
};

export const DEFAULT_TILE_RATIO: TileRatio = "4:3";

/**
 * 解析某个磁贴的固定宽高比。
 * @param widgetId 小组件 ID（支持 custom_card__xxx 形式）
 * @param explicitRatio 自定义卡片等无法从 ID 推断时的显式比例
 */
export function resolveTileRatio(widgetId: string, explicitRatio?: TileRatio): TileRatio {
  if (explicitRatio && RATIO_VALUES[explicitRatio]) return explicitRatio;
  if (widgetId && WIDGET_RATIOS[widgetId]) return WIDGET_RATIOS[widgetId];
  return DEFAULT_TILE_RATIO;
}

// ==========================================
// 2. 宽度四档 = 唯一的宽度词汇表
// ==========================================
//
// 全链路（插件清单 grid.width → 小组件构建 Agent → 小组件排版 Agent 跨度 →
// 瀑布流求解器 → 磁贴渲染）只承认四个宽度：25% / 50% / 75% / 100%。
// 换算出 12 栅格下的 3 / 6 / 9 / 12 列。
//
// ── 为什么必须收敛成一套 ──────────────────────────────────────────────
// 改造前存在三套同名不同义的档位词汇表：
//   · 磁贴口径 TileSize   ：small=2列 / medium=4列 / large=6列 / wide=8列 / full=12列
//   · 规划口径 WidgetPlannedSize：small=4列 / medium=6列 / large=8列 / full=12列
//   · 语义口径 WidgetSemanticWidth：compact=4列 / half=6列 / wide=8列 / full=12列
// "large" 在磁贴口径是 6 列、在规划口径却是 8 列；跨层强转必然整体缩水一档，
// 表现为内容被挤压换行、命令与表格被裁切。现在只剩一个数字类型，歧义从类型层消失。

/** 磁贴宽度：占整行（12 栅格）的百分比，只允许 25 / 50 / 75 / 100 四档。 */
export type TileWidth = 25 | 50 | 75 | 100;

/** 宽度四档全集（从小到大） */
export const TILE_WIDTHS: readonly TileWidth[] = [25, 50, 75, 100];

/**
 * 宽度 → 占整行的比例（12 栅格基准）。
 * 高度不再由宽度决定 —— 它恒等于 宽度 / 该组件的固定宽高比。
 */
export const TILE_WIDTH_FRACTION: Record<TileWidth, number> = {
  25: 3 / 12,
  50: 6 / 12,
  75: 9 / 12,
  100: 12 / 12
};

/** 宽度的界面标签 */
export const TILE_WIDTH_LABELS: Record<TileWidth, string> = {
  25: "25%",
  50: "50%",
  75: "75%",
  100: "100%"
};

/** 可供用户选择的宽度档位（四档均可选） */
export const SELECTABLE_TILE_WIDTHS: TileWidth[] = [25, 50, 75, 100];

/** 依据宽度与当前列数解算列跨度 */
export function spanOfTileWidth(width: TileWidth, totalColumns: number = 12): number {
  const fraction = TILE_WIDTH_FRACTION[width] ?? TILE_WIDTH_FRACTION[50];
  const cols = Math.max(1, totalColumns);
  const raw = Math.round(fraction * cols);
  // 最窄不低于 2 列，保证窄屏下内容仍有可用宽度
  return Math.max(2, Math.min(cols, raw));
}

/**
 * 列跨度 -> 宽度（按最近一档吸附）。
 * 求解器可能为闭合空洞把跨度微调一档，磁贴宽度必须跟着真实跨度走，
 * 否则组件会按错误的宽度渲染内部排版。
 * @returns 无法识别时返回 null，交由调用方回退到其它宽度来源
 */
export function tileWidthFromSpan(span?: number | null): TileWidth | null {
  if (span === undefined || span === null || !Number.isFinite(span)) return null;
  if (span >= 10.5) return 100;
  if (span >= 7.5) return 75;
  if (span >= 4.5) return 50;
  if (span >= 1) return 25;
  return null;
}

/** 历史磁贴档位名（TileSize 口径）-> 四档宽度 */
const LEGACY_TILE_SIZE_NAMES: Record<string, TileWidth> = {
  small: 25,  // 2 列
  medium: 25, // 4 列 -> 就近跌入 25%
  tall: 25,   // 4 列
  large: 50,  // 6 列
  wide: 75,   // 8 列
  full: 100   // 12 列
};

/** 历史语义宽度名（WidgetSemanticWidth 口径）-> 四档宽度 */
const SEMANTIC_WIDTH_NAMES: Record<string, TileWidth> = {
  compact: 25,
  small: 25,
  medium: 50,
  half: 50,
  large: 75,
  wide: 75,
  full: 100
};

/**
 * 归一化任意历史宽度表示 -> 四档宽度。
 *
 * 收四类输入：
 *   1. 四档本身（25 / 50 / 75 / 100，数值或 "50%" 字符串）；
 *   2. 历史档位名（磁贴口径 small/medium/large/wide/full/tall，语义口径 half/compact）；
 *   3. 历史列跨度（2 / 4 / 6 / 8 / 12）—— 按最近一档吸附；
 *   4. 缺省 / 无法识别 -> 50（半宽）。
 *
 * 用途：localStorage 里已保存的用户宽度、旧清单、动态卡片等历史数据在读取时统一收敛，
 * 不必再保留第二套词汇表。
 */
export function normalizeTileWidth(input: TileWidth | number | string | null | undefined): TileWidth {
  if (input === undefined || input === null) return 50;

  if (typeof input === "number") {
    if (!Number.isFinite(input)) return 50;
    // 数值 >= 20 视为百分比口径；更小的值只可能是历史列跨度口径
    if (input >= 20) return TILE_WIDTHS.reduce(
      (best, w) => (Math.abs(w - input) < Math.abs(best - input) ? w : best),
      50 as TileWidth
    );
    return tileWidthFromSpan(input) ?? 50;
  }

  const key = String(input).trim().toLowerCase();
  if (key === "") return 50;
  if (/^\d+(\.\d+)?%?$/.test(key)) return normalizeTileWidth(parseFloat(key));
  return LEGACY_TILE_SIZE_NAMES[key] ?? SEMANTIC_WIDTH_NAMES[key] ?? 50;
}

/**
 * 规划口径尺寸名 -> 四档宽度（兼容历史 widgetPlan 数据）。
 *
 * ⚠️ 规划口径的 "large" = 8 列（75%），与磁贴口径的 "large" = 6 列（50%）**不同义**。
 * 这是两套词汇表唯一无法靠名字区分的地方，故单独保留一张映射表。
 * 新建的 widgetPlan 一律直接输出四档数字，此函数只为读取历史数据而存在。
 */
export function tileWidthFromPlannedSize(planned?: string | number | null): TileWidth | null {
  if (planned === undefined || planned === null) return null;
  if (typeof planned === "number") return tileWidthFromSpan(planned);
  switch (String(planned).trim().toLowerCase()) {
    case "small":
      return 25;
    case "medium":
    case "wide":
      return 50;
    case "large":
    case "tall":
      return 75;
    case "full":
      return 100;
    default:
      return null;
  }
}

// ==========================================
// 3. 布局求解（瀑布流错落装箱 Staggered Masonry Packing）
// ==========================================

/** 列间距（水平），与容器 columnGap 严格一致 */
export const TILE_COLUMN_GAP_PX = 18;
/** 行间距（垂直），由装箱算法自行留白，容器 rowGap 必须为 0 */
export const TILE_ROW_GAP_PX = 18;
/** 栅格行粒度：越小定位越精确（4px 时误差不超过 ±2px） */
export const TILE_ROW_UNIT_PX = 4;
/** 未测量到容器宽度时的估算基准 */
export const DEFAULT_CONTAINER_WIDTH_PX = 1280;

/**
 * 跨度弹性档数：允许求解器在「可拼接跨度」数列上向两侧探几档。
 * 瀑布流里的空洞来自「剩余宽度塞不下任何待排磁贴」，此时让磁贴换一个相邻档位的宽度
 * 去闭合，观感远好于留一个洞。取 1 档（即相邻档位）—— 再远就会让组件按错误的
 * 宽度档位渲染内部排版。
 */
export const TILE_SPAN_FLEX = 1;

/**
 * 可拼接跨度目录：只有这些宽度能互相拼满整行。
 *   3+9 / 6+6 / 3+3+6 / 3+3+3+3 / 12 —— 都能刚好凑满 12 列。
 * 反过来，诸如 5 或 10 这种宽度会稳定留下窄缝，任何磁贴都塞不进去，
 * 于是变成永远无法闭合的空洞。因此求解器（含高度护栏）只在目录内取值。
 */
export function tileableSpans(totalColumns: number): number[] {
  const set = new Set<number>();
  for (const width of SELECTABLE_TILE_WIDTHS) set.add(spanOfTileWidth(width, totalColumns));
  return [...set].sort((a, b) => a - b);
}

/**
 * 跨度偏离的代价（像素 / 列）。求解器总成本 = 落点高度 + 偏离列数 × 本值。
 *
 * 取值偏小（20px）是实测结论：瀑布流里最难闭合的不是"高差"而是"窄缝"——
 * 某处只剩 2~6 列宽的空槽，而下一张待排磁贴名义跨度是 4/6/8，塞不进去就留洞。
 * 惩罚偏高时，求解器宁可把磁贴丢到下方也不愿收窄去填槽，空洞率随之恶化：
 *
 *   惩罚值   场景A 空洞率   场景C 空洞率
 *   90       12.00%        7.44%
 *   45        7.23%        8.36%
 *   20        5.65%        4.62%
 *
 * 20px 意味着「只要收窄 1 列能少浪费 20px 垂直空间就值得」，
 * 让"填窄缝"成为常规手段，同时仍不足以让求解器随意推翻排版 Agent 的宽度决策
 * （实测跨度微调仅 3~5 张，不会大面积改动）。
 */
export const TILE_SPAN_DEVIATION_PENALTY_PX = 20;

/**
 * 磁贴高度的合理区间（像素）。
 *
 * 这不是审美偏好，而是几何护栏：高度 = 宽度 / 固有比例，因此「12 列跨度 + 4:5 比例」
 * 会算出 1379px 的高墙，「2 列跨度 + 3:1」只有 65px 的细缝 —— 两者都不可用。
 * 求解器会把落在区间外的磁贴的跨度收缩/扩张到区间边缘最接近的档位，
 * 并如实记入 adjustedSpanCount。
 */
export const TILE_MIN_HEIGHT_PX = 168;
/**
 * 磁贴高度上限。720 是二维参数扫描（高度上限 × 跨度惩罚）得到的稳健解：
 * 既不允许"12 列 × 4:5 = 1600px"这类荒谬高墙，又不会把全宽磁贴压得过窄
 * 而在顶端留下大片空洞。两个典型场景实测（参差度 / 空洞率）：
 *
 *   上限   场景A（两张全宽）      场景C（单焦点全宽）
 *   560   参差 334 / 空洞 9.72%   参差 394 / 空洞 3.81%
 *   620   参差 334 / 空洞 9.72%   参差 394 / 空洞 3.81%
 *   720   参差 334 / 空洞 5.65%   参差 171 / 空洞 4.62%
 *   960   参差  98 / 空洞 4.09%   参差 445 / 空洞 4.06%
 *
 * 720 是唯一让两个场景的空洞率都守在 6% 以内的档位；960 虽也安全，但会把
 * 全宽焦点磁贴放任到 960px（超过一屏），且让桌面下沿趋于削平（参差仅 98px），
 * 背离"不规则"的视觉主张。
 */
export const TILE_MAX_HEIGHT_PX = 720;

/**
 * 护栏的换算比率：收窄/放宽 1 列，相当于容忍多少 px 的高度越界。
 *
 * 护栏若死守上限会出现"断崖式降级"：4:5 的磁贴在 6 列时高 789px，
 * 仅比上限高 69px，却被砍到 4 列（少 2 列宽，高度只剩 519px）。
 * 69px 的溢出换来 2 列宽度损失并不划算。因此这里把「高度越界(px)」与
 * 「宽度偏离(列 × 本值)」放在同一量纲相加，让轻微越界可以胜出：
 *
 *   4:5 × 12列候选     高度      越界    宽度代价   总代价
 *   6 列              789px     69      2×40=80     149   ← 选中
 *   4 列              519px      0      4×40=160    160
 *
 * 代价：极少数高瘦磁贴会比目标上限高一些（实测最大约 880px），换取宽度不被粗暴砍掉。
 */
export const TILE_SPAN_TRADEOFF_PX = 40;

/**
 * 护栏的实际硬上限。目标上限是 TILE_MAX_HEIGHT_PX，但为规避宽度断崖式降级，
 * 允许一定的越界（上界 ≈ 一次 ±TILE_SPAN_FLEX 档位的取舍量）。
 */
export const TILE_HARD_MAX_HEIGHT_PX = 880;

/**
 * 内容定高的上限（像素）。
 *
 * 磁贴为内容让高，但也不能无限长：没有上限时，一份长研报能把单张磁贴拉到数千像素，
 * 整面墙的节奏被一张卡吃干。1400 是"一屏半"的量级 —— 足够容纳任何正常小组件的
 * 完整内容（实测最长的 AI 研报约 1100px），又不至于让桌面退化成一条竖带。
 * 触及上限的极少数情况仍由 IOSWidget 的底部渐隐提示"还有更多"。
 */
export const TILE_CONTENT_MAX_HEIGHT_PX = 1400;

/**
 * 摆放顺序策略。
 *  - "reading"（默认）：严格遵循排版 Agent 的阅读序，宽窄磁贴混着落位
 *  - "anchor"        ：聚焦磁贴先行，其余按名义跨度降序（大块先当锚点，小块随后填缝）
 *
 * 两者实测（1280px / 12 列 / 11 张磁贴）：
 *
 *   策略      空洞率   参差度   错落磁贴   顶线数
 *   reading   4.76%   586px    7/11      9 条
 *   anchor    4.40%   264px    3/11      7 条
 *
 * anchor 用"大块先落位"换来了更少的空洞，但代价是宽磁贴率先占满整行、
 * 相互叠成规整的水平带 —— 桌面重新变得工整，恰好背离本项目的视觉主张。
 * reading 的密度只差 0.36 个百分点，不规则度却是 anchor 的两倍以上。
 * 既然「不规则」是第一优先级，就选 reading，顺带也完整保留了排版 Agent 的阅读序决策。
 */
export type TilePlacementOrder = "reading" | "anchor";

export interface TileLayoutInput {
  id: string;
  size: TileWidth;
  /** 显式指定比例（自定义卡片等无法从 ID 推断的场景） */
  ratio?: TileRatio;
  priority?: number;
  isEmphasized?: boolean;
  x?: number;
  y?: number;
  fixedPosition?: boolean;
  /**
   * 允许的最小列跨度。
   *
   * 求解器的跨度弹性（±TILE_SPAN_FLEX 档）本意是闭合窄缝，但对内容密集的组件
   * （命令清单、表格、高瘦卡片）来说，为了填一个 2 列窄缝而把 4 列压成 2 列，
   * 只会让内容被挤到换行甚至裁切。声明 minSpan 即表示"宁可有洞，也不许压这么窄"。
   */
  minSpan?: number;
  /**
   * 内容实测所需高度（像素）。渲染层量出组件内容的自然高度后回灌到这里，
   * 磁贴高度取「比例高度」与此值的较大者 —— 这就是"比例 = 形状下限"的落地点。
   * 未提供时按清单比例推导（首帧即如此），因此它的存在与否不改变其它任何逻辑。
   */
  contentHeightPx?: number;
  /**
   * contentHeightPx 的测量列跨度。
   *
   * 内容高度只在「同一宽度」下成立：换行位置一变，高度立刻失效。
   * 因此实测过的磁贴会锁定测量时的跨度，不再参与窄缝闭合的 ±1 档微调
   * （宁愿留一个洞，也不能让实测高度对应到错误的宽度上）。
   */
  contentSpan?: number;
}

export interface TileLayoutOptions {
  totalColumns?: number;
  containerWidth?: number;
  columnGap?: number;
  rowGap?: number;
  /** 是否允许求解器在 ±TILE_SPAN_FLEX 内微调跨度以闭合空洞（默认开启） */
  allowSpanFlex?: boolean;
  /** 摆放顺序策略，默认 "anchor"（大块先落位，空洞最少） */
  placementOrder?: TilePlacementOrder;
  /** 是否启用磁贴高度合理区间护栏（默认开启） */
  clampToHeightBand?: boolean;
  /** 磁贴高度上限（像素），默认 TILE_MAX_HEIGHT_PX。视口偏矮时可由调用方压低 */
  maxTileHeightPx?: number;
  /** 磁贴高度下限（像素），默认 TILE_MIN_HEIGHT_PX */
  minTileHeightPx?: number;
  /** 跨度偏离代价（像素/列），默认 TILE_SPAN_DEVIATION_PENALTY_PX */
  spanDeviationPenaltyPx?: number;
}

export interface SolvedTileItem {
  id: string;
  size: TileWidth;
  ratio: TileRatio;
  /** 起始列（0-indexed） */
  x: number;
  /** 顶部像素偏移 */
  y: number;
  /** 列跨度 */
  w: number;
  /** 磁贴像素高度（= 像素宽度 / 比例值） */
  h: number;
  pixelWidth: number;
  pixelHeight: number;
  isEmphasized?: boolean;
  priority: number;
  /** 求解器为闭合空洞而偏离了名义跨度的量（0 = 完全遵循排版 Agent 决策） */
  spanDeviation?: number;
  gridStyle: {
    gridColumn: string;
    gridRow: string;
    /** 交由 CSS 精确锁定比例 */
    aspectRatio: string;
  };
}

export interface TileLayoutSolution {
  items: SolvedTileItem[];
  totalColumns: number;
  totalRows: number;
  totalHeightPx: number;
  /** 各列最终高度（像素）—— 错落结构最直接的刻画 */
  columnHeights: number[];
  /** 参差度：最高列与最低列的高度差，即桌面下沿的起伏高度 */
  raggednessPx: number;
  /** 顶边落在独占水平线上的磁贴数（越多越"不规则"；0 表示完全逐行对齐） */
  staggeredCount: number;
  /** 实际用到的不同顶线数量 */
  topLineCount: number;
  /** 桌面填充率 = 磁贴总面积 / 包围盒面积（1 = 严丝合缝） */
  fillRatio: number;
  /** 为闭合空洞而微调过跨度的磁贴数（0 = 完全遵循排版 Agent 决策） */
  adjustedSpanCount: number;
  /** 装箱后仍如实留白的单元格数 */
  gapCount: number;
}

/**
 * 将「实际占位列跨度」回译为最接近的宽度档位。
 * 跨度微调可能把某个磁贴增减一档，宽度必须跟着真实跨度走，
 * 否则组件会按错误的宽度渲染内部排版（例如实际宽度已 9 列却仍按 3 列排版）。
 */
function widthForSpan(span: number, totalColumns: number): TileWidth {
  let best: TileWidth = 50;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const candidate of SELECTABLE_TILE_WIDTHS) {
    const diff = Math.abs(spanOfTileWidth(candidate, totalColumns) - span);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
}

/** 栅格几何：把列数 / 容器宽度换算成像素尺度（求解与反解共用同一套公式） */
function resolveGeometry(options: TileLayoutOptions) {
  const totalColumns = Math.max(1, options.totalColumns ?? 12);
  const containerWidth =
    options.containerWidth && options.containerWidth > 0 ? options.containerWidth : DEFAULT_CONTAINER_WIDTH_PX;
  const columnGap = options.columnGap ?? TILE_COLUMN_GAP_PX;
  const rowGap = options.rowGap ?? TILE_ROW_GAP_PX;
  const cell = Math.max(24, (containerWidth - (totalColumns - 1) * columnGap) / totalColumns);
  const columnWidthOf = (span: number) => span * cell + (span - 1) * columnGap;
  const heightOf = (span: number, ratio: TileRatio) => columnWidthOf(span) / RATIO_VALUES[ratio];
  return { totalColumns, containerWidth, columnGap, rowGap, cell, columnWidthOf, heightOf };
}

/** 某跨度磁贴的像素高度（供排版 Agent 预演与外部估算使用） */
export function tileHeightPx(span: number, ratio: TileRatio, options: TileLayoutOptions = {}): number {
  const { heightOf } = resolveGeometry(options);
  return heightOf(span, ratio);
}

/**
 * 反解：让「固有比例 + 目标像素高度」的磁贴落进当前列数时应当占多少列跨度。
 *
 * 用途：把焦点磁贴做成「高度合适的大块」，而不是无脑拉满 12 列。
 * 对高瘦组件（如 4:5）强行拉满 12 列会得到一堵远超视口的高墙，反而破坏桌面节奏；
 * 反过来，扁条组件（如 3:1）若不拉满则显得又小又碎。
 */
export function spanForTargetHeight(
  ratio: TileRatio,
  targetHeightPx: number,
  options: TileLayoutOptions = {}
): number {
  const { totalColumns, columnWidthOf } = resolveGeometry(options);
  const targetWidth = targetHeightPx * RATIO_VALUES[ratio];

  let bestSpan = totalColumns;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let span = 2; span <= totalColumns; span++) {
    const diff = Math.abs(columnWidthOf(span) - targetWidth);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSpan = span;
    }
  }
  return bestSpan;
}

/**
 * 瀑布流错落装箱（Staggered Masonry Packing）
 *
 * 每张磁贴按「聚焦优先 + 排版 Agent 阅读序」入队，随后独立地：
 *   1. 在所有合法横向落位中，选择落点最高的那个（= 当前最低洼的列区间）；
 *   2. 允许在 ±TILE_SPAN_FLEX 内微调跨度，但偏离要付出 TILE_SPAN_DEVIATION_PENALTY_PX 的代价，
 *      因此只在「确实能填掉一个空洞」时才生效。
 *
 * 因为落点由列高决定而非由行决定，相邻磁贴的顶边天然不齐 —— 这正是本项目的视觉主张。
 * 不重叠由列高记账保证：磁贴落位后，其覆盖到的每一列高度都被抬到该磁贴底部之下。
 */
export function solveTileLayout(
  inputs: TileLayoutInput[],
  options: number | TileLayoutOptions = 12
): TileLayoutSolution {
  const opts: TileLayoutOptions = typeof options === "number" ? { totalColumns: options } : options;
  const {
    totalColumns,
    columnGap,
    rowGap,
    cell,
    columnWidthOf,
    heightOf
  } = resolveGeometry(opts);
  const allowSpanFlex = opts.allowSpanFlex !== false;
  const placementOrder = opts.placementOrder ?? "reading";
  const clampToHeightBand = opts.clampToHeightBand !== false;
  const minTileHeightPx = opts.minTileHeightPx ?? TILE_MIN_HEIGHT_PX;
  const maxTileHeightPx = opts.maxTileHeightPx ?? TILE_MAX_HEIGHT_PX;
  const spanDeviationPenaltyPx = opts.spanDeviationPenaltyPx ?? TILE_SPAN_DEVIATION_PENALTY_PX;

  /** 本列数下允许出现的跨度目录（互相之间能拼满整行） */
  const spanCatalog = tileableSpans(totalColumns);

  /** 把任意跨度吸附到目录中最近的档位 */
  const snapToCatalog = (span: number): number => {
    let best = spanCatalog[0];
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const s of spanCatalog) {
      const diff = Math.abs(s - span);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = s;
      }
    }
    return best;
  };

  /**
   * 高度护栏：把跨度收缩/扩张到「磁贴高度落在 [TILE_MIN_HEIGHT_PX, TILE_MAX_HEIGHT_PX]」
   * 的档位。只在可拼接跨度目录内取值 —— 否则会造出无法闭合的窄缝。
   * 超出区间时按"越界量"优先修正，同分时保留与名义跨度最接近的解，
   * 因此它只在几何上不可行时才动手，不会无谓改动排版 Agent 的决策。
   */
  const clampSpanToHeightBand = (span: number, ratio: TileRatio): number => {
    if (!clampToHeightBand) return span;
    const fits = (s: number) => {
      const h = heightOf(s, ratio);
      return h >= minTileHeightPx && h <= maxTileHeightPx;
    };
    if (fits(span)) return span;

    let best = span;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const s of spanCatalog) {
      const h = heightOf(s, ratio);
      const overflow = h > maxTileHeightPx ? h - maxTileHeightPx : h < minTileHeightPx ? minTileHeightPx - h : 0;
      // 「高度越界(px)」与「宽度偏离(列 × TILE_SPAN_TRADEOFF_PX)」同量纲相加，
      // 避免为省几十 px 高度而砍掉 2 列宽度这种断崖式降级
      const cost = overflow + Math.abs(s - span) * TILE_SPAN_TRADEOFF_PX;
      if (cost < bestCost - 1e-6) {
        bestCost = cost;
        best = s;
      }
    }
    return best;
  };

  const emptySolution = (): TileLayoutSolution => ({
    items: [],
    totalColumns,
    totalRows: 0,
    totalHeightPx: 0,
    columnHeights: new Array(totalColumns).fill(0),
    raggednessPx: 0,
    staggeredCount: 0,
    topLineCount: 0,
    fillRatio: 1,
    adjustedSpanCount: 0,
    gapCount: 0
  });

  if (!inputs || inputs.length === 0) return emptySolution();

  /** 每一列的已占用底部（像素）。瀑布流的"地形"就由它刻画。 */
  const columnHeights = new Array(totalColumns).fill(0);
  const solved: SolvedTileItem[] = [];

  /** 单个磁贴落位：x 为起始列（0-indexed），yTop 为像素顶部偏移 */
  const commit = (
    input: TileLayoutInput,
    span: number,
    ratio: TileRatio,
    x: number,
    yTop: number,
    spanDeviation: number
  ): SolvedTileItem => {
    const pixelWidth = columnWidthOf(span);
    const ratioHeightPx = pixelWidth / RATIO_VALUES[ratio];
    // 比例是「形状下限」：内容实测更高时就按内容给足高度，
    // 否则磁贴会截断内容 —— 即"小组件没有完整加载出来"的观感。
    const pixelHeight =
      input.contentHeightPx && input.contentHeightPx > ratioHeightPx
        ? input.contentHeightPx
        : ratioHeightPx;

    const rowStart = Math.round(yTop / TILE_ROW_UNIT_PX);
    // 覆盖 [rowStart*unit, yTop + pixelHeight + rowGap)，向上取整保证永不重叠
    const coveredPx = pixelHeight + rowGap + (yTop - rowStart * TILE_ROW_UNIT_PX);
    const rowSpan = Math.max(1, Math.ceil(coveredPx / TILE_ROW_UNIT_PX));

    const item: SolvedTileItem = {
      id: input.id,
      size: widthForSpan(span, totalColumns),
      ratio,
      x,
      y: yTop,
      w: span,
      h: pixelHeight,
      pixelWidth,
      pixelHeight,
      isEmphasized: input.isEmphasized,
      priority: input.priority ?? 50,
      spanDeviation,
      gridStyle: {
        gridColumn: `${x + 1} / span ${span}`,
        gridRow: `${rowStart + 1} / span ${rowSpan}`,
        aspectRatio: RATIO_CSS[ratio]
      }
    };

    solved.push(item);
    // 列高记账：覆盖到的每一列都被抬到本磁贴底部之下，是"绝不重叠"的唯一保证
    const bottom = yTop + pixelHeight + rowGap;
    for (let i = x; i < x + span; i++) {
      columnHeights[i] = Math.max(columnHeights[i], bottom);
    }
    return item;
  };

  /** 磁贴落在 [x, x+span) 上时的顶部偏移 = 该区间内最高的列底 */
  const landingHeightOf = (x: number, span: number): number => {
    let h = 0;
    for (let i = x; i < x + span; i++) {
      if (columnHeights[i] > h) h = columnHeights[i];
    }
    return h;
  };

  // 1. 显式固定坐标的磁贴优先落位；其余磁贴整体沉到它们下方，保证永不重叠。
  const fixedInputs = inputs.filter(t => t.fixedPosition && t.x !== undefined && t.y !== undefined);
  for (const t of fixedInputs) {
    const span = Math.max(1, Math.min(spanOfTileWidth(t.size, totalColumns), totalColumns));
    const ratio = resolveTileRatio(t.id, t.ratio);
    const x = Math.max(0, Math.min(t.x!, Math.max(0, totalColumns - span)));
    commit(t, span, ratio, x, Math.max(0, t.y! * (cell + rowGap)), 0);
  }

  // 2. 其余磁贴入队：聚焦磁贴永远第一个落位（视觉焦点必须先占住最好的位置）
  const fixedIds = new Set(fixedInputs.map(t => t.id));
  const rest = inputs.filter(t => !fixedIds.has(t.id));
  const spanOfInput = (t: TileLayoutInput) =>
    clampSpanToHeightBand(
      Math.max(2, Math.min(spanOfTileWidth(t.size, totalColumns), totalColumns)),
      resolveTileRatio(t.id, t.ratio)
    );

  /** 实测过内容高度的磁贴所锁定的跨度（null = 未实测，走常规弹性闭合） */
  const lockedSpanOf = (t: TileLayoutInput): number | null => {
    if (!t.contentHeightPx || t.contentHeightPx <= 0) return null;
    const span = t.contentSpan ?? spanOfTileWidth(t.size, totalColumns);
    return Math.max(2, Math.min(Math.round(span), totalColumns));
  };

  const queue = rest.sort((a, b) => {
    if (a.isEmphasized && !b.isEmphasized) return -1;
    if (!a.isEmphasized && b.isEmphasized) return 1;
    if (placementOrder === "anchor") {
      // 大块先落位当锚点，小块随后填进低洼 —— 马赛克墙的经典构造法，空洞显著更少
      return spanOfInput(b) - spanOfInput(a);
    }
    return 0; // 稳定：完整保留排版 Agent 给出的阅读序
  });

  let adjustedSpanCount = 0;

  // 3. 逐块瀑布流落位
  for (const input of queue) {
    const ratio = resolveTileRatio(input.id, input.ratio);
    // 实测过内容的磁贴锁定测量时的跨度（改宽度会让实测高度失效），其余照常弹性闭合
    const lockedSpan = lockedSpanOf(input);
    const nominalSpan = lockedSpan ?? spanOfInput(input);

    // 候选跨度 = 目录中与名义跨度相邻的档位（±TILE_SPAN_FLEX 档），名义跨度优先落位
    const nominalIdx = spanCatalog.indexOf(nominalSpan);
    const flexWindow = allowSpanFlex && nominalIdx >= 0
      ? spanCatalog.slice(
        Math.max(0, nominalIdx - TILE_SPAN_FLEX),
        Math.min(spanCatalog.length, nominalIdx + TILE_SPAN_FLEX + 1)
      )
      : [nominalSpan];
    // 内容密集的小组件可声明 minSpan：宁可有洞，也不允许被收窄到该宽度以下
    const spanFloor = input.minSpan && input.minSpan > 0
      ? Math.min(totalColumns, Math.max(2, Math.round(input.minSpan)))
      : 2;
    const candidateSpans = lockedSpan !== null
      ? [lockedSpan]
      : flexWindow.filter((span) => span >= spanFloor);
    if (candidateSpans.length === 0) candidateSpans.push(nominalSpan);

    let bestSpan = nominalSpan;
    let bestX = 0;
    let bestY = Number.POSITIVE_INFINITY;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const span of candidateSpans) {
      const deviation = Math.abs(span - nominalSpan);
      for (let x = 0; x + span <= totalColumns; x++) {
        const y = landingHeightOf(x, span);
        // 主项：落点越低越差（填掉空洞是第一目标）
        // 次项：跨度偏离越大越差（尊重排版 Agent 的宽度决策）
        // 末项：轻微偏左，让同高度的候选保持从左到右的阅读手感
        const score = y + deviation * spanDeviationPenaltyPx + x * 0.5;
        if (score < bestScore - 1e-6) {
          bestScore = score;
          bestSpan = span;
          bestX = x;
          bestY = y;
        }
      }
    }

    if (bestSpan !== nominalSpan) adjustedSpanCount++;
    commit(input, bestSpan, ratio, bestX, bestY === Number.POSITIVE_INFINITY ? 0 : bestY, bestSpan - nominalSpan);
  }

  // ==========================================
  // 4. 结果度量（用于向用户解释"不规则"到底不规则在哪）
  // ==========================================
  const totalHeightPx = Math.max(0, Math.max(...columnHeights, 0) - rowGap);
  const minColumnHeight = totalHeightPx > 0 ? Math.min(...columnHeights) : 0;
  const raggednessPx = totalHeightPx > 0 ? Math.max(0, maxOf(columnHeights) - minColumnHeight) : 0;

  // 顶线分组：同一像素顶线上的磁贴视为"对齐"，独处的顶线即"错落"
  const topLineCounts = new Map<number, number>();
  for (const item of solved) {
    const key = Math.round(item.y / TILE_ROW_UNIT_PX);
    topLineCounts.set(key, (topLineCounts.get(key) ?? 0) + 1);
  }
  let staggeredCount = 0;
  for (const item of solved) {
    const key = Math.round(item.y / TILE_ROW_UNIT_PX);
    if ((topLineCounts.get(key) ?? 1) <= 1) staggeredCount++;
  }

  // 填充率：磁贴总面积 / 包围盒面积。
  // 注意它天然把「下沿参差」也算成未覆盖面积 —— 参差是本项目的视觉主张而非缺陷，
  // 因此判断"是否到处是洞"要看 interiorGapCells，而不是看这个数。
  const boundingWidth = columnWidthOf(totalColumns);
  const boundingArea = Math.max(1, boundingWidth * Math.max(totalHeightPx, 1));
  const tileArea = solved.reduce((sum, item) => sum + item.pixelWidth * item.pixelHeight, 0);
  const fillRatio = Math.max(0, Math.min(1, tileArea / boundingArea));

  // 真实空洞：只统计「各列自身轮廓内部」的空格，把下沿参差排除在外。
  // 口径 = 每列从 0 到自己最终高度之间，没有被任何磁贴覆盖的栅格单元。
  let gapCount = 0;
  {
    const totalRowUnits = Math.ceil(Math.max(totalHeightPx, 1) / TILE_ROW_UNIT_PX);
    const occupied: boolean[][] = Array.from({ length: totalColumns }, () => new Array(totalRowUnits).fill(false));
    for (const item of solved) {
      const r0 = Math.max(0, Math.round(item.y / TILE_ROW_UNIT_PX));
      const r1 = Math.min(totalRowUnits, Math.ceil((item.y + item.pixelHeight) / TILE_ROW_UNIT_PX));
      for (let c = item.x; c < item.x + item.w && c < totalColumns; c++) {
        for (let r = r0; r < r1; r++) occupied[c][r] = true;
      }
    }
    for (let c = 0; c < totalColumns; c++) {
      // 该列的真实轮廓下沿（不含行间距留白）
      const columnBottomUnits = Math.ceil(Math.max(0, columnHeights[c] - rowGap) / TILE_ROW_UNIT_PX);
      for (let r = 0; r < Math.min(totalRowUnits, columnBottomUnits); r++) {
        if (!occupied[c][r]) gapCount++;
      }
    }
  }

  return {
    items: solved,
    totalColumns,
    totalRows: Math.ceil(totalHeightPx / (cell + rowGap)),
    totalHeightPx,
    columnHeights: [...columnHeights],
    raggednessPx,
    staggeredCount,
    topLineCount: topLineCounts.size,
    fillRatio,
    adjustedSpanCount,
    gapCount
  };
}

function maxOf(list: number[]): number {
  let m = 0;
  for (const v of list) if (v > m) m = v;
  return m;
}

// ==========================================
// 5. 桌面状态本地持久化辅助
// ==========================================
const DESKTOP_STORAGE_KEY = "cerlesse_tile_desktop_v1";

export interface StoredDesktopState {
  version: number;
  timestamp: number;
  tiles: Array<{
    id: string;
    size: TileWidth;
    x: number;
    y: number;
  }>;
}

export function saveDesktopState(items: SolvedTileItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDesktopState = {
      version: 1,
      timestamp: Date.now(),
      tiles: items.map(item => ({
        id: item.id,
        size: item.size,
        x: item.x,
        y: item.y
      }))
    };
    localStorage.setItem(DESKTOP_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to persist desktop tile state:", e);
  }
}

export function loadDesktopState(): StoredDesktopState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DESKTOP_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDesktopState;
  } catch {
    return null;
  }
}

export function clearDesktopState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DESKTOP_STORAGE_KEY);
  } catch {}
}
