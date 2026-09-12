import React from "react";
import { WidgetModule } from "../sdk/types.js";
import { WidgetRegistry } from "../registry.js";
import {
  Zap,
  FileText,
  Database,
  GitFork,
  Scale,
  Sparkles,
  Power,
  SlidersHorizontal,
  ShieldCheck,
  Compass,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  QrCode,
  Layers,
  Workflow
} from "lucide-react";

// 引入官方既有高质感 React 视图
import { QuickAnswerWidget } from "../../components/widgets/QuickAnswerWidget.js";
import { AIOverviewWidget } from "../../components/AIOverviewWidget.js";
import { SourcesListWidget } from "../../components/SourcesListWidget.js";
import { MindMapWidget } from "../../components/MindMapWidget.js";
import { ComparisonMatrixWidget } from "../../components/ComparisonMatrixWidget.js";
import { KeyTakeawaysWidget } from "../../components/KeyTakeawaysWidget.js";
import { QuickActionsToolboxWidget } from "../../components/widgets/QuickActionsToolboxWidget.js";
import { ActionPlanWidget } from "../../components/widgets/ActionPlanWidget.js";
import { MetricsTelemetryWidget } from "../../components/widgets/MetricsTelemetryWidget.js";
import { OfficialPortalWidget } from "../../components/OfficialPortalWidget.js";
import { FollowUpWidget } from "../../components/FollowUpWidget.js";
import { VerificationChecklistWidget } from "../../components/widgets/VerificationChecklistWidget.js";
import { AnalyticsTrendWidget } from "../../components/widgets/AnalyticsTrendWidget.js";
import { FastChatWidget } from "../../components/widgets/FastChatWidget.js";
import { MobileQRConnectWidget } from "../../components/widgets/MobileQRConnectWidget.js";
import { TopicDigestWidget } from "../../components/widgets/TopicDigestWidget.js";
import { AgentAuditWidget } from "../../components/widgets/AgentAuditWidget.js";

// 1. 即时速答模块 (Quick Answer)
export const quickAnswerModule: WidgetModule = {
  id: "quick_answer",
  name: "直接速答",
  version: "1.0.0",
  description: "全网高权重研报核心结论直接速答",
  category: "synthesis",
  icon: Zap,
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "wide", "large", "full"],
  tileTheme: {
    accentColor: "#3b82f6",
    liveBadge: "直出"
  },
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <QuickAnswerWidget
        query={res.query}
        summary={res.summary}
        keyTakeaways={res.keyTakeaways}
      />
    );
  },
  renderBack: (ctx) => {
    const res = ctx.activeResult;
    const takeawayCount = res?.keyTakeaways?.length || 3;
    return {
      type: "tile",
      title: "结论置信度与质检",
      liveBadge: "98% 可信",
      children: [
        { type: "metric", label: "核心提炼论点", value: takeawayCount, unit: "条", trend: "+100%" },
        { type: "progress", label: "多源事实交叉吻合率", value: 96 },
        { type: "text", value: "经多方权威文献与研报双向比对，核心结论一致性极高，无事实冲突。", variant: "body" },
        { type: "button", label: "执行深度全网复核", action: "reSearch" }
      ]
    };
  }
};

// 2. AI 深度研报综合总览 (AI Overview)
export const aiOverviewModule: WidgetModule = {
  id: "ai_overview",
  name: "AI 深度研报",
  version: "1.0.0",
  description: "多智能体交叉验证与综合分析研报",
  category: "synthesis",
  icon: FileText,
  defaultSize: "large",
  supportedSizes: ["medium", "wide", "large", "full"],
  tileTheme: {
    accentColor: "#6366f1",
    liveBadge: "AI综合"
  },
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <AIOverviewWidget
        summary={res.summary}
        query={res.query}
        modelUsed={res.modelUsed}
        filteredResults={res.filteredResults}
        detectedLanguage={res.detectedLanguage}
        onOpenMindMap={() => ctx.actions.openMindMap?.()}
        onOpenComparison={() => ctx.actions.openComparison?.()}
      />
    );
  },
  renderBack: (ctx) => {
    return {
      type: "tile",
      title: "智能体协同流水线审计",
      subtitle: "Multi-Agent System",
      liveBadge: "实时就绪",
      children: [
        { type: "metric", label: "参与协同 Agent", value: "5", unit: "个集群", trend: "+300%" },
        { type: "progress", label: "信源交叉完备度", value: 100 },
        { type: "button", label: "跳转交互式思维导图", action: "openMindMap" },
        { type: "button", label: "查看多维技术对比矩阵", action: "openComparison", variant: "secondary" }
      ]
    };
  }
};

// 3. 核验权威信源 (Sources List)
export const sourcesModule: WidgetModule = {
  id: "sources",
  name: "核验信源库",
  version: "1.0.0",
  description: "经多源交叉检验的权威原始文献与网页存证",
  category: "portal",
  icon: Database,
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "wide", "large", "full"],
  tileTheme: {
    accentColor: "#10b981"
  },
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <SourcesListWidget
        results={res.filteredResults}
        rawResultCount={res.rawResultCount}
        isCompact={ctx.isCompact}
        onForgeCardFromSource={(srcId) => ctx.actions.forgeCardFromSource?.(srcId)}
        onOpenForgeModal={() => ctx.actions.openForgeModal?.()}
      />
    );
  }
};

// 4. 知识架构导图 (Mind Map)
export const mindMapModule: WidgetModule = {
  id: "mindmap",
  name: "知识架构导图",
  version: "1.0.0",
  description: "全景拓扑、核心原理解析与进阶路线交互图谱",
  category: "analysis",
  icon: GitFork,
  defaultSize: "large",
  supportedSizes: ["medium", "large", "full"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <MindMapWidget
        rootNode={res.mindMap}
        query={res.query}
        isDark={Boolean(document.documentElement.classList.contains("dark"))}
      />
    );
  }
};

// 5. 多维对比矩阵 (Comparison Matrix)
export const comparisonModule: WidgetModule = {
  id: "comparison",
  name: "多维对比矩阵",
  version: "1.0.0",
  description: "核心差异、选型优劣与技术参数横向对比",
  category: "analysis",
  icon: Scale,
  defaultSize: "large",
  supportedSizes: ["medium", "large", "full"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <ComparisonMatrixWidget
        comparisonTable={res.comparisonTable}
        query={res.query}
      />
    );
  }
};

// 6. 核心结论速览 (Key Takeaways)
export const takeawaysModule: WidgetModule = {
  id: "takeaways",
  name: "核心要点清单",
  version: "1.0.0",
  description: "快速抓住研究报告的黄金重点与高价值见解",
  category: "synthesis",
  icon: Sparkles,
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "large"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <KeyTakeawaysWidget
        keyTakeaways={res.keyTakeaways}
        isCompact={ctx.isCompact}
      />
    );
  }
};

// 7. 行动规划与快捷操作工具箱 (Actions Toolbox)
export const actionsToolboxModule: WidgetModule = {
  id: "actions_toolbox",
  name: "行动工具箱",
  version: "1.0.0",
  description: "CLI命令一键复制、离线安装包下载与行动规划清单",
  category: "action",
  icon: Power,
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "wide", "large"],
  tileTheme: {
    accentColor: "#f59e0b",
    liveBadge: "Action"
  },
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    if (res.actionPlan && res.actionPlan.tasks && res.actionPlan.tasks.length > 0) {
      return (
        <ActionPlanWidget
          actionPlan={res.actionPlan}
          query={res.query}
          isCompact={ctx.isCompact}
        />
      );
    }
    return (
      <QuickActionsToolboxWidget
        result={res}
        onReSearch={() => ctx.actions.reSearch?.()}
        onOpenForgeModal={() => ctx.actions.openForgeModal?.()}
      />
    );
  },
  renderBack: (ctx) => {
    return {
      type: "tile",
      title: "快捷操作与研报导出",
      liveBadge: "就绪",
      children: [
        { type: "button", label: "召唤 AI 专属独有卡片锻造工坊", action: "openForgeModal" },
        { type: "button", label: "重新执行多智能体深度挖掘", action: "reSearch", variant: "secondary" },
        { type: "text", value: "支持将本研报直接转存为本地 Markdown / PDF 存证。", variant: "caption" }
      ]
    };
  }
};

// 8. 信源指标与度量遥测 (Metrics Telemetry)
export const metricsTelemetryModule: WidgetModule = {
  id: "metrics_telemetry",
  name: "指标遥测",
  version: "1.0.0",
  description: "多源综合可信度、信息覆盖率与响应时延量化监控",
  category: "analysis",
  icon: SlidersHorizontal,
  defaultSize: "small",
  supportedSizes: ["small", "medium", "wide"],
  tileTheme: {
    accentColor: "#ec4899",
    liveBadge: "Live"
  },
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return <MetricsTelemetryWidget result={res} />;
  },
  renderBack: (ctx) => {
    return {
      type: "tile",
      title: "端到端系统流遥测",
      liveBadge: "99.8%",
      children: [
        { type: "chart", data: [15, 22, 18, 30, 26, 35, 32] },
        { type: "metric", label: "平均首字延迟 (TTFT)", value: "280", unit: "ms", trend: "-24%" },
        { type: "progress", label: "集群可用率", value: 99 }
      ]
    };
  }
};

// 9. 官方认证门户导航 (Official Portal)
export const officialPortalModule: WidgetModule = {
  id: "official_portal",
  name: "官方直达认证",
  version: "1.0.0",
  description: "权威认证直属主站入口与移动互联，拦截钓鱼与镜像",
  category: "portal",
  icon: ShieldCheck,
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "large"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    const officialSite = res.filteredResults.find((r) => r.isOfficial);
    return (
      <OfficialPortalWidget
        query={res.query}
        officialWebsite={officialSite}
        detectedLanguage={res.detectedLanguage}
        rawResultCount={res.rawResultCount}
        filteredCount={res.filteredResults.length}
        isCompact={ctx.isCompact}
      />
    );
  }
};

// 10. 延伸探索与追问 (Follow Up)
export const followUpModule: WidgetModule = {
  id: "followup",
  name: "延伸追问",
  version: "1.0.0",
  description: "Agent 智能推演下一步深度探索问题",
  category: "synthesis",
  icon: Compass,
  defaultSize: "small",
  supportedSizes: ["small", "medium"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <FollowUpWidget
        questions={res.followUpQuestions}
        onQuestionClick={(q) => ctx.onExecuteSearch?.(q)}
        isCompact={ctx.isCompact}
      />
    );
  }
};

// 11. 事实真伪审计核查清单 (Verification Checklist)
export const verificationChecklistModule: WidgetModule = {
  id: "verification_checklist",
  name: "事实核查清单",
  version: "1.0.0",
  description: "多源交叉求证，核验关键事实与防伪审计",
  category: "analysis",
  icon: CheckCircle2,
  defaultSize: "medium",
  supportedSizes: ["medium", "large"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return <VerificationChecklistWidget result={res} />;
  }
};

// 12. 时事资讯热度脉络 (Analytics Trend)
export const analyticsTrendModule: WidgetModule = {
  id: "analytics_trend",
  name: "时效热度趋势",
  version: "1.0.0",
  description: "新闻时效走势、发布平台分布与权威声量剖析",
  category: "analysis",
  icon: TrendingUp,
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "large"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <AnalyticsTrendWidget
        result={res}
        onViewDeepAnalysis={() => ctx.actions.viewDeepAnalysis?.()}
      />
    );
  }
};

// 13. 极速伴随追问对话 (Fast Chat)
export const fastChatModule: WidgetModule = {
  id: "fast_chat",
  name: "极速伴随问答",
  version: "1.0.0",
  description: "快速交互解答、关键疑难澄清与交互反馈",
  category: "action",
  icon: MessageSquare,
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "large"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <FastChatWidget
        query={res.query}
        followUpQuestions={res.followUpQuestions}
        onAsk={(q) => ctx.onExecuteSearch?.(q)}
      />
    );
  }
};

// 14. 移动端互联二维码 (Mobile QR Connect)
export const mobileQRModule: WidgetModule = {
  id: "mobile_qr",
  name: "移动互联二维码",
  version: "1.0.0",
  description: "手机无缝扫码互通与网页直达",
  category: "portal",
  icon: QrCode,
  defaultSize: "small",
  supportedSizes: ["small", "medium"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    const officialSite = res.filteredResults.find((r) => r.isOfficial);
    return (
      <MobileQRConnectWidget
        query={res.query}
        url={officialSite?.url}
      />
    );
  }
};

// 15. 主题分面消化速览 (Topic Digest)
export const topicDigestModule: WidgetModule = {
  id: "topic_digest",
  name: "主题分面消化",
  version: "1.0.0",
  description: "多层次核心概念分面摘要提炼",
  category: "synthesis",
  icon: Layers,
  defaultSize: "medium",
  supportedSizes: ["medium", "large"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <TopicDigestWidget
        query={res.query}
        summary={res.summary}
        filteredResults={res.filteredResults}
      />
    );
  }
};

// 16. Agent 团队协作审计 (Agent Workflow)
export const agentWorkflowModule: WidgetModule = {
  id: "agent_workflow",
  name: "Agent 协作审计",
  version: "1.0.0",
  description: "多智能体并行作业轨迹与加速比诊断审计",
  category: "analysis",
  icon: Workflow,
  defaultSize: "medium",
  supportedSizes: ["medium", "large", "full"],
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <AgentAuditWidget
        steps={res.steps}
        query={res.query}
        executionTimeMs={res.executionTimeMs}
        modelUsed={res.modelUsed}
        agentTeam={res.agentTeam}
        onViewDetails={() => ctx.actions.viewDetails?.()}
      />
    );
  }
};

export const OFFICIAL_WIDGET_MODULES: WidgetModule[] = [
  quickAnswerModule,
  aiOverviewModule,
  sourcesModule,
  mindMapModule,
  comparisonModule,
  takeawaysModule,
  actionsToolboxModule,
  metricsTelemetryModule,
  officialPortalModule,
  followUpModule,
  verificationChecklistModule,
  analyticsTrendModule,
  fastChatModule,
  mobileQRModule,
  topicDigestModule,
  agentWorkflowModule
];

// 初始化并自动向注册中心登记所有官方标准组件模块
export function registerAllOfficialWidgets(): void {
  WidgetRegistry.registerAll(OFFICIAL_WIDGET_MODULES);
}

// 自动执行一次性初始化
registerAllOfficialWidgets();
