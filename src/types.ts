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
  | "action_planner"        // 行动规划 Agent: 负责分析用户最终任务目标、规划下一步动作 (Next-Step Action) 与调度 Tool Registry
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
  | "install"           // 安装部署与下载中心优先
  | "tool_discovery"    // 实用工具与在线体验优先
  | "travel"            // 旅游攻略与行程路线优先
  | "troubleshooting"   // 报错排查与故障修复优先
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

export type WidgetSemanticWidth = "full" | "large" | "medium" | "small" | "compact" | "wide" | "half";

export type LayoutStructureType = "single_column" | "two_column" | "dashboard";

export type ToolCapabilityType = 
  | "official_url"       // 打开已认证的官方门户主站/主入口
  | "download"           // 下载软件包/二进制安装包/Release
  | "install_command"    // 复制并执行包管理器安装命令 (npm/pip/brew/docker/curl)
  | "copy_text"          // 复制配置代码/Prompt/环境参数
  | "open_docs"          // 查阅官方深度文档或 API Reference
  | "open_demo"          // 打开在线体验 Demo/Playground/WebUI
  | "navigate"           // 页面内导航或跳转关联组件
  | "api_endpoint";      // 测试或调用真实 API 端点

export interface ToolDefinition {
  id: ToolCapabilityType;
  name: string;
  description: string;
  iconName: string;
  requiredParams: string[];
}

export interface WidgetAction {
  id?: string;
  tool?: ToolCapabilityType;
  type: "open_url" | "download" | "copy" | "execute" | "navigate" | "open_tool" | "api_endpoint";
  label: string;
  description?: string;
  url?: string;
  command?: string;
  params?: Record<string, any>;
  payload?: any;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  iconName?: string;
  badge?: string;
  isVerified?: boolean;
}

export type QueryIntent = 
  | "install"          // 软件安装/环境配置/下载CLI (如 Docker 怎么安装, 怎么下载 Python)
  | "compare"          // 多方案选型/对比优劣 (如 Docker 和 Podman 区别, React vs Vue)
  | "tool_discovery"   // 工具发现/在线工具推荐/免安装体验 (如 有没有免费的图片压缩工具)
  | "tutorial"         // 实操步骤/代码教程/进阶实战 (如 怎么写 Promise, Nginx 反向代理配置)
  | "troubleshooting"  // 报错排查/异常修复/避坑 (如 npm 报错, 跨域 CORS 排查)
  | "travel"           // 旅游攻略/行程路线/景点住宿 (如 日本旅游攻略, 成都3日游)
  | "explain"          // 概念解释/原理科普 (如 什么是 Docker, 量子计算原理)
  | "research";        // 深度研报/全产业链/学术探讨

export interface WidgetPlan {
  intent: QueryIntent;
  userGoal: string;
  suggestedArchetype: CustomCardArchetype;
  capabilities: string[]; // ["official_url", "download", "install_command", "install_step", "try_online", "compare_table", "pros_cons", "timeline", "itinerary_timeline"]
  widgets: ResultWidgetKey[]; // Decided widget order based on capabilities & information priority
  primaryActions: WidgetAction[]; // Standardized executable actions
  widgetCustomizations?: {
    cardTitle?: string;
    cardSubtitle?: string;
    cardCategory?: WidgetCategoryType;
    suggestedArchetype?: CustomCardArchetype;
    themeColor?: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
    iconName?: string;
  };
}

export interface TaskCapabilityRequirements {
  task_type: QueryIntent;
  user_goal: string;
  required_capabilities: string[]; // e.g. ["download", "install_command", "official_portal", "compare_table", "demo_sandbox", "itinerary_timeline"]
  recommended_widgets?: ResultWidgetKey[];
  forbidden_widget_patterns?: string[];
}

export interface WidgetCapabilityDefinition {
  id: ResultWidgetKey;
  capabilities: string[];
  widgetType: "interactive_action" | "analytical_tool" | "content_summary" | "portal_utility";
  minInteractiveLevel: number;
}

export interface WidgetQualityGuardReport {
  passed: boolean;
  intent: QueryIntent;
  evaluatedWidgets: ResultWidgetKey[];
  violations: string[];
  autoRemediated: boolean;
  remediatedWidgets?: ResultWidgetKey[];
  reason: string;
}

export type CustomCardArchetype = 
  | "parameter_matrix" 
  | "timeline" 
  | "action_checklist" 
  | "verdict_summary" 
  | "pros_cons" 
  | "quote_dossier"
  | "tool_discovery"
  | "download_hub"
  | "travel_itinerary";

export interface ToolDiscoveryItem {
  id: string;
  name: string;
  tagline: string;
  pricing: "free" | "freemium" | "paid" | "open_source";
  rating: number; // 0-5
  url: string;
  hasOnlineDemo: boolean;
  demoUrl?: string;
  tags: string[];
  highlight: string;
}

export interface ToolDiscoveryData {
  categoryName: string;
  tools: ToolDiscoveryItem[];
  filterTags: string[];
  recommendationVerdict: string;
}

export interface DownloadReleaseItem {
  id: string;
  platform: "linux" | "macos" | "windows" | "docker" | "generic";
  platformLabel: string;
  version: string;
  downloadUrl?: string;
  installCommand?: string;
  checksum?: string;
  isRecommended?: boolean;
}

export interface DownloadHubData {
  softwareName: string;
  latestVersion: string;
  officialSiteUrl: string;
  releases: DownloadReleaseItem[];
  quickCopyCommand: string;
  systemRequirements?: string;
}

export interface TravelDayPlan {
  day: number;
  title: string;
  spots: Array<{
    name: string;
    description: string;
    suggestedDuration: string;
    tips?: string;
    ticketUrl?: string;
  }>;
  transportation: string;
}

export interface TravelItineraryData {
  destination: string;
  suggestedDuration: string;
  estimatedBudget: string;
  days: TravelDayPlan[];
  essentialTips: string[];
  bookingLinks: Array<{ label: string; url: string }>;
}

export type UserGoalType = 
  | "install_setup"          // 软件安装/部署环境/CLI操作
  | "official_portal"        // 查找官方主站/权威入口/正版服务
  | "code_implementation"    // 编写实现代码/配置框架/排查语法
  | "selection_verdict"      // 选型决策/对比选购/方案推荐
  | "troubleshooting"        // 报错排查/避坑指南/异常修复
  | "fact_lookup"            // 事实核查/真假求证/数据速查
  | "deep_learning";         // 原理探究/架构剖析/综合研报

export interface PlannedTask {
  id: string;
  title: string;
  goal: string;
  toolCapability: ToolCapabilityType;
  action: WidgetAction;
  priority: "highest" | "high" | "medium";
  executionHint?: string;
  isCompleted?: boolean;
}

export interface ActionPlan {
  userGoal: UserGoalType;
  goalStatement: string;
  nextStepVerdict: string;
  hasExecutableAction: boolean;
  requiresActionWidget: boolean;
  suggestedArchetype: CustomCardArchetype;
  primaryAction?: WidgetAction;
  tasks: PlannedTask[];
  recommendedWidgetOrder?: ResultWidgetKey[];
  guardrailAudit: {
    passed: boolean;
    actionRequirementEnforced: boolean;
    reason: string;
  };
}

export type WidgetCategoryType = "information" | "action" | "hybrid" | "comparison" | "visualization";

export interface PlannerWidgetSpec {
  id: string;
  type: ResultWidgetKey | string;
  title: string;
  category?: WidgetCategoryType;
  priority: "highest" | "high" | "medium" | "low" | string;
  size: "full" | "large" | "medium" | "small" | "compact";
  position: "primary" | "secondary";
  purpose?: string;
  actions?: WidgetAction[];
}

export interface PlannerCustomWidgetSpec {
  id: string;
  title: string;
  type?: string;
  category?: WidgetCategoryType;
  purpose?: string;
  schema?: any;
  content_schema?: any;
  importance?: "high" | "medium" | "low";
  size: "full" | "large" | "medium" | "small" | "compact";
  actions?: WidgetAction[];
}

export interface AgentUILayoutPlan {
  layout_type: LayoutStructureType;
  widgets: PlannerWidgetSpec[];
  custom_widgets?: PlannerCustomWidgetSpec[];
}

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
  agentLayoutPlan?: AgentUILayoutPlan;
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
  actionPlan?: ActionPlan;
  widgetPlan?: WidgetPlan;
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
  category?: WidgetCategoryType;
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
  actions?: WidgetAction[];
  purpose?: string;
  // 各原型专属的高阶功能数据模型
  prosConsData?: ProsConsData;
  checklistData?: ActionChecklistData;
  matrixData?: ParameterMatrixData;
  timelineData?: TimelineData;
  verdictData?: VerdictSummaryData;
  quoteData?: QuoteDossierData;
  toolDiscoveryData?: ToolDiscoveryData;
  downloadHubData?: DownloadHubData;
  travelData?: TravelItineraryData;
}
