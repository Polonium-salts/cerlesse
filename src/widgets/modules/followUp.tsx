import { WidgetModule } from "../sdk/types.js";
import { FollowUpWidget } from "../components/FollowUpWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：延伸追问 (followup)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/followup.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：高瘦 4:5 纵条，4 格 ≈ 365×456px，纵向容纳 3~4 个问题，
 * 同时为桌面制造垂直节奏。
 */
export const followUpModule: WidgetModule = {
  ...manifestMeta("followup"),
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
