import { WidgetModule } from "../sdk/types.js";
import { AiAnswerWidget, AiAnswerBackWidget } from "../components/AiAnswerWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：AI 智能回答 (ai_answer)
 * 沉浸式呈现基于全网信源的 AI 深度结构化回答、要点提炼与智能拓展追问
 */
export const aiAnswerModule: WidgetModule = {
  ...manifestMeta("ai_answer"),
  render: (ctx) => {
    return (
      <AiAnswerWidget
        result={ctx.activeResult}
        query={ctx.activeResult?.query}
        onExecuteSearch={ctx.onExecuteSearch}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
        flipTile={ctx.flipTile}
      />
    );
  },
  renderBack: (ctx) => {
    return (
      <AiAnswerBackWidget
        result={ctx.activeResult}
        query={ctx.activeResult?.query}
        onExecuteSearch={ctx.onExecuteSearch}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
        flipTile={ctx.flipTile}
      />
    );
  },
  actions: {
    copyAnswer: (ctx) => {
      if (ctx.activeResult?.summary && ctx.copyText) {
        ctx.copyText(ctx.activeResult.summary);
      }
    }
  }
};
