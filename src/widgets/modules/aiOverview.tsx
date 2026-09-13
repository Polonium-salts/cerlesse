import { WidgetModule } from "../sdk/types.js";
import { AIOverviewWidget } from "../components/AIOverviewWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：AI 深度研报 (ai_overview)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/ai_overview.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：主研报长文需要最大版面，8 格 × 4:3 ≈ 830×622px。
 */
export const aiOverviewModule: WidgetModule = {
  ...manifestMeta("ai_overview"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <AIOverviewWidget
        summary={res.summary}
        query={res.query}
        modelUsed={res.modelUsed}
        filteredResults={res.filteredResults}
      />
    );
  }
  // 背面已移除：原来的「智能体协同流水线审计」是一组编造指标
  // （参与 Agent 5 个集群 / +300% / 信源交叉完备度 100%），
  // 两个按钮指向的 openMindMap / openComparison 也从未在本模块登记 actions。
};
