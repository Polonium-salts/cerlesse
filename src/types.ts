export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  engine?: string;
  category?: string;
  score?: number;
  publishedDate?: string;
  author?: string;
  thumbnail?: string;
  relevanceReason?: string;
  filteredOut?: boolean;
  isOfficial?: boolean;
  displayDomain?: string;
}

export interface ComparisonDimension {
  dimension: string; // e.g. "技术路线与核心原理", "应用场景", "优劣势分析", "发展现状与生态"
  summary: string;
  sourcesBreakdown: {
    sourceTitle: string;
    sourceUrl: string;
    sourceType: string; // "官方文档" | "技术评测" | "学术研究" | "行业分析" | "社区观点"
    pointOfView: string;
    confidence: "高" | "中" | "参考";
  }[];
}

export interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  type?: "root" | "category" | "concept" | "detail" | "insight";
  children?: MindMapNode[];
  color?: string;
}

export interface DetectedLanguage {
  code: string;
  name: string;
  flag: string;
  crossLingualEnabled?: boolean;
  crossLingualSummary?: string;
}

export interface AgentPlan {
  originalQuery: string;
  intent: string;
  subQueries: string[];
  comparisonDimensions: string[];
  detectedLanguage?: DetectedLanguage;
  targetLanguage?: string;
}

export type AgentRole = 
  | "coordinator"           // 主 Agent / 调度总控: 负责全局意图解析、任务拆解与派发、进度监控与最终验收交付
  | "retrieval"             // 全网检索 Agent: 负责主 Agent 派发的专职任务——全网多引擎嗅探、跨语言关键词扩展、权威官网甄别与垃圾清洗
  | "knowledge_synthesis"   // 深度研报 Agent: 负责主 Agent 派发的专职任务——核心速览提炼、多维对比矩阵、拓扑思维导图与延伸追问构建
  | "widget_forge"          // 专属小组件构建 Agent: 负责主 Agent 派发的专职任务——独有交互小组件 (Unique Card) 架构与锻造，多原型智能匹配与防重工程
  | "orchestrator"          // 排版编排 Agent: 负责主 Agent 派发的专职任务——自适应 4 列装箱算法、组件视觉跨度与启停休眠决策
  | "qa_validator";         // 护栏质检 Agent: 负责主 Agent 派发的专职任务——输入/输出 Guardrails 审计、信源复核与防重复风控

/**
 * 由主 Agent 专门派发给特定智能体的独立子任务定义
 */
export interface AssignedTask {
  id: string;                      // 任务唯一标识，如 "TASK-RETRIEVE", "TASK-FORGE"
  assignedToRole: AgentRole;       // 承接该任务的专职 Agent
  assignedAgentName: string;       // 承接 Agent 名称
  taskName: string;                // 任务名称
  mandate: string;                 // 主 Agent 给该专门 Agent 下达的专属指令
  status: "pending" | "running" | "completed" | "error";
  deliverables?: string[];         // 专职 Agent 完成后提交给主 Agent 的交付物
  executionTimeMs?: number;
  completionSummary?: string;
}

export interface TeamMember {
  id: string;
  role: AgentRole;
  name: string;
  title: string;
  isMaster?: boolean;              // 是否为主 Agent (调度领航员)
  dedicatedDuty: string;           // 专属独立职责定义 (强调各 Agent 负责领域互不重叠)
  avatarIcon: "Cpu" | "Search" | "Blocks" | "LayoutGrid" | "ShieldCheck" | "Bot" | "BookOpen";
  status: "idle" | "running" | "completed" | "error";
  currentTask?: string;
  assignedTaskId?: string;         // 主 Agent 派发给它的当前任务代号
  assignedMandate?: string;        // 主 Agent 派发给它的具体指令
  deliverables?: string[];         // 该 Agent 向主 Agent 交付的成果列表
  completedTasksCount: number;
  totalTasksCount: number;
  executionTimeMs?: number;
  outputSummary?: string;
  speedupMultiplier?: number;
}

export interface AgentTeamReport {
  teamName: string;
  masterAgent: {
    name: string;
    role: AgentRole;
    title: string;
    mandateSummary: string;
  };
  tasksDelegated: AssignedTask[];   // 主 Agent 派发给各专门 Agent 的完整任务分派单
  members: TeamMember[];
  collaborationSummary: string;
  speedupMultiplier: number; // e.g., 2.7x
  parallelTasksExecuted: number;
  totalSavedTimeMs: number;
  totalDurationMs?: number;
  timestamp: number;
}

export type AgentStepStatus = "pending" | "running" | "completed" | "error";

export interface AgentStep {
  id: string;
  title: string;
  description: string;
  status: AgentStepStatus;
  timestamp: number;
  details?: string[];
  agentRole?: AgentRole;
  agentName?: string;
  speedupFactor?: string;
}

export type LayoutIntentType = 
  | "comparison"        // 对比评测优先 (对比矩阵置顶全宽)
  | "architecture"      // 架构/知识导图优先 (思维导图全景置顶)
  | "official_portal"   // 官方门户/权威入口优先 (官方认证入口置顶)
  | "code_tutorial"     // 代码/实操教程优先 (代码速答与开发工具箱置顶)
  | "fact_check"        // 事实核查/辟谣存证优先 (核验清单与度量置顶)
  | "news_trend"        // 时事资讯/热点趋势优先 (即时动态与时序趋势置顶)
  | "quick_definition"  // 简明速答/概念速查 (单卡核心直接回答，极致极简)
  | "deep_research"     // 深度研报/核心结论优先 (全局综合研报拓扑)
  | "balanced";         // 均衡综合布局

export type ResultWidgetKey = 
  | "quick_answer"
  | "official_portal"
  | "takeaways"
  | "metrics_telemetry"
  | "actions_toolbox"
  | "analytics_trend"
  | "verification_checklist"
  | "fast_chat"
  | "mobile_qr"
  | "topic_digest"
  | "mindmap"
  | "sources"
  | "followup"
  | "comparison"
  | "agent_workflow"
  | "ai_overview"
  | "custom_cards";

export const ALL_RESULT_WIDGET_KEYS: ResultWidgetKey[] = [
  "quick_answer",
  "official_portal",
  "takeaways",
  "metrics_telemetry",
  "actions_toolbox",
  "analytics_trend",
  "verification_checklist",
  "fast_chat",
  "mobile_qr",
  "topic_digest",
  "mindmap",
  "sources",
  "followup",
  "comparison",
  "agent_workflow",
  "ai_overview",
  "custom_cards"
];

export interface WidgetStatusDetail {
  key: ResultWidgetKey;
  enabled: boolean;
  reason: string;
  autoDecidedByAgent?: boolean;
}

export type WidgetSemanticWidth = "full" | "wide" | "half" | "compact";

export interface LayoutBudget {
  maxPrimarySections: number;
  maxSecondarySections: number;
  maxVisualWidgets: number;
  maxInteractiveWidgets: number;
}

export interface LayoutPlan {
  intent: LayoutIntentType;
  intentLabel?: string;
  order: ResultWidgetKey[];
  enabled: ResultWidgetKey[];
  featured?: ResultWidgetKey;
  width: Partial<Record<ResultWidgetKey, WidgetSemanticWidth>>;
  budget?: {
    maxPrimary: number;
    maxSecondary: number;
    totalActive: number;
  };
  groups?: Array<{
    id: string;
    label?: string;
    widgets: ResultWidgetKey[];
  }>;
}

export interface WidgetGridPlacement {
  colSpanLg: number; // 4, 6, 8, 12 (12-column CSS Grid: 12=full, 8=wide, 6=half, 4=compact)
  colSpanMd?: number; // 6 or 12 for tablet
  semanticWidth?: WidgetSemanticWidth; // "full" | "wide" | "half" | "compact"
  rowIndex?: number; // 0-based conceptual row index
  itemsInRow?: number; // Total number of widgets sharing this row (1, 2, 3)
  isCompact?: boolean; // Whether the widget should render in compact mode
  minHeight?: string;
  isAutoFilled?: boolean; // Legacy indicator
}

export type LayoutAlignmentMode = "masonry" | "grid";
export type AutoFillGapsMode = "dense" | "stretch" | "off";

export interface AdaptiveLayoutStrategy {
  intentType: LayoutIntentType;
  intentLabel: string;
  explanation: string;
  componentOrder: ResultWidgetKey[];
  emphasizedWidget: ResultWidgetKey;
  gridConfig: Record<ResultWidgetKey, WidgetGridPlacement>;
  layoutPlan?: LayoutPlan;
  maxColumnsPerRow?: number; // 4
  totalRows?: number;
  packingMethod?: "agent-adaptive-binpack" | "compact-4col" | "wide-focus" | "semantic-css-grid";
  enabledWidgets?: ResultWidgetKey[];
  disabledWidgets?: ResultWidgetKey[];
  widgetStatusMap?: Record<ResultWidgetKey, WidgetStatusDetail>;
  customWidgetSpans?: Partial<Record<ResultWidgetKey, number>>;
  alignmentMode?: LayoutAlignmentMode;
  autoFillGaps?: boolean;
  autoFillMode?: AutoFillGapsMode;
  filledGapsCount?: number;
}

export interface SearchSynthesisResult {
  query: string;
  timestamp: number;
  plan: AgentPlan;
  steps: AgentStep[];
  filteredResults: SearchResult[];
  rawResultCount: number;
  summary: string; // Markdown summary with inline citations
  keyTakeaways: string[];
  comparisonTable: ComparisonDimension[];
  mindMap: MindMapNode;
  followUpQuestions: string[];
  modelUsed: string;
  executionTimeMs: number;
  isMockFallback?: boolean;
  detectedLanguage?: DetectedLanguage;
  targetLanguage?: string;
  layoutStrategy?: AdaptiveLayoutStrategy;
  agentTeam?: AgentTeamReport;
  customCards?: CustomCardData[];
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  contextLength: string;
  pricing: "Free" | "Official" | "Paid";
  isRecommended?: boolean;
}

export interface UserSettings {
  openRouterApiKey: string;
  selectedModel: string;
  searxngCustomUrl: string;
  language: string;
  maxResults: number;
  enableDeepSearch: boolean;
}

export type CustomCardArchetype = 
  | "pros_cons"         // 优缺点与避坑对比
  | "action_checklist"  // 实操步骤与执行清单
  | "parameter_matrix"  // 核心参数与规格全览
  | "quote_dossier"     // 关键言论与信源档案
  | "timeline"          // 发展演进与时间线
  | "verdict_summary"   // 结论裁决与评级决策
  | "freeform";         // 自定义/自由结构

export interface CustomCardMetric {
  label: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
}

export interface CustomCardSectionItem {
  id?: string;
  title: string;
  description: string;
  tag?: string;
  tagColor?: "blue" | "emerald" | "amber" | "rose" | "violet" | "zinc";
  sourceUrl?: string;
  sourceTitle?: string;
  checked?: boolean;
}

export interface CustomCardSection {
  title: string;
  icon?: string;
  items: CustomCardSectionItem[];
}

export interface ProsConsItem {
  id: string;
  title: string;
  description: string;
  impact?: "high" | "medium" | "low";
  severity?: "critical" | "high" | "moderate" | "medium" | "minor" | "low";
  category?: string;
  mitigation?: string; // 针对缺点/风险的化解应对方案
  sourceTitle?: string;
  sourceUrl?: string;
  upvotes?: number;
}

export interface ProsConsData {
  pros: ProsConsItem[];
  cons: ProsConsItem[];
  balanceRatio?: { proPercent: number; conPercent: number };
  tradeoffVerdict?: string;
}

export interface ChecklistTaskItem {
  id: string;
  title: string;
  instruction: string;
  stepNumber: number;
  estimatedTime?: string;
  difficulty?: "easy" | "medium" | "hard";
  priority?: "critical" | "normal" | "optional";
  commandOrCode?: string;
  checked: boolean;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface ActionChecklistData {
  tasks: ChecklistTaskItem[];
}

export interface ParameterMatrixRow {
  id: string;
  parameter: string;
  category?: string;
  values: string[];
  isHighlight?: boolean;
  differenceNote?: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface ParameterMatrixData {
  columns: string[];
  rows: ParameterMatrixRow[];
  categories?: string[];
}

export interface TimelineMilestone {
  id: string;
  phase: string;
  dateOrPeriod: string;
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  tag?: string;
  impactScore?: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface TimelineData {
  milestones: TimelineMilestone[];
}

export interface VerdictScenario {
  id: string;
  name: string;
  description: string;
}

export interface VerdictCandidate {
  id: string;
  name: string;
  badge: string;
  scenarioScores: Record<string, number>; // scenarioId -> score (0-100)
  verdict: "强烈推荐" | "次选备选" | "谨慎选择";
  bestFor: string;
  keyPros: string[];
  keyCons: string[];
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface VerdictSummaryData {
  scenarios: VerdictScenario[];
  candidates: VerdictCandidate[];
  finalAdvice?: string;
}

export interface QuoteDossierItem {
  id: string;
  quote: string;
  speaker: string;
  titleOrRole: string;
  organizationOrSource: string;
  stance: "support" | "caution" | "neutral";
  authorityLevel: "high" | "medium" | "verified";
  contextSnippet?: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface QuoteDossierData {
  quotes: QuoteDossierItem[];
}

export interface CustomCardData {
  id: string;
  title: string;
  subtitle: string;
  archetype: CustomCardArchetype;
  themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
  iconName: string;
  colSpan: number; // 4, 6, 8, 12
  createdAt: number;
  basedOnQuery: string;
  sourceCount: number;
  groundedUrls: string[];
  metrics?: CustomCardMetric[];
  sections: CustomCardSection[];
  takeawayFootnote?: string;
  userPrompt?: string;
  isPinned?: boolean;
  // 各原型专属的高阶功能数据模型
  prosConsData?: ProsConsData;
  checklistData?: ActionChecklistData;
  matrixData?: ParameterMatrixData;
  timelineData?: TimelineData;
  verdictData?: VerdictSummaryData;
  quoteData?: QuoteDossierData;
}
