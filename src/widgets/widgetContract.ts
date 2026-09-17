import { z } from "zod";
import type { ResultWidgetKey, TileWidth } from "../types.js";

/**
 * 单个选定小组件决策项 Schema
 */
export const WidgetSelectionItemSchema = z.object({
  key: z.string().describe("组件唯一键名，必须来自候选池"),
  priority: z.number().min(1).max(100).describe("优先级分数 (1-100)"),
  size: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).optional().describe("建议栅格宽度占比"),
  reason: z.string().describe("选择该组件的明确业务理由与能力对口说明"),
  confidence: z.number().min(0).max(1).describe("置信度 (0-1)")
});

export type WidgetSelectionItem = z.infer<typeof WidgetSelectionItemSchema>;

/**
 * 小组件选型决策单 Schema (Zod 契约约束)
 */
export const WidgetDecisionSchema = z.object({
  intent: z.string().describe("识别出的用户核心意图类型"),
  userGoal: z.string().describe("简要陈述用户当前检索的目标"),
  selectedWidgets: z.array(WidgetSelectionItemSchema).min(1).max(6).describe("选定的 2~5 个高对口组件列表")
});

export type WidgetDecision = z.infer<typeof WidgetDecisionSchema>;

/**
 * 候选小组件实体描述（供 Orama 语义召回与 Selector Agent 消费）
 */
export interface CandidateWidget {
  key: ResultWidgetKey;
  name: string;
  description: string;
  category: "synthesis" | "action" | "portal" | "analysis" | "custom";
  capabilities: string[];
  intents: string[];
  semanticScore: number;
  intentScore: number;
  capabilityScore: number;
  dataReadyScore: number;
  exampleMatchScore: number;
  finalScore: number;
  defaultSpan: TileWidth;
  matchedCapabilities: string[];
  reason: string;
}

/**
 * 数据就绪信号载荷
 */
export interface ContentSignalsPayload {
  summaryLength?: number;
  takeawayCount?: number;
  sourceCount?: number;
  comparisonRows?: number;
  mindMapBranches?: number;
  followUpCount?: number;
  hasOfficial?: boolean;
  customCardCount?: number;
  imageCount?: number;
  imageIntent?: boolean;
  hasMultipleEntities?: boolean;
  hasCodeSnippet?: boolean;
  hasInstallCommand?: boolean;
}
