import { PagesFunction, jsonResponse, errorResponse } from "./types.js";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  try {
    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return errorResponse("无效的 JSON 请求体", 400);
    }

    const { query } = body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return errorResponse("缺少搜索关键词", 400);
    }

    const q = query.trim().toLowerCase();
    let intent = "general_knowledge";
    if (/天气|weather|气温/i.test(q)) intent = "weather";
    else if (/翻译|translate/i.test(q)) intent = "translation";
    else if (/下载|download|install|安装/i.test(q)) intent = "software_download";
    else if (/对比|区别|vs|compare/i.test(q)) intent = "tech_comparison";
    else if (/排查|报错|错误|解决|bug|issue/i.test(q)) intent = "troubleshooting";

    return jsonResponse({
      intent,
      intents: [intent],
      entity: query.trim(),
      goal: `Research ${query.trim()}`,
      needs: ["information", "verification"],
      requiredCapabilities: ["search_web", "verify_source"],
      confidence: 0.95
    });
  } catch (error: any) {
    return errorResponse(error.message || "意图分析服务异常", 500);
  }
};

export default onRequest;
