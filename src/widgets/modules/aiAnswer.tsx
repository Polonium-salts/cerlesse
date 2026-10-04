import { WidgetModule } from "../sdk/types.js";
import { AiAnswerWidget, AiAnswerBackWidget } from "../components/AiAnswerWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：AI 智能回答 (ai_answer)
 * 沉浸式呈现基于全网信源的 AI 深度结构化回答、要点提炼与智能拓展追问
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
        onExecuteSearch={ctx.onExecuteSearch}
        onAskFollowUp={ctx.onAskFollowUp}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
        flipTile={ctx.flipTile}
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
        onExecuteSearch={ctx.onExecuteSearch}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
        flipTile={ctx.flipTile}
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
