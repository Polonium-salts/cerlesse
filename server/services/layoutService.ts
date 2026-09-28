import { solveLayoutTool } from "../tools/layoutTool.js";

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

  return solveLayoutTool({ widgetIds: targetIds });
}
