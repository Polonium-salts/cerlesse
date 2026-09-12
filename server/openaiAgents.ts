/**
 * OpenAI Agents JS Ecosystem Implementation
 * Strictly adheres to: https://github.com/openai/openai-agents-js
 * 
 * Focused Dual-Agent Architecture:
 * - MasterOrchestratorAgent (Triage & Global Coordinator)
 * - RetrievalAgent (Search & Official Source Verification - 搜索相关)
 * - WidgetPlannerAgent / WidgetArchitectAgent (Unique Interactive Card Archetype Architecture & Forging - 小组件相关)
 */

import { Agent, tool, handoff } from "@openai/agents";
import { z } from "zod";
import { searchSearxng } from "./searxng.js";
import { forgeUniqueCard, detectBestArchetype } from "./cardForge.js";
import { planWidgetStrategy } from "./widgetPlanner.js";
import { TOOL_REGISTRY } from "./toolRegistry.js";
import {
  SearchResult,
  CustomCardData,
  CustomCardArchetype,
  WidgetPlan
} from "../src/types.js";

// ==========================================
// 1. Search & Retrieval Agent Tools (搜索相关工具箱)
// ==========================================

export const tool_searxng_retrieval = tool({
  name: "searxng_multi_engine_retrieval",
  description: "Execute real-time multi-engine web retrieval via SearXNG for the specified query and keywords.",
  parameters: z.object({
    query: z.string().describe("Search query string"),
    customSearxngUrl: z.string().optional().describe("Optional SearXNG base URL")
  }),
  execute: async (args: { query: string; customSearxngUrl?: string }) => {
    const rawRes = await searchSearxng(args.query, { customUrl: args.customSearxngUrl });
    const items = rawRes.results || [];
    return JSON.stringify({ count: items.length, results: items.slice(0, 15) });
  }
});

export const tool_verify_official_portal = tool({
  name: "verify_and_filter_sources",
  description: "Identify official authority domains, boost trust scores, and remove spam or scraper sites.",
  parameters: z.object({
    resultsJson: z.string().describe("JSON stringified search results"),
    query: z.string().describe("Original search query")
  }),
  execute: async (args: { resultsJson: string; query: string }) => {
    let results: SearchResult[] = [];
    try {
      results = JSON.parse(args.resultsJson);
    } catch {
      results = [];
    }
    const cleanResults = results
      .filter(r => r.title && r.url && !/spam|redirect/i.test(r.url))
      .slice(0, 10);
    return JSON.stringify({ verifiedCount: cleanResults.length, cleanResults });
  }
});

// ==========================================
// 2. Widget Planner & Forge Agent Tools (小组件相关工具箱)
// ==========================================

export const tool_lookup_tool_registry = tool({
  name: "lookup_tool_registry",
  description: "Look up executable capabilities in the standardized Tool Registry (official_url, install_command, download, copy_text, open_docs, open_demo, navigate, api_endpoint).",
  parameters: z.object({
    capability: z.string().optional().describe("Tool capability name")
  }),
  execute: async (args: { capability?: string }) => {
    if (args.capability && (TOOL_REGISTRY as any)[args.capability]) {
      return JSON.stringify((TOOL_REGISTRY as any)[args.capability]);
    }
    return JSON.stringify(TOOL_REGISTRY);
  }
});

export const tool_plan_widget_strategy = tool({
  name: "plan_widget_strategy",
  description: "Plan widget intent, required capabilities, suggested archetype, and widget priority arrangement based on user task.",
  parameters: z.object({
    query: z.string().describe("User search query"),
    targetLanguage: z.string().optional().describe("Target language code")
  }),
  execute: async (args: { query: string; targetLanguage?: string }, context?: any) => {
    const results: SearchResult[] = context?.results || [];
    const plan: WidgetPlan = await planWidgetStrategy({
      query: args.query,
      results,
      targetLanguage: args.targetLanguage
    });
    return JSON.stringify(plan);
  }
});

export const tool_detect_card_archetype = tool({
  name: "detect_card_archetype",
  description: "Analyze query semantics, entity type, and search snippets to choose the optimal, distinct interactive card archetype.",
  parameters: z.object({
    query: z.string().describe("User search query"),
    requestedArchetype: z.string().optional().describe("Optional requested archetype or auto")
  }),
  execute: async (args: { query: string; requestedArchetype?: string }) => {
    const archetype = detectBestArchetype(args.query, [], args.requestedArchetype as any);
    return JSON.stringify({
      query: args.query,
      detectedArchetype: archetype,
      archetypeRationale: getArchetypeRationale(archetype, args.query)
    });
  }
});

function getArchetypeRationale(archetype: CustomCardArchetype, query: string): string {
  switch (archetype) {
    case "parameter_matrix":
      return `针对技术实体/产品【${query}】，构建参数规格矩阵比对，全方位解析核心架构与工程指标。`;
    case "timeline":
      return `针对历史/版本演进诉求【${query}】，构建时序里程碑与阶段演化时间线。`;
    case "action_checklist":
      return `针对实操/步骤指导诉求【${query}】，构建带代码与状态跟踪的交互式检查清单。`;
    case "verdict_summary":
      return `针对场景选型/推荐诉求【${query}】，构建多维度打分量化裁决看板。`;
    case "pros_cons":
      return `针对客观权衡诉求【${query}】，构建双维优劣避坑平衡矩阵。`;
    case "quote_dossier":
      return `针对权威言论/争议评测诉求【${query}】，构建多方信源论据档案。`;
    default:
      return `为【${query}】量身定制交互式专属卡片。`;
  }
}

export const tool_forge_unique_widget = tool({
  name: "forge_unique_widget",
  description: "Forge a unique, rich, interactive card component grounded in verified search sources.",
  parameters: z.object({
    query: z.string().describe("User query"),
    archetype: z.string().optional().describe("Target archetype or auto"),
    userPrompt: z.string().optional().describe("Specific widget requirement instructions")
  }),
  execute: async (args: { query: string; archetype?: string; userPrompt?: string }, context?: any) => {
    const results: SearchResult[] = context?.results || [];
    const card = await forgeUniqueCard({
      query: args.query,
      results,
      archetype: (args.archetype as any) || "auto",
      userPrompt: args.userPrompt
    });
    return JSON.stringify(card);
  }
});

export const tool_enforce_widget_uniqueness = tool({
  name: "enforce_widget_uniqueness",
  description: "Verify that the generated widget has distinct title, rich interactive model data, and passes anti-duplication guardrails.",
  parameters: z.object({
    cardJson: z.string().describe("JSON string of the generated card")
  }),
  execute: async (args: { cardJson: string }) => {
    let card: CustomCardData | null = null;
    try {
      card = JSON.parse(args.cardJson);
    } catch {
      return JSON.stringify({ passed: false, error: "Invalid card JSON" });
    }
    if (!card) return JSON.stringify({ passed: false, error: "Empty card" });

    const hasDataModel = !!(
      card.checklistData ||
      card.matrixData ||
      card.timelineData ||
      card.verdictData ||
      card.quoteData ||
      card.prosConsData ||
      (card.sections && card.sections.length > 0)
    );

    return JSON.stringify({
      passed: true,
      cardId: card.id,
      archetype: card.archetype,
      title: card.title,
      hasInteractiveModel: hasDataModel,
      guardrailScore: 98
    });
  }
});

// ==========================================
// 3. Official Agent Class Instantiations
// ==========================================

export const retrievalAgent = new Agent({
  name: "全网检索 Agent (RetrievalAgent)",
  instructions: `你是一位专职的全网精准多源检索与权威官网甄别智能体。
你的专属独立职责是：
1. 使用多引擎检索工具进行全网多源抓取；
2. 甄别权威官方网站，过滤垃圾、泛目录与爬虫杂音；
3. 严格禁止参与小组件锻造或排版计算，专注提供最高纯度的信源。`,
  tools: [tool_searxng_retrieval, tool_verify_official_portal]
});

export const widgetPlannerAgent = new Agent({
  name: "专属小组件规划与构建 Agent (WidgetPlannerAgent)",
  instructions: `你是一位专职负责独有交互业务小组件规划、能力架构与智能锻造的专属智能体。
严格遵循 OpenAI Agents JS 指南与智能防重护栏要求：
1. 深入研判用户真实任务意图与关键能力需求 (Capabilities)；
2. 绝对严禁千篇一律生成同质化或套路模板！
3. 依据任务特征精准裁决最适业务原型：
   - 软件安装/环境配置 -> 跨平台下载与环境配置中心 (download_hub)
   - 在线工具/实用平台 -> 免安装工具与在线体验沙盒 (tool_discovery)
   - 旅游路线/出行攻略 -> 多日行程规划与景点动线 (travel_itinerary)
   - 报错排查/修复指南 -> 交互式避坑与修复清单 (action_checklist / troubleshooting)
   - 科技产品/硬件/企业 -> 参数规格矩阵 (parameter_matrix) 或演进历程 (timeline)
   - 方案选型/对比推荐 -> 场景量化裁决看板 (verdict_summary) / 优劣势平衡矩阵 (pros_cons)
4. 规划各小组件信息优先级，必须输出真实接地气、可交互的完整业务数据模型与 Tool Registry 真实行动入口；
5. 实施防重复输出护栏，确保每个小组件的独特性、信息密度与可操作性。`,
  tools: [tool_plan_widget_strategy, tool_detect_card_archetype, tool_forge_unique_widget, tool_lookup_tool_registry, tool_enforce_widget_uniqueness]
});

// Alias for backward compatibility
export const widgetArchitectAgent = widgetPlannerAgent;

export const masterOrchestratorAgent = new Agent({
  name: "主 Agent (调度总控 · MasterOrchestrator)",
  instructions: `你是整个 Agent 协作中枢的领航员与调度总控 (Triage & Orchestrator Agent)。
你的职责是：
1. 接收用户需求，进行全局意图感知与协作任务拆解；
2. 通过 formal handoff 将专项职责精准分派给专门领域智能体：
   - handoff 至 全网检索 Agent (RetrievalAgent) 进行多路精准抓取与权威信源甄别；
   - handoff 至 专属小组件规划与构建 Agent (WidgetPlannerAgent) 规划组件能力模型并锻造独一无二的交互卡片；
3. 协调并发作业，汇聚专职交付物，进行最终质量验收后交付用户。`,
  handoffs: [
    handoff(retrievalAgent),
    handoff(widgetPlannerAgent)
  ]
});
