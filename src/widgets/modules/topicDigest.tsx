import { WidgetModule } from "../sdk/types.js";
import { TopicDigestWidget } from "../components/TopicDigestWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：主题分面消化 (topic_digest)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/topic_digest.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：分页控件需要额外行高，3:2 时专题条被裁，故按 DOM 审计抬到 4:3。
 */
export const topicDigestModule: WidgetModule = {
  ...manifestMeta("topic_digest"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <TopicDigestWidget
        query={res.query}
        summary={res.summary}
        filteredResults={res.filteredResults}
      />
    );
  }
};
