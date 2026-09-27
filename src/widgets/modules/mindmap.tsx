import { WidgetModule } from "../sdk/types.js";
import { MindMapWidget } from "../components/MindMapWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：知识架构拓扑 (mindmap)
 */
export const mindmapModule: WidgetModule = {
  ...manifestMeta("mindmap"),
  render: (ctx) => {
    return (
      <MindMapWidget
        activeResult={ctx.activeResult}
        query={ctx.activeResult?.query}
        isCompact={ctx.isCompact}
      />
    );
  }
};
