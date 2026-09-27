import { PagesFunction, jsonResponse, errorResponse } from "../types.js";
import { solveLayoutTool } from "../../../server/tools/layoutTool.js";

/**
 * EdgeOne Cloud Functions: 确定性装箱排版计算
 * 路由：/api/layout/plan
 */
export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  try {
    if (context.request.method === "GET") {
      const url = new URL(context.request.url);
      const widgetsParam = url.searchParams.get("widgets");
      const targetIds = widgetsParam ? widgetsParam.split(",") : ["ai_answer", "related_links", "takeaways"];
      const result = solveLayoutTool({ widgetIds: targetIds });
      return jsonResponse(result);
    }

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return errorResponse("无效的 JSON 请求体", 400);
    }

    const { widgetIds, widgetPlan } = body || {};
    let targetIds: string[] = [];

    if (Array.isArray(widgetIds)) {
      targetIds = widgetIds;
    } else if (widgetPlan?.selectedWidgets) {
      targetIds = widgetPlan.selectedWidgets.map((w: any) => w.type || w.id);
    } else if (widgetPlan?.widgetOrder) {
      targetIds = widgetPlan.widgetOrder;
    } else {
      targetIds = ["ai_answer", "related_links", "takeaways"];
    }

    const result = solveLayoutTool({ widgetIds: targetIds });
    return jsonResponse(result);
  } catch (error: any) {
    console.error("Edge widget layout solve error:", error);
    return errorResponse(error.message || "小组件排版服务异常", 500);
  }
};

