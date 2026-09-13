import { WidgetModule } from "../sdk/types.js";
import { FastChatWidget } from "../components/FastChatWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：极速伴随问答 (fast_chat)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/fast_chat.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：高瘦 4:5，4 格 ≈ 365×456px（6 格时高 769px 会触碰 720px
 * 高度上限被收窄）。
 */
export const fastChatModule: WidgetModule = {
  ...manifestMeta("fast_chat"),
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
