import { solveLayoutTool } from "../tools/layoutTool.js";
import { filterAndSanitizeWidgetTypes } from "../widgetPlanner.js";

export function executeLayoutSolve(params: {
  widgetIds?: string[];
  widgetPlan?: { selectedWidgets?: any[]; widgetOrder?: string[] };
}) {
  const { widgetIds, widgetPlan } = params;
  let targetIds: string[] = [];

  if (Array.isArray(widgetIds)) {
    targetIds = widgetIds;
  } else if (widgetPlan?.selectedWidgets) {
    targetIds = widgetPlan.selectedWidgets.map((w: any) => w.type || w.id);
  } else if (widgetPlan?.widgetOrder) {
    targetIds = widgetPlan.widgetOrder;
  } else {
    targetIds = ["related_links", "takeaways"];
  }

  // 严格过滤无 manifest 或渲染模块的类型
  const { validTypes } = filterAndSanitizeWidgetTypes(targetIds);

  return solveLayoutTool({ widgetIds: validTypes });
}
