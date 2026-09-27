import { PagesFunction, jsonResponse, errorResponse } from "./types.js";
import { getWidgetCatalogTool } from "../../server/tools/widgetTool.js";
import { solveLayoutTool } from "../../server/tools/layoutTool.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  try {
    const catalog = getWidgetCatalogTool();
    const defaultWidgetIds = ["ai_answer", "related_links", "takeaways"];
    const layout = solveLayoutTool({ widgetIds: defaultWidgetIds });

    return jsonResponse({
      intent: "general_knowledge",
      catalog,
      selectedWidgets: defaultWidgetIds.map((id) => ({
        id,
        type: id,
        title: id,
        reason: "Default layout widget"
      })),
      layout
    });
  } catch (error: any) {
    return errorResponse(error.message || "小组件规划服务异常", 500);
  }
};

export default onRequest;
