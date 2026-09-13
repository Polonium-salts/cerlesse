import { WidgetModule } from "../sdk/types.js";
import { AgentAuditWidget } from "../components/AgentAuditWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：Agent 协作审计 (agent_workflow)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/agent_workflow.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：底部带操作条的流程类，2:1 时末行被裁，故按 DOM 审计抬到 3:2。
 */
export const agentWorkflowModule: WidgetModule = {
  ...manifestMeta("agent_workflow"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <AgentAuditWidget
        steps={res.steps}
        query={res.query}
        executionTimeMs={res.executionTimeMs}
        modelUsed={res.modelUsed}
        agentTeam={res.agentTeam}
        onViewDetails={() => ctx.actions.viewDetails?.()}
      />
    );
  }
};
