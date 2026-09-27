import type { ResultWidgetKey, SearchSynthesisResult } from "../types.js";
import { extensionRegistry } from "./registry/extensionRegistry.js";
import { WidgetRegistry } from "./registry.js";

export type WidgetApplicabilityStatus =
  | "ready"
  | "not_applicable"
  | "empty"
  | "error";

export interface WidgetApplicabilityResult {
  applicable: boolean;
  status: WidgetApplicabilityStatus;
  reason:
    | "registry_missing"
    | "query_not_supported"
    | "data_not_ready"
    | "manifest_constraint"
    | "adapter_error"
    | "error"
    | "ready";
  message?: string;
}

/**
 * 图像意图正则判定（与布局和检索保持一致）
 */
export const IMAGE_INTENT_REGEX = /(图片|照片|图集|图库|壁纸|图片素材|长什么样|外观图|外观|photo|image|picture|gallery|wallpaper)/i;

/**
 * 天气意图正则判定
 */
export const WEATHER_INTENT_REGEX = /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i;

/**
 * 翻译意图正则判定
 */
export const TRANSLATION_INTENT_REGEX = /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i;

/**
 * 搜索引擎直达意图判定
 */
export const SEARCH_ENGINE_INTENT_REGEX = /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜|搜索直达|快速搜索)/i;

/**
 * Token 与消耗度量意图判定
 */
export const TOKEN_USAGE_INTENT_REGEX = /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i;

/**
 * 故障排查意图判定
 */
export const TROUBLESHOOTING_INTENT_REGEX = /(报错|异常|失败|无法启动|解决办法|排查|崩溃|bug|修不好|\b(error|exception|crash|failed|warning|troubleshoot|fix|debug|resolve)\b)/i;

/**
 * 知识架构导图意图判定
 */
export const MINDMAP_INTENT_REGEX = /(架构|原理|底层|机制|体系|全景|知识图谱|思维导图|学习路线|生命周期|内部机制|工作原理|\b(architecture|internals|mechanism|how it works|roadmap|overview|pipeline|lifecycle|deep dive)\b)/i;

/**
 * 对比意图判定
 */
export const COMPARISON_INTENT_REGEX = /(对比|区别|优缺点|哪个好|选哪个|怎么选|还是|好还是|优劣|差别|pk|\b(vs|versus|difference|compare|comparison|pros and cons|better)\b)/i;

/**
 * 统一小组件适用性网关 (Unified Widget Applicability Gate)
 *
 * 核心原则：
 * Codex Agent 负责推荐候选 Widget，Applicability Gate 负责最终确认 Widget 是否有资格上桌。
 * 不适用组件绝不进入布局求解器、绝不占据网格空间、绝不显示"缺少可渲染视图"异常占位。
 */
export function evaluateWidgetApplicability(
  widgetId: string | ResultWidgetKey,
  query?: string,
  activeResult?: SearchSynthesisResult
): WidgetApplicabilityResult {
  const idStr = String(widgetId);
  const q = (query || activeResult?.query || "").trim();

  // 搜索内容语料：真实信源标题 + 摘要。许多搜索内容本身没有意图关键词（如 "google"），
  // 但信源里往往包含组件真正需要的内容信号，仅看查询词会导致组件被误砍。
  const resultCorpus = [
    ...(activeResult?.filteredResults || []).slice(0, 10).map(r => `${r.title || ""} ${r.snippet || ""}`),
    ...(activeResult?.keyTakeaways || [])
  ].join(" ");

  // 1. 注册中心存在性校验 (Registry Gate)
  if (!WidgetRegistry.has(idStr) && !extensionRegistry.has(idStr)) {
    return {
      applicable: false,
      status: "not_applicable",
      reason: "registry_missing",
      message: `小组件 [${idStr}] 未在注册中心或扩展目录中找到`
    };
  }

  // 2. 获取扩展与适配器 (Extension / Adapter Gate)
  const extension = extensionRegistry.get(idStr);
  const adapter = extension?.adapter;

  if (adapter && typeof adapter.canHandle === "function") {
    try {
      const canHandle = adapter.canHandle(q, activeResult);
      if (!canHandle) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "query_not_supported",
          message: `小组件适配器 [${idStr}] 判定当前查询与数据不适用`
        };
      }
    } catch (err: any) {
      console.warn(`[ApplicabilityGate] adapter.canHandle error for [${idStr}]:`, err);
      return {
        applicable: false,
        status: "error",
        reason: "adapter_error",
        message: err instanceof Error ? err.message : String(err)
      };
    }
  }

  // 3. 针对各关键组件的严格数据门槛与意图约束 (Data & Intent Gates)
  switch (idStr) {
    case "ai_answer":
      // AI 智能回答作为核心速答组件，有查询或有结论时均适用
      return { applicable: true, status: "ready", reason: "ready" };

    case "related_links":
      // 权威跳转与官网直达作为核心速达入口，与 AI 智能回答共同构成常驻基底
      return { applicable: true, status: "ready", reason: "ready" };

    case "image_gallery":
      // 图集为常驻组件；无图片时由组件自身呈现空态与图片搜索入口
      return { applicable: true, status: "ready", reason: "ready" };

    case "token_usage": {
      // 必须满足：存在真实 tokenUsage 遥测数据 OR 查询明确关注 Token/耗费/成本度量
      const hasTokenData = Boolean(activeResult?.tokenUsage);
      const hasTokenIntent = TOKEN_USAGE_INTENT_REGEX.test(q);

      if (!hasTokenData && !hasTokenIntent) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "query_not_supported",
          message: "无 Token 消耗数据且查询未关注意图度量"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    case "weather": {
      // 仅在明确涉及气象天气时适用
      if (!WEATHER_INTENT_REGEX.test(q)) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "query_not_supported",
          message: "非天气/气象类查询"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    case "translation": {
      // 仅在明确涉及多语言翻译/查词时适用
      if (!TRANSLATION_INTENT_REGEX.test(q)) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "query_not_supported",
          message: "非翻译/查词类查询"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    case "search_engine": {
      // 仅在涉及主流搜索引擎或用户明确需要搜索引擎直达时适用
      if (!SEARCH_ENGINE_INTENT_REGEX.test(q)) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "query_not_supported",
          message: "非搜索引擎直达类意图"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    case "takeaways": {
      // 核心结论要点：必须存在真实 keyTakeaways
      const count = activeResult?.keyTakeaways?.length ?? 0;
      if (count === 0) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "data_not_ready",
          message: "未提炼出核心结论要点数据"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    case "comparison": {
      const hasRows = (activeResult?.comparisonTable?.length ?? 0) > 0;
      const hasIntent = COMPARISON_INTENT_REGEX.test(q) || COMPARISON_INTENT_REGEX.test(resultCorpus);
      if (!hasRows && !hasIntent) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "data_not_ready",
          message: "未提取到对比维度数据且查询/信源均无对比意图"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    case "mindmap": {
      const hasBranches = (activeResult?.mindMap?.children?.length ?? 0) > 0;
      const hasIntent = MINDMAP_INTENT_REGEX.test(q);
      if (!hasBranches && !hasIntent) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "data_not_ready",
          message: "未提取到思维导图分支且无架构意图"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    case "troubleshooting": {
      // 查询或搜索内容语料任一命中排查/修复意图即可启用
      if (!TROUBLESHOOTING_INTENT_REGEX.test(q) && !TROUBLESHOOTING_INTENT_REGEX.test(resultCorpus)) {
        return {
          applicable: false,
          status: "not_applicable",
          reason: "query_not_supported",
          message: "查询与搜索内容均无故障排查意图"
        };
      }
      return { applicable: true, status: "ready", reason: "ready" };
    }

    default:
      break;
  }

  // 4. 清单 Manifest 约束校验
  if (extension?.manifest?.dataRequirements && extension.manifest.dataRequirements.length > 0) {
    for (const req of extension.manifest.dataRequirements) {
      if (req === "comparisonRows" && (!activeResult?.comparisonTable || activeResult.comparisonTable.length === 0)) {
        return { applicable: false, status: "not_applicable", reason: "data_not_ready", message: "缺少对比表格数据" };
      }
      if (req === "mindMapBranches" && (!activeResult?.mindMap?.children || activeResult.mindMap.children.length === 0)) {
        return { applicable: false, status: "not_applicable", reason: "data_not_ready", message: "缺少架构导图分支数据" };
      }
      if (req === "takeaways" && (!activeResult?.keyTakeaways || activeResult.keyTakeaways.length === 0)) {
        return { applicable: false, status: "not_applicable", reason: "data_not_ready", message: "缺少结论要点数据" };
      }
      if (req === "images" && (!activeResult?.relatedImages || activeResult.relatedImages.length === 0) && !IMAGE_INTENT_REGEX.test(q)) {
        return { applicable: false, status: "not_applicable", reason: "data_not_ready", message: "缺少图集数据" };
      }
    }
  }

  return { applicable: true, status: "ready", reason: "ready" };
}

/**
 * 批量过滤出通过适用性网关的小组件键名数组
 */
export function filterApplicableWidgets(
  widgetKeys: ResultWidgetKey[],
  query?: string,
  activeResult?: SearchSynthesisResult
): ResultWidgetKey[] {
  return widgetKeys.filter(
    (key) => evaluateWidgetApplicability(key, query, activeResult).applicable
  );
}
