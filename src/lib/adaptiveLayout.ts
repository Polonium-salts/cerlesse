import {
  AdaptiveLayoutStrategy,
  LayoutIntentType,
  ResultWidgetKey,
  SearchSynthesisResult,
  WidgetGridPlacement,
  WidgetStatusDetail,
  AutoFillGapsMode
} from "../types.js";

export interface PresetLayoutOption {
  id: LayoutIntentType;
  label: string;
  iconName: string;
  description: string;
}

export const PRESET_LAYOUT_OPTIONS: PresetLayoutOption[] = [
  {
    id: "comparison",
    label: "多维对比矩阵优先",
    iconName: "Scale",
    description: "对比矩阵置顶全宽展开，重点聚焦核心差异、选型优劣与参数PK"
  },
  {
    id: "architecture",
    label: "知识架构导图优先",
    iconName: "GitFork",
    description: "交互式知识架构导图全景置顶，直观呈现系统拓扑、核心原理解析与进阶路线"
  },
  {
    id: "official_portal",
    label: "官方门户与导航优先",
    iconName: "ShieldCheck",
    description: "官方认证主站入口与移动端互联置顶，强效过滤非官方镜像与噪声干扰"
  },
  {
    id: "code_tutorial",
    label: "代码与实操教程优先",
    iconName: "Code",
    description: "代码实现与操作工具箱置顶，紧随关键避坑指南与完整语法实操"
  },
  {
    id: "fact_check",
    label: "事实核查与存证优先",
    iconName: "CheckCircle2",
    description: "真伪审计清单与信源可信度遥测置顶，多源交叉求证还原科学真相"
  },
  {
    id: "news_trend",
    label: "时事资讯与趋势优先",
    iconName: "TrendingUp",
    description: "突发脉络速览与时序热度走势置顶，实时权威第一手媒体信源前置"
  },
  {
    id: "quick_definition",
    label: "简明速答与概念速查",
    iconName: "Zap",
    description: "居中大字号权威定义与直接速答，极致极简，休眠冗余重型组件"
  },
  {
    id: "deep_research",
    label: "深度综合研报优先",
    iconName: "FileText",
    description: "核心研报摘要与全产业链图谱深度协同，分面深入剖析产业格局"
  },
  {
    id: "balanced",
    label: "多维全景平衡流",
    iconName: "LayoutGrid",
    description: "横向4格紧凑流式排列，均衡展示结论、信源、工具与探索全景"
  }
];

export function getWidgetLabel(key: ResultWidgetKey): string {
  switch (key) {
    case "quick_answer":
      return "即时答案速递";
    case "takeaways":
      return "核心结论要点";
    case "official_portal":
      return "官方认证门户";
    case "metrics_telemetry":
      return "信源度量分析";
    case "actions_toolbox":
      return "快捷操作工具箱";
    case "analytics_trend":
      return "分析与趋势";
    case "verification_checklist":
      return "事实核查审计";
    case "fast_chat":
      return "智能追问对话";
    case "mobile_qr":
      return "移动端扫描互联";
    case "topic_digest":
      return "分面专题解析";
    case "mindmap":
      return "知识架构导图";
    case "comparison":
      return "多维对比矩阵";
    case "sources":
      return "文献信源库";
    case "followup":
      return "延伸探索建议";
    case "agent_workflow":
      return "Agent 推理审计";
    case "ai_overview":
      return "AI 深度研报";
    case "custom_cards":
      return "搜索定制独有组件";
    default:
      return key;
  }
}

export function getWidgetIconName(key: ResultWidgetKey): string {
  switch (key) {
    case "quick_answer":
      return "Zap";
    case "takeaways":
      return "Sparkles";
    case "official_portal":
      return "ShieldCheck";
    case "metrics_telemetry":
      return "Activity";
    case "actions_toolbox":
      return "Wrench";
    case "analytics_trend":
      return "TrendingUp";
    case "verification_checklist":
      return "CheckCircle2";
    case "fast_chat":
      return "MessageSquare";
    case "mobile_qr":
      return "QrCode";
    case "topic_digest":
      return "Layout";
    case "mindmap":
      return "GitFork";
    case "comparison":
      return "Scale";
    case "sources":
      return "Database";
    case "followup":
      return "Compass";
    case "agent_workflow":
      return "Cpu";
    case "ai_overview":
      return "FileText";
    case "custom_cards":
      return "Sparkles";
    default:
      return "Layers";
  }
}

export const WIDTH_SPAN_OPTIONS: Array<{ span: number; label: string; shortLabel: string; percent: string }> = [
  { span: 3, label: "1 格 (25% 宽 · 1/4 行)", shortLabel: "1格 (25%)", percent: "25%" },
  { span: 4, label: "1/3 宽 (33% · 次级侧栏)", shortLabel: "1/3 (33%)", percent: "33%" },
  { span: 6, label: "2 格 (50% 宽 · 2/4 行)", shortLabel: "2格 (50%)", percent: "50%" },
  { span: 8, label: "2/3 宽 (66% · 主视觉区)", shortLabel: "2/3 (66%)", percent: "66%" },
  { span: 9, label: "3 格 (75% 宽 · 3/4 行)", shortLabel: "3格 (75%)", percent: "75%" },
  { span: 12, label: "4 格 (100% 全宽 · 独占整行)", shortLabel: "4格 (100%)", percent: "100%" },
];

export function getWidgetSpanLabel(span: number): string {
  switch (span) {
    case 3:
      return "1 格 (25% 宽)";
    case 4:
      return "1/3 宽 (33%)";
    case 6:
      return "2 格 (50% 宽)";
    case 8:
      return "2/3 宽 (66%)";
    case 9:
      return "3 格 (75% 宽)";
    case 12:
      return "4 格 (全宽整行)";
    default:
      return `${span}/12 宽`;
  }
}

/**
 * Smart Bin Packing and Dynamic Flow Adaptation Engine
 * Constraints:
 * 1. 4 horizontal grid columns per row (each unit cell = span 3, maximum 4 cells per row).
 * 2. Infinite vertical rows flowing dynamically.
 * 3. High-authority Sources widget occupies 2 horizontal grid cells on top-left.
 * 4. Official Portal widget occupies 1 horizontal grid cell on top-right.
 */
export function calculateAdaptiveBinPacking(
  order: ResultWidgetKey[],
  options: {
    emphasizedWidget?: ResultWidgetKey;
    intentType?: LayoutIntentType;
    hasOfficialSite?: boolean;
    maxColumnsPerRow?: number;
    customSpans?: Partial<Record<ResultWidgetKey, number>>;
    autoFillGaps?: boolean;
    autoFillMode?: AutoFillGapsMode;
  } = {}
): {
  gridConfig: Record<ResultWidgetKey, WidgetGridPlacement>;
  totalRows: number;
  autoFilledOrder: ResultWidgetKey[];
  filledGapsCount: number;
} {
  const maxPerRow = options.maxColumnsPerRow || 4;
  const emphasized = options.emphasizedWidget;
  const intent = options.intentType || "balanced";
  const customSpans = options.customSpans || {};
  const autoFillGaps = options.autoFillGaps !== false;
  const autoFillMode: AutoFillGapsMode = options.autoFillMode || "dense";

  // 1. Determine ideal / natural span budget for each widget based on semantic roles or user override
  const getNaturalSpan = (key: ResultWidgetKey): number => {
    if (customSpans[key] !== undefined && typeof customSpans[key] === "number") {
      return customSpans[key]!;
    }

    if (key === emphasized) {
      if (key === "mindmap" || key === "comparison") {
        return 12; // Emphasized analytical views take full row (4 cells)
      }
      if (key === "ai_overview") {
        return 12;
      }
      if (key === "sources") {
        return 6; // 2 horizontal cells
      }
      if (key === "official_portal") {
        return 3; // 1 horizontal cell
      }
      if (key === "quick_answer") {
        return 6;
      }
      if (key === "takeaways") {
        return 6;
      }
    }

    switch (key) {
      case "quick_answer":
        if (intent === "code_tutorial" || intent === "quick_definition" || intent === "news_trend") {
          return 8; // 2/3 row paired with actions_toolbox (4) or takeaways (4) or analytics_trend (4)
        }
        return 6; // 2 cells
      case "official_portal":
        return intent === "official_portal" ? 6 : 3;
      case "takeaways":
        if (intent === "code_tutorial" || intent === "quick_definition" || intent === "news_trend" || intent === "fact_check") {
          return 4;
        }
        return 6;
      case "metrics_telemetry":
        return intent === "fact_check" ? 4 : 3;
      case "actions_toolbox":
        if (intent === "code_tutorial" || intent === "quick_definition") {
          return 4;
        }
        return 3;
      case "analytics_trend":
        return intent === "news_trend" ? 4 : 3;
      case "verification_checklist":
        return intent === "fact_check" ? 8 : (intent === "news_trend" ? 4 : 3);
      case "fast_chat":
        return intent === "quick_definition" ? 6 : 3;
      case "mobile_qr":
        return 3;
      case "topic_digest":
        return intent === "code_tutorial" ? 8 : 6;
      case "sources":
        if (intent === "quick_definition" || intent === "news_trend" || intent === "fact_check") {
          return 8;
        }
        return 6;
      case "followup":
        return intent === "quick_definition" ? 6 : (intent === "architecture" ? 6 : 3);
      case "agent_workflow":
        return 3;
      case "mindmap":
        return intent === "architecture" ? 12 : 6;
      case "comparison":
        return intent === "comparison" ? 12 : 9;
      case "ai_overview":
        return 6;
      case "custom_cards":
        return 6;
      default:
        return 3;
    }
  };

  const gridConfig: Record<string, WidgetGridPlacement> = {};
  const rows: Array<Array<{ key: ResultWidgetKey; span: number; isCustomLocked?: boolean; isAutoFilled?: boolean }>> = [];
  let filledGapsCount = 0;

  if (!autoFillGaps || autoFillMode === "off") {
    // 严格无补位模式：按原始顺序单向排布，不向前调取卡片填补
    let currentRow: Array<{ key: ResultWidgetKey; span: number; isCustomLocked?: boolean; isAutoFilled?: boolean }> = [];
    let currentOccupied = 0;

    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      const isCustom = customSpans[key] !== undefined;
      const naturalSpan = Math.max(3, getNaturalSpan(key));

      const wouldExceedCapacity = currentOccupied + naturalSpan > 12;
      const wouldExceedMaxCount = currentRow.length >= maxPerRow;

      if (currentRow.length > 0 && (wouldExceedCapacity || wouldExceedMaxCount)) {
        rows.push(currentRow);
        currentRow = [];
        currentOccupied = 0;
      }

      currentRow.push({ key, span: naturalSpan, isCustomLocked: isCustom, isAutoFilled: false });
      currentOccupied += naturalSpan;
    }

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
  } else {
    // 🚀 智能自动补位模式 (Smart Gap-Filling & Dense Flow)
    const pendingList: Array<{ key: ResultWidgetKey; span: number; isCustomLocked: boolean }> = order.map(k => ({
      key: k,
      span: Math.max(3, getNaturalSpan(k)),
      isCustomLocked: customSpans[k] !== undefined
    }));

    while (pendingList.length > 0) {
      const currentRow: Array<{ key: ResultWidgetKey; span: number; isCustomLocked?: boolean; isAutoFilled?: boolean }> = [];
      let currentOccupied = 0;

      // 1. 取出队首元素作为本行基准项
      const head = pendingList.shift()!;
      currentRow.push({ ...head, isAutoFilled: false });
      currentOccupied += head.span;

      // 2. 尝试继续在本行装箱填补
      while (currentOccupied < 12 && currentRow.length < maxPerRow && pendingList.length > 0) {
        const remaining = 12 - currentOccupied;

        // 检查下一个是否能直接放下
        if (pendingList[0].span <= remaining) {
          const next = pendingList.shift()!;
          currentRow.push({ ...next, isAutoFilled: false });
          currentOccupied += next.span;
          continue;
        }

        // 下一个放不下！存在空隙 (Gap Detected)
        if (autoFillMode === "dense") {
          // 向后扫描所有未放置的卡片，寻找能够塞入 remaining 空间的最佳匹配项 (Best-Fit Lookahead)
          let bestFitIndex = -1;
          let bestFitDiff = 999;

          for (let i = 1; i < pendingList.length; i++) {
            const candidate = pendingList[i];
            if (candidate.span <= remaining) {
              const diff = remaining - candidate.span;
              if (diff < bestFitDiff) {
                bestFitDiff = diff;
                bestFitIndex = i;
                if (diff === 0) break; // 完美契合
              }
            }
          }

          if (bestFitIndex !== -1) {
            // 🎯 触发自动补位！将后方合适尺寸的小卡片提前插入当前行
            const [filler] = pendingList.splice(bestFitIndex, 1);
            currentRow.push({ ...filler, isAutoFilled: true });
            currentOccupied += filler.span;
            filledGapsCount++;
            continue; // 继续看是否还能再补位
          }
        }

        // 如果没有找到能塞下的小卡片，或者在 stretch 模式下：
        // 采用行内自适应扩展补位 (Auto-Stretch Remaining)，让整行严丝合缝，消除空洞
        if (currentOccupied < 12) {
          const leftover = 12 - currentOccupied;
          let bestCandidate = currentRow.find(item => !item.isCustomLocked && (
            item.key === "quick_answer" ||
            item.key === "topic_digest" ||
            item.key === "takeaways" ||
            item.key === "sources" ||
            item.key === "ai_overview"
          )) || currentRow.find(item => !item.isCustomLocked) || currentRow[currentRow.length - 1];

          if (bestCandidate && !bestCandidate.isCustomLocked) {
            bestCandidate.span += leftover;
            currentOccupied = 12;
            filledGapsCount++;
          }
        }
        break; // 结束本行
      }

      // 尾行单项自适应扩满
      if (currentOccupied < 12 && pendingList.length === 0) {
        if (currentRow.length === 1 && !currentRow[0].isCustomLocked) {
          currentRow[0].span = 12;
          currentOccupied = 12;
        }
      }

      rows.push(currentRow);
    }
  }

  // Build final placement mapping
  const autoFilledOrder: ResultWidgetKey[] = [];
  rows.forEach((row, rIdx) => {
    const itemCount = row.length;
    row.forEach((item) => {
      autoFilledOrder.push(item.key);
      gridConfig[item.key] = {
        colSpanLg: item.span,
        colSpanMd: item.span <= 6 ? 6 : 12,
        rowIndex: rIdx,
        itemsInRow: itemCount,
        isCompact: item.span <= 4,
        isAutoFilled: item.isAutoFilled || false
      };
    });
  });

  return {
    gridConfig: gridConfig as Record<ResultWidgetKey, WidgetGridPlacement>,
    totalRows: rows.length,
    autoFilledOrder,
    filledGapsCount
  };
}

/**
 * 智能语义意图与卡片布局分类引擎
 * 根据搜索内容的语义特征、问答属性、代码/教程需求、对比维度与权威实体，计算最优卡片布局策略
 */
export function detectQueryIntent(
  query: string,
  context?: {
    hasOfficial?: boolean;
    comparisonCount?: number;
    mindMapBranches?: number;
    filteredResultsCount?: number;
  }
): LayoutIntentType {
  const q = (query || "").trim();
  if (!q) return "balanced";

  // 1. 对比决策意图 (Comparison)
  const isComparison =
    /(对比|区别|优缺点|哪个好|选哪个|怎么选|还是|好还是|优劣|差别|pk|\b(vs|versus|difference|compare|comparison|pros and cons|better)\b)/i.test(q) ||
    ((context?.comparisonCount ?? 0) >= 2);
  if (isComparison) return "comparison";

  // 2. 官方网站与正版入口 (Official Portal)
  const isOfficial =
    /(官网|官方|主页|官方网站|正版|官方下载|官方文档|客户端下载|\b(official|portal|homepage|website|docs|github)\b)/i.test(q) ||
    (Boolean(context?.hasOfficial) && q.length <= 15);
  if (isOfficial) return "official_portal";

  // 3. 事实核验与辟谣求真 (Fact Check)
  const isFactCheck =
    /(真假|谣言|辟谣|核实|是真的吗|属实|假消息|骗局|真实性|是不是真的|被抓|去世了吗|真的假的|\b(fact check|true or false|hoax|rumor|is it true|fake news|debunk|myth)\b)/i.test(q);
  if (isFactCheck) return "fact_check";

  // 4. 代码开发与操作教程 (Code & Tutorial)
  const isCodeOrTutorial =
    /(代码|怎么写|如何实现|教程|命令|参数|配置|报错|异常|函数|语法|类库|环境搭建|安装|部署|怎么做|做法|步骤|\b(code|tutorial|how to|example|command|cli|syntax|script|function|install|setup|debug|error|exception|npm|pip|docker|git|python|golang|rust|java|react|vue|typescript|sql)\b)/i.test(q);
  if (isCodeOrTutorial) return "code_tutorial";

  // 5. 原理架构与知识图谱 (Architecture & Mechanism)
  const isArchitecture =
    /(架构|原理|底层|机制|体系|全景|知识图谱|思维导图|学习路线|生命周期|内部机制|工作原理|\b(architecture|internals|mechanism|how it works|roadmap|overview|pipeline|lifecycle|deep dive)\b)/i.test(q) ||
    ((context?.mindMapBranches ?? 0) >= 3);
  if (isArchitecture) return "architecture";

  // 6. 时事突发与热点动态 (News & Trends)
  const isNews =
    /(今日|今天|最新|突发|新闻|动态|进展|发布会|走势|热点|大盘|刚刚|行情|股价|指数|\b(news|latest|breaking|today|trend|update|announced|stock|market)\b)/i.test(q);
  if (isNews) return "news_trend";

  // 7. 简明速答与概念速查 (Quick Definition / Fact / Instant Lookup)
  const isQuickDef =
    q.length <= 25 &&
    /(是什么|怎么读|读音|定义|含义|解释|换算|等于多少|多少钱|几点|谁是|在哪|什么时候|拼音|\b(what is|meaning|define|definition|convert|who is|where is|when is)\b)/i.test(q);
  if (isQuickDef) return "quick_definition";

  // 8. 深度产业与学术研报 (Deep Research)
  const isDeepResearch =
    /(研报|报告|白皮书|现状|发展趋势|市场份额|产业链|前景|未来|调研|商业计划|\b(research|analysis|industry|whitepaper|market|forecast|survey)\b)/i.test(q);
  if (isDeepResearch) return "deep_research";

  return "balanced";
}

export function determineClientWidgetActivation(params: {
  query?: string;
  hasOfficialSite?: boolean;
  comparisonCount?: number;
  mindMapBranches?: number;
  filteredResultsCount?: number;
  followUpCount?: number;
  intentType?: LayoutIntentType;
  hasCustomCards?: boolean;
}): {
  enabledWidgets: ResultWidgetKey[];
  disabledWidgets: ResultWidgetKey[];
  widgetStatusMap: Record<ResultWidgetKey, any>;
} {
  const query = params.query || "";
  const hasOfficial = Boolean(params.hasOfficialSite);
  const comparisonCount = params.comparisonCount ?? 0;
  const mindMapBranches = params.mindMapBranches ?? 3;
  const filteredResultsCount = params.filteredResultsCount ?? 5;
  const followUpCount = params.followUpCount ?? 3;
  const hasCustomCards = params.hasCustomCards ?? true;

  const intent: LayoutIntentType =
    params.intentType ||
    detectQueryIntent(query, {
      hasOfficial,
      comparisonCount,
      mindMapBranches,
      filteredResultsCount
    });

  // 根据检测到的意图动态配置激活状态
  let enableQuickAnswer = true;
  let enableTakeaways = true;
  let enableOfficial = hasOfficial;
  let enableMetrics = true;
  let enableActions = true;
  let enableAnalytics = true;
  let enableVerification = true;
  let enableFastChat = true;
  let enableMobileQR = true;
  let enableTopicDigest = true;
  let enableMindMap = mindMapBranches >= 2;
  let enableSources = filteredResultsCount > 0;
  let enableFollowup = followUpCount > 0;
  let enableComparison = comparisonCount > 0;
  let enableAgentWorkflow = true;

  if (intent === "quick_definition") {
    // 简明速答：极简主义，休眠70%冗余重型组件，聚焦核心回答
    enableAnalytics = false;
    enableVerification = false;
    enableMobileQR = false;
    enableMindMap = false;
    enableComparison = false;
    enableTopicDigest = false;
    enableMetrics = false;
    enableAgentWorkflow = false;
  } else if (intent === "comparison") {
    // 对比评测：突出横向矩阵，休眠无关移动端与时序折线
    enableComparison = true;
    enableMobileQR = false;
    enableAnalytics = false;
    enableMindMap = false;
  } else if (intent === "architecture") {
    // 知识导图：突出树状架构，休眠对比与移动扫码
    enableMindMap = true;
    enableComparison = false;
    enableMobileQR = false;
    enableAnalytics = false;
  } else if (intent === "official_portal") {
    // 官方门户：置顶正版入口与移动端扫码，休眠重度算法图表
    enableOfficial = true;
    enableMobileQR = true;
    enableComparison = false;
    enableMindMap = false;
    enableVerification = false;
    enableAnalytics = false;
  } else if (intent === "code_tutorial") {
    // 代码实操：突出代码块、复制工具箱与步骤避坑，休眠对比与移动端
    enableActions = true;
    enableTopicDigest = true;
    enableComparison = false;
    enableMobileQR = false;
    enableAnalytics = false;
  } else if (intent === "fact_check") {
    // 事实核查：突出核查清单与可信度审计，休眠对比与导图
    enableVerification = true;
    enableMetrics = true;
    enableComparison = false;
    enableMindMap = false;
    enableMobileQR = false;
  } else if (intent === "news_trend") {
    // 时事资讯：突出即时速递、时序趋势与一手媒体
    enableAnalytics = true;
    enableComparison = false;
    enableMobileQR = false;
    enableMindMap = false;
  }

  const widgetStatusMap: Record<ResultWidgetKey, any> = {
    quick_answer: {
      key: "quick_answer",
      enabled: enableQuickAnswer,
      reason: "核心即时答案与结论提炼，秒级获取核心要点。",
      autoDecidedByAgent: true
    },
    takeaways: {
      key: "takeaways",
      enabled: enableTakeaways,
      reason: "核心观点与要点清单，已自动启动以实现秒级认知获取。",
      autoDecidedByAgent: true
    },
    official_portal: {
      key: "official_portal",
      enabled: enableOfficial,
      reason: enableOfficial
        ? "已精确匹配认证官方域名/核心入口，已自动启动以提供正版直达入口。"
        : "未检索到权威官方认证站点，已自动禁用休眠以消除页面杂乱。",
      autoDecidedByAgent: true
    },
    metrics_telemetry: {
      key: "metrics_telemetry",
      enabled: enableMetrics,
      reason: "信源统计与分析度量小组件，展示处理链路与可信指数。",
      autoDecidedByAgent: true
    },
    actions_toolbox: {
      key: "actions_toolbox",
      enabled: enableActions,
      reason: "快捷控制箱，支持一键复制、Markdown 导出与语音朗读。",
      autoDecidedByAgent: true
    },
    analytics_trend: {
      key: "analytics_trend",
      enabled: enableAnalytics,
      reason: "分析与趋势小组件，展示时序信源收敛曲线与置信指标。",
      autoDecidedByAgent: true
    },
    verification_checklist: {
      key: "verification_checklist",
      enabled: enableVerification,
      reason: "事实核查与安全审计小组件，多源交叉验证防御幻觉。",
      autoDecidedByAgent: true
    },
    fast_chat: {
      key: "fast_chat",
      enabled: enableFastChat,
      reason: "智能追问与对话小组件，支持即时探索与多轮深度发问。",
      autoDecidedByAgent: true
    },
    mobile_qr: {
      key: "mobile_qr",
      enabled: enableMobileQR,
      reason: "移动端同步互联小组件，扫码即在手机端同步研报。",
      autoDecidedByAgent: true
    },
    topic_digest: {
      key: "topic_digest",
      enabled: enableTopicDigest,
      reason: "模块化分面研报小组件，结构化呈现核心解析。",
      autoDecidedByAgent: true
    },
    mindmap: {
      key: "mindmap",
      enabled: enableMindMap,
      reason: enableMindMap
        ? "知识实体具备多层级系统拓扑，已自动启动交互式架构导图。"
        : "当前搜索主题无需层级拓扑导图，已自动禁用休眠以精简界面。",
      autoDecidedByAgent: true
    },
    sources: {
      key: "sources",
      enabled: enableSources,
      reason: enableSources
        ? "已汇聚多源可信赖站点，已自动启动以提供完整信源溯源。"
        : "无外部检索信源，已自动休眠。",
      autoDecidedByAgent: true
    },
    followup: {
      key: "followup",
      enabled: enableFollowup,
      reason: enableFollowup
        ? "已生成高质量延伸探索指引，已自动启动以激发深层思考。"
        : "暂无延伸探索建议，已自动休眠。",
      autoDecidedByAgent: true
    },
    comparison: {
      key: "comparison",
      enabled: enableComparison,
      reason: enableComparison
        ? "识别到跨实体横向对比/选型决策意图，已自动启动多维对比矩阵。"
        : "当前为单一实体/概念探究，无多实体对比必要，已自动禁用休眠对比矩阵。",
      autoDecidedByAgent: true
    },
    agent_workflow: {
      key: "agent_workflow",
      enabled: enableAgentWorkflow,
      reason: "Agent 决策链路追踪与事实审计。",
      autoDecidedByAgent: true
    },
    ai_overview: {
      key: "ai_overview",
      enabled: false,
      reason: "传统全景单块大文章研报，已拆解为独立模块化小组件。",
      autoDecidedByAgent: true
    },
    custom_cards: {
      key: "custom_cards",
      enabled: hasCustomCards,
      reason: hasCustomCards
        ? "基于当前搜索信源智能提炼的独有定制小组件，已与固定小组件统一排列。"
        : "当前无专属定制小组件，已自动休眠。",
      autoDecidedByAgent: true
    }
  };

  const enabledWidgets: ResultWidgetKey[] = [];
  const disabledWidgets: ResultWidgetKey[] = [];

  (Object.keys(widgetStatusMap) as ResultWidgetKey[]).forEach((k) => {
    if (widgetStatusMap[k as ResultWidgetKey].enabled) {
      enabledWidgets.push(k as ResultWidgetKey);
    } else {
      disabledWidgets.push(k as ResultWidgetKey);
    }
  });

  if (enabledWidgets.length === 0) {
    enabledWidgets.push("quick_answer", "takeaways", "sources");
  }

  return {
    enabledWidgets,
    disabledWidgets,
    widgetStatusMap
  };
}

export function getStrategyForPreset(
  preset: LayoutIntentType,
  query = "",
  hasOfficialSite = true,
  customActivation?: {
    enabledWidgets?: ResultWidgetKey[];
    disabledWidgets?: ResultWidgetKey[];
    widgetStatusMap?: Record<ResultWidgetKey, WidgetStatusDetail>;
  },
  customSpans?: Partial<Record<ResultWidgetKey, number>>,
  autoFillOptions?: { autoFillGaps?: boolean; autoFillMode?: AutoFillGapsMode }
): AdaptiveLayoutStrategy {
  const defaultActivation = determineClientWidgetActivation({ query, hasOfficialSite, intentType: preset });
  const activation = customActivation?.enabledWidgets
    ? {
        enabledWidgets: customActivation.enabledWidgets,
        disabledWidgets: customActivation.disabledWidgets || [],
        widgetStatusMap: customActivation.widgetStatusMap || defaultActivation.widgetStatusMap
      }
    : defaultActivation;

  const filterToEnabled = (order: ResultWidgetKey[]): ResultWidgetKey[] => {
    const active = order.filter((k) => activation.enabledWidgets.includes(k));
    return active.length > 0 ? active : ["quick_answer", "takeaways", "sources"];
  };

  const autoFillGaps = autoFillOptions?.autoFillGaps !== false;
  const autoFillMode = autoFillOptions?.autoFillMode || "dense";

  switch (preset) {
    case "comparison": {
      // 对比评测优先：对比矩阵全宽置顶 (Row 1)，要点速览与速答紧随 (Row 2)
      const fullOrder: ResultWidgetKey[] = [
        "comparison",
        "custom_cards",
        "takeaways",
        "quick_answer",
        "topic_digest",
        "sources",
        "actions_toolbox",
        "fast_chat",
        "followup",
        "agent_workflow"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "comparison",
        intentType: "comparison",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "comparison",
        intentLabel: "多维对比矩阵优先 (对比全景置顶)",
        explanation:
          "识别到选型对比需求：多维交叉参数对比矩阵置顶全宽展开，次行紧随选型要点速览与即时结论，杜绝无效查找。",
        emphasizedWidget: "comparison",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "architecture": {
      // 架构图谱优先：交互式思维导图全景置顶 (Row 1)，原理解析速答与要点紧随 (Row 2)
      const fullOrder: ResultWidgetKey[] = [
        "mindmap",
        "quick_answer",
        "custom_cards",
        "takeaways",
        "topic_digest",
        "actions_toolbox",
        "sources",
        "followup",
        "fast_chat",
        "agent_workflow"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "mindmap",
        intentType: "architecture",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "architecture",
        intentLabel: "知识架构导图优先 (交互图谱全景置顶)",
        explanation:
          "识别到系统原理与知识体系探究：全景交互式思维导图置顶展开，树状呈现层级依赖，次行展开原理解析与核心步骤。",
        emphasizedWidget: "mindmap",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "official_portal": {
      // 官方门户优先：官方正版入口 (6) + 扫码互联 (3) + 快捷工具 (3) 组成顶行，速答 (6) + 要点 (6) 次行
      const fullOrder: ResultWidgetKey[] = [
        "official_portal",
        "mobile_qr",
        "actions_toolbox",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "sources",
        "fast_chat",
        "followup",
        "agent_workflow"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "official_portal",
        intentType: "official_portal",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "official_portal",
        intentLabel: "官方门户与导航优先 (正版入口置顶)",
        explanation:
          "识别到官方正版寻址与工具入口需求：高可信官方认证卡片与移动扫码直达首屏置顶，强效过滤钓鱼与非官方镜像。",
        emphasizedWidget: "official_portal",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "code_tutorial": {
      // 代码与实操教程优先：代码速答 (8) + 代码工具箱 (4) 首屏置顶，分面解析 (8) + 避坑要点 (4) 次行
      const fullOrder: ResultWidgetKey[] = [
        "quick_answer",
        "custom_cards",
        "actions_toolbox",
        "topic_digest",
        "takeaways",
        "sources",
        "fast_chat",
        "mindmap",
        "followup",
        "agent_workflow"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "quick_answer",
        intentType: "code_tutorial",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "code_tutorial",
        intentLabel: "代码与实操教程优先 (代码速答与工具箱置顶)",
        explanation:
          "识别到开发编程与操作指南需求：首屏直接给出完整代码实现与一键复制工具箱，次行配以参数避坑指南与深入实操细节。",
        emphasizedWidget: "quick_answer",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "fact_check": {
      // 事实核查优先：核验红绿灯清单 (8) + 信源遥测 (4) 置顶，真伪结论 (8) + 破谣要点 (4) 次行
      const fullOrder: ResultWidgetKey[] = [
        "verification_checklist",
        "metrics_telemetry",
        "custom_cards",
        "quick_answer",
        "takeaways",
        "sources",
        "actions_toolbox",
        "topic_digest",
        "followup",
        "agent_workflow"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "verification_checklist",
        intentType: "fact_check",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "fact_check",
        intentLabel: "事实核查与辟谣优先 (求真存证清单置顶)",
        explanation:
          "识别到求真核实与辟谣需求：多源交叉求证核验清单与信源权威度遥测置顶呈现，还原科学真相。",
        emphasizedWidget: "verification_checklist",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "news_trend": {
      // 时事资讯优先：最新事件速递 (8) + 热度趋势走势 (4) 置顶，一手权威信源 (8) + 核心快讯 (4) 次行
      const fullOrder: ResultWidgetKey[] = [
        "quick_answer",
        "custom_cards",
        "analytics_trend",
        "sources",
        "takeaways",
        "verification_checklist",
        "actions_toolbox",
        "fast_chat",
        "topic_digest",
        "followup",
        "agent_workflow"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "quick_answer",
        intentType: "news_trend",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "news_trend",
        intentLabel: "时事资讯与热点走势优先 (突发脉络与趋势置顶)",
        explanation:
          "识别到突发新闻与时效动态需求：突发事件核心脉络与时序趋势曲线首屏置顶，最新权威第一手信源列表紧随呈现。",
        emphasizedWidget: "quick_answer",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "quick_definition": {
      // 简明速答：极致聚焦极简，单卡大字号速答 (8) + 要点 (4) 置顶，权威词典 (8) + 朗读/复制 (4) 次行
      const fullOrder: ResultWidgetKey[] = [
        "quick_answer",
        "custom_cards",
        "takeaways",
        "sources",
        "actions_toolbox",
        "fast_chat",
        "followup"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "quick_answer",
        intentType: "quick_definition",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "quick_definition",
        intentLabel: "简明速答与概念速查 (极致极简)",
        explanation:
          "识别到事实百科与概念查询：大字号权威精准速答居中呈现，智能休眠冗余重型图表，呈现清爽利落的高对比界面。",
        emphasizedWidget: "quick_answer",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "deep_research": {
      // 深度研报：要点清单 (4) + 研报速答 (8) 置顶，全产业链知识图谱 (12) 次行，分面剖析与趋势紧随
      const fullOrder: ResultWidgetKey[] = [
        "takeaways",
        "quick_answer",
        "custom_cards",
        "mindmap",
        "topic_digest",
        "analytics_trend",
        "comparison",
        "sources",
        "metrics_telemetry",
        "actions_toolbox",
        "fast_chat",
        "followup",
        "agent_workflow"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "takeaways",
        intentType: "deep_research",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "deep_research",
        intentLabel: "深度综合研报优先 (核心结论与产业链协同)",
        explanation:
          "识别到深度课题与产业调研：战略要点速览与全景产业链图谱协同呈现，深度拆解细分面与市场趋势。",
        emphasizedWidget: "takeaways",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }

    case "balanced":
    default: {
      const fullOrder: ResultWidgetKey[] = [
        "quick_answer",
        "custom_cards",
        "takeaways",
        "actions_toolbox",
        "metrics_telemetry",
        "sources",
        "topic_digest",
        "analytics_trend",
        "mindmap",
        "fast_chat",
        "followup",
        "agent_workflow",
        "comparison"
      ];
      const order = filterToEnabled(fullOrder);
      const packing = calculateAdaptiveBinPacking(order, {
        emphasizedWidget: "quick_answer",
        intentType: "balanced",
        hasOfficialSite,
        maxColumnsPerRow: 4,
        customSpans,
        autoFillGaps,
        autoFillMode
      });
      return {
        intentType: "balanced",
        intentLabel: "多维全景平衡流 (4格自适应装箱)",
        explanation:
          "横向4格紧凑流式排列，均衡展示结论、信源、工具与探索全景，零空隙自适应装箱。",
        emphasizedWidget: "quick_answer",
        componentOrder: packing.autoFilledOrder || order,
        gridConfig: packing.gridConfig,
        maxColumnsPerRow: 4,
        totalRows: packing.totalRows,
        packingMethod: "agent-adaptive-binpack",
        enabledWidgets: activation.enabledWidgets,
        disabledWidgets: activation.disabledWidgets,
        widgetStatusMap: activation.widgetStatusMap,
        customWidgetSpans: customSpans,
        autoFillGaps,
        autoFillMode,
        filledGapsCount: packing.filledGapsCount
      };
    }
  }
}

export function computeAdaptiveLayoutFromQuery(
  result: SearchSynthesisResult,
  customSpans?: Partial<Record<ResultWidgetKey, number>>,
  autoFillOptions?: { autoFillGaps?: boolean; autoFillMode?: AutoFillGapsMode }
): AdaptiveLayoutStrategy {
  const query = result.query || "";
  const hasOfficial = result.filteredResults.some((r) => r.isOfficial);

  const detectedIntent = detectQueryIntent(query, {
    hasOfficial,
    comparisonCount: result.comparisonTable?.length || 0,
    mindMapBranches: result.mindMap?.children?.length || 0,
    filteredResultsCount: result.filteredResults?.length || 0
  });

  const activation = determineClientWidgetActivation({
    query,
    hasOfficialSite: hasOfficial,
    comparisonCount: result.comparisonTable?.length || 0,
    mindMapBranches: result.mindMap?.children?.length || 0,
    filteredResultsCount: result.filteredResults?.length || 0,
    followUpCount: result.followUpQuestions?.length || 0,
    intentType: detectedIntent
  });

  return getStrategyForPreset(detectedIntent, query, hasOfficial, activation, customSpans, autoFillOptions);
}

/**
 * Returns Tailwind grid column span class supporting up to 4 items per row
 * (col-span-3 enables 4 cards per row: 12 / 3 = 4)
 */
export function getWidgetGridClass(placement?: WidgetGridPlacement): string {
  if (!placement) {
    return "col-span-12";
  }

  const span = placement.colSpanLg;
  switch (span) {
    case 3:
      // In desktop/large screens, this is 1/4 width (4 widgets per row!)
      return "col-span-12 sm:col-span-6 md:col-span-6 lg:col-span-3";
    case 4:
      // 1/3 width (3 widgets per row)
      return "col-span-12 sm:col-span-6 lg:col-span-4";
    case 6:
      // 1/2 width (2 widgets per row)
      return "col-span-12 lg:col-span-6";
    case 8:
      return "col-span-12 lg:col-span-8";
    case 9:
      return "col-span-12 lg:col-span-9";
    case 12:
    default:
      return "col-span-12";
  }
}

/**
 * Returns exact responsive width class for Free-Flow Flex Masonry Mode
 * Respects precise Agent span ratios while keeping zero vertical stretching.
 */
export function getWidgetFluidWidthClass(span?: number): string {
  if (!span) return "w-full";
  switch (span) {
    case 3:
      // 25% on lg (4 per row), 50% on sm/md, 100% on mobile
      return "w-full sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)]";
    case 4:
      // 33.3% on lg (3 per row), 50% on sm/md, 100% on mobile
      return "w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.3333%-13.33px)]";
    case 6:
      // 50% on lg (2 per row), 100% on mobile
      return "w-full lg:w-[calc(50%-10px)]";
    case 8:
      // 66.6% on lg (2/3 width)
      return "w-full lg:w-[calc(66.6667%-6.67px)]";
    case 9:
      // 75% on lg (3/4 width)
      return "w-full lg:w-[calc(75%-5px)]";
    case 12:
    default:
      return "w-full";
  }
}
