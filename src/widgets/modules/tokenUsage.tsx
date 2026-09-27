import { WidgetModule } from "../sdk/types.js";
import { TokenUsageWidget } from "../components/TokenUsageWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：Token 消耗统计 (token_usage)
 * 25% 紧凑小组件 —— 展示本次搜索与大模型研报生成的 Prompt、Output 及总 Token 消耗与吞吐效率
 */
export const tokenUsageModule: WidgetModule = {
  ...manifestMeta("token_usage"),
  render: (ctx) => {
    return (
      <TokenUsageWidget
        result={ctx.activeResult}
        query={ctx.activeResult?.query}
        copyText={ctx.copyText}
      />
    );
  }
};
