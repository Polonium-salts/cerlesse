import { AgentPlan, DetectedLanguage, LayoutIntentType, WidgetIntentAnalysis } from "../src/types.js";

/**
 * 意图分析与多语言跨语种规划
 */
export function generatePlanForQuery(
  query: string,
  detectedLang: DetectedLanguage,
  targetLang: DetectedLanguage,
  preIntent?: WidgetIntentAnalysis
): AgentPlan {
  const isEn = targetLang.code === "en";
  const cleanQ = query.trim();

  let intent: LayoutIntentType = "balanced";
  const semanticIntent = preIntent?.primaryIntent || preIntent?.intent;

  if (semanticIntent === "search_engine_portal" || /^(google|bing|baidu|duckduckgo|yandex|sogou|yahoo|谷歌|百度|必应|搜索引擎)(\s*(搜索|入口|主页|portal|search|engine))?$/i.test(cleanQ)) {
    intent = "official_portal";
  } else if (semanticIntent === "software_download" || /(下载|安装|客户端|installer|download|setup|client)/i.test(cleanQ)) {
    intent = "install";
  } else if (semanticIntent === "tech_comparison" || /(对比|区别|哪个好|vs|versus|compare|difference)/i.test(cleanQ)) {
    intent = "comparison";
  } else if (semanticIntent === "portal_navigation" || /(官网|官方|主页|official|website|portal)/i.test(cleanQ)) {
    intent = "official_portal";
  } else if (/(工具|在线|免安装|tool|converter|generator)/i.test(cleanQ)) {
    intent = "tool_discovery";
  } else if (/(旅游|攻略|行程|路线|travel|itinerary|trip)/i.test(cleanQ)) {
    intent = "travel";
  } else if (/(架构|原理|系统|导图|architecture|topology|mindmap)/i.test(cleanQ)) {
    intent = "architecture";
  } else if (semanticIntent === "troubleshooting" || /(排查|报错|解决|troubleshooting|error|fix|debug)/i.test(cleanQ)) {
    intent = "troubleshooting";
  } else if (semanticIntent === "concept_explanation" || /(什么是|定义|含义|what is|definition|define)/i.test(cleanQ)) {
    intent = "quick_definition";
  } else if (/(研报|报告|趋势|分析|research|analysis|industry)/i.test(cleanQ)) {
    intent = "deep_research";
  }

  const subQueries = [cleanQ];

  // 按真实意图精准扩充分支子查询，避免对纯搜索引擎/品牌词盲目生成"官方文档 教程"噪声
  if (semanticIntent === "search_engine_portal" || /^(google|bing|baidu|duckduckgo|yandex|sogou|yahoo|谷歌|百度|必应)(\s*(搜索|入口|主页|portal|search))?$/i.test(cleanQ)) {
    subQueries.push(`${cleanQ} 官方网站 搜索入口`);
    subQueries.push(`${cleanQ} official search engine portal`);
  } else if (intent === "install") {
    subQueries.push(`${cleanQ} 官方下载 安装教程`);
    subQueries.push(`${cleanQ} official release download guide`);
  } else if (intent === "troubleshooting") {
    subQueries.push(`${cleanQ} 报错 排查 解决`);
    subQueries.push(`${cleanQ} error troubleshooting fix`);
  } else if (intent === "comparison") {
    subQueries.push(`${cleanQ} 对比 区别 选型`);
    subQueries.push(`${cleanQ} comparison benchmark versus`);
  } else if (intent === "official_portal") {
    subQueries.push(`${cleanQ} 官方主页 权威入口`);
    subQueries.push(`${cleanQ} official website portal docs`);
  } else if (intent === "quick_definition") {
    subQueries.push(`${cleanQ} 概念 详解 架构`);
    subQueries.push(`${cleanQ} overview architectural concept`);
  } else {
    subQueries.push(`${cleanQ} 官方`);
    subQueries.push(`${cleanQ} official`);
  }

  if (detectedLang.code === "zh" && isEn) {
    subQueries.push(`${cleanQ} overview guide`);
  } else if (detectedLang.code === "en" && targetLang.code === "zh" && !semanticIntent) {
    subQueries.push(`${cleanQ} 官网 详解`);
  }

  return {
    originalQuery: cleanQ,
    intent,
    subQueries,
    comparisonDimensions: ["核心功能", "性能与稳定性", "适用场景", "官方支持"]
  };
}
