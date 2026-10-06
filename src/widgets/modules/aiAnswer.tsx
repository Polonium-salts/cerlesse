import { WidgetModule } from "../sdk/types.js";
import { AiAnswerWidget, AiAnswerBackWidget } from "../components/AiAnswerWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：AI 智能回答 (ai_answer)
 * ask 模式：只渲染 AI 回答正文与 ReAct-Read 循环思维链，
 * 不提供任何组件内提问入口（推荐追问、重搜、输入框），提问统一走顶部搜索栏。
 */
export const aiAnswerModule: WidgetModule = {
  ...manifestMeta("ai_answer"),
  data: (result) => {
    const rawSummary =
      result?.summary ||
      (result as any)?.answer ||
      (result as any)?.content ||
      (result as any)?.chatText ||
      (result as any)?.text ||
      (result as any)?.finalResponse ||
      "";
    return {
      status: "ready",
      data: {
        query: result?.query || "",
        summary: rawSummary,
        activeResult: result
      }
    };
  },
  render: (ctx) => {
    const res = ctx.activeResult || ctx.data?.activeResult || (ctx.data ? { ...ctx.data, query: ctx.data.query, summary: ctx.data.summary } : undefined);
    const summary = ctx.activeResult?.summary || ctx.data?.summary || (res as any)?.summary || (res as any)?.chatText || (res as any)?.answer || "";
    return (
      <AiAnswerWidget
        result={res ? { ...res, summary: summary || res.summary } : (summary ? ({ query: ctx.activeResult?.query, summary } as any) : undefined)}
        summary={summary}
        query={ctx.activeResult?.query || ctx.data?.query}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
        flipTile={ctx.flipTile}
        agentSteps={ctx.agentSteps || ctx.data?.agentSteps || res?.steps}
        language={ctx.language}
        askModeHint
      />
    );
  },
  renderBack: (ctx) => {
    const res = ctx.activeResult || ctx.data?.activeResult || (ctx.data ? { ...ctx.data, query: ctx.data.query, summary: ctx.data.summary } : undefined);
    const summary = ctx.activeResult?.summary || ctx.data?.summary || (res as any)?.summary || (res as any)?.chatText || (res as any)?.answer || "";
    return (
      <AiAnswerBackWidget
        result={res ? { ...res, summary: summary || res.summary } : (summary ? ({ query: ctx.activeResult?.query, summary } as any) : undefined)}
        summary={summary}
        query={ctx.activeResult?.query || ctx.data?.query}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
        flipTile={ctx.flipTile}
        language={ctx.language}
      />
    );
  },
  actions: {
    copyAnswer: (ctx) => {
      const summary = ctx.activeResult?.summary || ctx.data?.summary;
      if (summary && ctx.copyText) {
        ctx.copyText(summary);
      }
    }
  }
};
