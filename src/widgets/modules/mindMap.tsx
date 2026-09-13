import { WidgetModule } from "../sdk/types.js";
import { MindMapWidget } from "../components/MindMapWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：知识架构导图 (mindmap)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/mindmap.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：图谱画布需要方正画布容纳放射状节点，8 格 × 4:3 ≈ 830×622px。
 */
export const mindMapModule: WidgetModule = {
  ...manifestMeta("mindmap"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <MindMapWidget
        rootNode={res.mindMap}
        query={res.query}
        isDark={Boolean(document.documentElement.classList.contains("dark"))}
      />
    );
  }
};
