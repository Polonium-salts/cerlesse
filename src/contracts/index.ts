import { z } from "zod";

/**
 * 契约定义：模型信息
 */
export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextWindow: z.number().optional(),
  contextLength: z.string().optional(),
  description: z.string().optional(),
  pricing: z.string().optional(),
  isRecommended: z.boolean().optional()
});

/**
 * 契约定义：模型供应商状态
 */
export const ModelProviderStatusSchema = z.object({
  provider: z.enum(["deepseek", "openrouter", "unorouter", "openai", "groq", "none"]).or(z.string()),
  ready: z.boolean(),
  hasApiKey: z.boolean().optional(),
  isAiApiDisabled: z.boolean().optional(),
  reason: z.string().optional(),
  models: z.array(ModelInfoSchema).default([]),
  defaultModel: z.string().optional(),
  hasCustomSearxngUrl: z.boolean().optional(),
  supportedLanguages: z.union([z.array(z.string()), z.record(z.string(), z.any())]).optional()
});

/**
 * 契约定义：小组件规划项
 */
export const WidgetPlanItemSchema = z.object({
  widgetId: z.string(),
  presence: z.enum(["conditional", "resident"]).default("conditional"),
  gridWidth: z.union([z.literal(25), z.literal(33), z.literal(50), z.literal(66), z.literal(75), z.literal(100)]).default(50),
  hasRenderer: z.boolean().default(true),
  priority: z.number().optional(),
  title: z.string().optional(),
  reason: z.string().optional()
});

/**
 * 契约定义：Agent 流式事件规范
 */
export const AgentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    message: z.string(),
    phase: z.string().optional()
  }),
  z.object({
    type: z.literal("step"),
    message: z.string(),
    toolName: z.string().optional(),
    toolInput: z.any().optional(),
    resultCount: z.number().optional()
  }),
  z.object({
    type: z.literal("tool_call"),
    tool: z.string(),
    callId: z.string().optional(),
    input: z.any().optional()
  }),
  z.object({
    type: z.literal("tool_result"),
    tool: z.string(),
    callId: z.string().optional(),
    output: z.any().optional()
  }),
  z.object({
    type: z.literal("token"),
    content: z.string()
  }),
  z.object({
    type: z.literal("widget_plan"),
    items: z.array(WidgetPlanItemSchema)
  }),
  z.object({
    type: z.literal("provider_error"),
    message: z.string(),
    retryable: z.boolean().default(false)
  }),
  z.object({
    type: z.literal("error"),
    error: z.string()
  }),
  z.object({
    type: z.literal("complete"),
    payload: z.any()
  }),
  z.object({
    type: z.literal("done")
  })
]);

export type ModelInfo = z.infer<typeof ModelInfoSchema>;
export type ModelProviderStatus = z.infer<typeof ModelProviderStatusSchema>;
export type WidgetPlanItem = z.infer<typeof WidgetPlanItemSchema>;
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;
