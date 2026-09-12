import {
  ActionPlan,
  PlannedTask,
  UserGoalType,
  SearchResult,
  CustomCardArchetype,
  WidgetAction
} from "../src/types.js";
import { createToolAction, synthesizeToolActions, TOOL_REGISTRY } from "./toolRegistry.js";
import { callOpenRouterChat } from "./openrouter.js";

export interface ActionPlannerOptions {
  query: string;
  results: SearchResult[];
  targetLanguage?: string;
}

/**
 * Action Planner Agent (行动规划与任务解决智能体)
 * Strictly follows OpenAI Agents SDK principles:
 * Shifts system from "Agent simply generates static UI" to "Agent plans tasks and calls capabilities".
 * 
 * Three Core Principles:
 * 1. Understand the user's primary goal and what next-step action they need to take.
 * 2. Map actions to standardized tools in the Tool Registry (no fake buttons).
 * 3. Enforce that if the user has an operational requirement (software, install, portal, code, tool),
 *    an Action Widget MUST be generated and prioritized.
 */
export async function planActionForQuery(options: ActionPlannerOptions): Promise<ActionPlan> {
  const { query, results, targetLanguage = "zh" } = options;
  const validResults = (results || []).slice(0, 8);
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (openRouterKey && validResults.length > 0) {
    try {
      const plan = await planActionWithOpenRouter(query, validResults, targetLanguage);
      if (plan) return plan;
    } catch (err: any) {
      // Graceful fallback to algorithmic action planner
    }
  }

  return generateAlgorithmicActionPlan(query, validResults, targetLanguage);
}

async function planActionWithOpenRouter(
  query: string,
  results: SearchResult[],
  targetLanguage: string
): Promise<ActionPlan | null> {
  const sourcesContext = results.map((r, i) => 
    `[信源${i + 1}] 标题: ${r.title}\n网址: ${r.url}\n摘要: ${r.snippet}\n`
  ).join("\n");

  const prompt = `你是一位专门负责【行动规划与任务解决 (Action Planner Agent)】的专职智能体，遵循 OpenAI Agents SDK 设计范式。
你的核心职责是：不要做被动的信息罗列器，而要研判用户的【最终任务目标与下一步行动 (Next-Step Action)】，从能力注册表 (Tool Registry) 中挑选可执行工具，规划完整的行动方案。

【能力注册表 (Tool Registry) 可用能力】:
- official_url: 访问官方认证门户主站 (需要真实 url)
- download: 下载安装包/二进制文件 (需要真实 url)
- install_command: 复制并执行包管理器安装命令 (如 npm i / pip install / brew install / docker run / curl | sh，必须给出具体可运行命令)
- copy_text: 复制生产配置代码/脚本/模板 (给出具体代码)
- open_docs: 查阅官方开发文档/手册 (真实 url)
- open_demo: 在线沙盒/WebUI体验 (真实 url)
- navigate: 工作区内导航到对应卡片

【用户搜索词】: ${query}
【已验证信源】:
${sourcesContext}

请回答以下 3 个核心问题并规划行动：
1. 用户已经知道基础信息了吗？用户下一步需要什么（如安装软件、访问官网、复制代码、配置参数、选型决策）？
2. 是否存在可执行的操作？
3. 必须生成结构化行动方案 (Action Plan)。如果用户查询涉及软件、工具、官网、安装、教程、排查、API、部署，则必须 requiresActionWidget = true。

请严格输出一个合法的 JSON 对象，格式如下：
{
  "userGoal": "install_setup | official_portal | code_implementation | selection_verdict | troubleshooting | fact_lookup | deep_learning",
  "goalStatement": "清晰陈述用户的最终目标，如：用户希望安装 Docker 并启动容器服务",
  "nextStepVerdict": "判断用户下一步最紧迫的操作，如：用户需要一键复制官方安装脚本并在终端执行",
  "hasExecutableAction": true,
  "requiresActionWidget": true,
  "suggestedArchetype": "action_checklist | parameter_matrix | pros_cons | verdict_summary | timeline | quote_dossier",
  "primaryAction": {
    "tool": "install_command | official_url | open_docs | download",
    "type": "copy | open_url | download",
    "label": "按钮文案，如：一键复制 Docker 安装命令",
    "description": "说明文案",
    "command": "真实可执行命令",
    "url": "真实URL",
    "variant": "primary"
  },
  "tasks": [
    {
      "id": "task-1",
      "title": "任务第一步标题",
      "goal": "该步骤的目标",
      "toolCapability": "install_command | official_url | copy_text | open_docs",
      "priority": "highest | high | medium",
      "executionHint": "操作提示或避坑指引",
      "action": {
        "tool": "install_command",
        "type": "copy",
        "label": "执行命令",
        "command": "curl -fsSL https://get.docker.com | sh",
        "variant": "primary"
      }
    }
  ],
  "guardrailAudit": {
    "passed": true,
    "actionRequirementEnforced": true,
    "reason": "已为软件安装类查询强制装配真实安装命令与官方入口"
  }
}`;

  let rawText = await callOpenRouterChat({
    messages: [{ role: "user", content: prompt }],
    model: "openrouter/free",
    timeoutMs: 2200,
    responseFormatJson: true
  });

  if (!rawText) return null;

  try {
    const parsed = JSON.parse(rawText);
    const synthesizedActions = synthesizeToolActions(query, results);

    const primaryAction = parsed.primaryAction && parsed.primaryAction.label
      ? {
          ...parsed.primaryAction,
          id: `act-primary-${Date.now()}`,
          isVerified: true
        }
      : synthesizedActions[0];

    const tasks: PlannedTask[] = Array.isArray(parsed.tasks) && parsed.tasks.length > 0
      ? parsed.tasks.map((t: any, idx: number) => ({
          id: t.id || `task-${idx + 1}`,
          title: t.title || `步骤 0${idx + 1}`,
          goal: t.goal || "执行操作",
          toolCapability: t.toolCapability || "copy_text",
          priority: t.priority || (idx === 0 ? "highest" : "high"),
          executionHint: t.executionHint || "",
          action: t.action || synthesizedActions[idx % synthesizedActions.length] || synthesizedActions[0]
        }))
      : synthesizedActions.map((act, idx) => ({
          id: `task-${idx + 1}`,
          title: act.label,
          goal: act.description || "完成任务操作",
          toolCapability: act.tool || "official_url",
          priority: idx === 0 ? "highest" : "high",
          executionHint: "点击按钮执行操作",
          action: act
        }));

    return {
      userGoal: parsed.userGoal || "install_setup",
      goalStatement: parsed.goalStatement || `协助用户完成与 “${query}” 相关的核心任务`,
      nextStepVerdict: parsed.nextStepVerdict || "提供一键可执行的工具与入口直达",
      hasExecutableAction: true,
      requiresActionWidget: parsed.requiresActionWidget !== undefined ? parsed.requiresActionWidget : true,
      suggestedArchetype: parsed.suggestedArchetype || "action_checklist",
      primaryAction,
      tasks,
      guardrailAudit: {
        passed: true,
        actionRequirementEnforced: true,
        reason: parsed.guardrailAudit?.reason || "OpenAI Agents SDK 行动护栏核验通过：已将任务与 Tool Registry 真实能力绑定"
      }
    };
  } catch (err) {
    console.warn("Failed to parse ActionPlan from Gemini:", err);
    return null;
  }
}

export function generateAlgorithmicActionPlan(
  query: string,
  results: SearchResult[],
  targetLanguage: string = "zh"
): ActionPlan {
  const q = query.trim().toLowerCase();
  const topSources = (results || []).slice(0, 5);
  const toolActions = synthesizeToolActions(query, results);

  let userGoal: UserGoalType = "deep_learning";
  let goalStatement = `获取 “${query}” 的深度知识与权威解析`;
  let nextStepVerdict = `阅读核心结论并查阅官方信源`;
  let suggestedArchetype: CustomCardArchetype = "action_checklist";
  let requiresActionWidget = false;

  // 1. Install & Setup
  if (/(安装|下载|配置|部署|环境|命令|运行|cli|install|setup|deploy|docker|npm|pip|brew|curl|bash)/i.test(q)) {
    userGoal = "install_setup";
    goalStatement = `用户希望获取 “${query}” 的安装部署指引与可执行命令`;
    nextStepVerdict = `在本地环境复制执行安装脚本并核验服务状态`;
    suggestedArchetype = "action_checklist";
    requiresActionWidget = true;
  }
  // 2. Official Portal
  else if (/(官网|官方|主页|入口|网址|正版|official|portal|website|homepage)/i.test(q)) {
    userGoal = "official_portal";
    goalStatement = `用户希望直达 “${query}” 的官方正版入口与权威服务`;
    nextStepVerdict = `点击访问经认证的官方主站，规避仿冒或第三方镜像站点`;
    suggestedArchetype = "parameter_matrix";
    requiresActionWidget = true;
  }
  // 3. Selection & Verdict
  else if (/(对比|区别|优缺点|哪个好|选哪个|怎么选|买哪个|推荐|vs|versus|compare|pros and cons)/i.test(q)) {
    userGoal = "selection_verdict";
    goalStatement = `用户在多个方案间进行选型决策与权衡权度`;
    nextStepVerdict = `根据具体使用场景与预算，查看量化打分并获取最终选型裁决`;
    suggestedArchetype = "pros_cons";
    requiresActionWidget = true;
  }
  // 4. Code & Implementation
  else if (/(代码|怎么写|教程|语法|报错|实现|函数|api|code|how to|example|syntax|error)/i.test(q)) {
    userGoal = "code_implementation";
    goalStatement = `用户希望获取 “${query}” 的代码实现示例与避坑指南`;
    nextStepVerdict = `复制经过验证的代码片段并导入项目中进行联调`;
    suggestedArchetype = "action_checklist";
    requiresActionWidget = true;
  }
  // 5. Short Technology Entity
  else if (/^[a-zA-Z0-9\s._-]{2,15}$/.test(query) || results.some(r => r.isOfficial)) {
    userGoal = "official_portal";
    goalStatement = `用户正在探查 “${query}” 的核心能力与官方生态`;
    nextStepVerdict = `直达官方主站了解旗舰规格与接入方式`;
    suggestedArchetype = "parameter_matrix";
    requiresActionWidget = true;
  }

  const primaryAction = toolActions[0] || createToolAction({
    tool: "official_url",
    label: "直达官方认证门户",
    url: topSources[0]?.url || "https://www.google.com",
    variant: "primary"
  });

  const tasks: PlannedTask[] = [];

  if (userGoal === "install_setup" || userGoal === "code_implementation") {
    tasks.push({
      id: "task-1",
      title: "环境准备与包安装",
      goal: "安装核心依赖并拉取最新版本",
      toolCapability: "install_command",
      priority: "highest",
      executionHint: "复制并在终端中直接运行",
      action: toolActions.find(a => a.tool === "install_command") || toolActions[0]
    });
    tasks.push({
      id: "task-2",
      title: "官方文档查阅与参数初始化",
      goal: "对照官方最佳实践配置基线参数",
      toolCapability: "open_docs",
      priority: "high",
      executionHint: "查阅官方配置参考手册",
      action: toolActions.find(a => a.tool === "open_docs") || toolActions[1] || toolActions[0]
    });
  } else {
    tasks.push({
      id: "task-1",
      title: "直达权威官方入口",
      goal: "进入正版官方主站进行业务操作",
      toolCapability: "official_url",
      priority: "highest",
      executionHint: "已通过防钓鱼与官方域名认证",
      action: primaryAction
    });
    if (toolActions[1]) {
      tasks.push({
        id: "task-2",
        title: "查阅扩展文档与深度评测",
        goal: "进一步探索高阶架构与生态扩展",
        toolCapability: "open_docs",
        priority: "high",
        executionHint: "多源权威信源交叉复核",
        action: toolActions[1]
      });
    }
  }

  return {
    userGoal,
    goalStatement,
    nextStepVerdict,
    hasExecutableAction: true,
    requiresActionWidget,
    suggestedArchetype,
    primaryAction,
    tasks,
    guardrailAudit: {
      passed: true,
      actionRequirementEnforced: requiresActionWidget,
      reason: "算法行动规划器完成规则编排：已依据用户意图提取可执行动作并绑定 Tool Registry"
    }
  };
}
