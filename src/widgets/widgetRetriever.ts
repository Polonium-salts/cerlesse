import { create, insert, search, type AnyOrama } from "@orama/orama";
import type { ResultWidgetKey, TileWidth } from "../types.js";
import type { CandidateWidget, ContentSignalsPayload } from "./widgetContract.js";
import { getExtensionCatalog, ExtensionCatalogEntry } from "./registry/extensionCatalog.js";

/**
 * 完整规范的小组件画像定义
 */
export interface WidgetCatalogItem {
  id: ResultWidgetKey;
  name: string;
  description: string;
  category: "synthesis" | "action" | "portal" | "analysis" | "custom";
  capabilities: string[];
  intents: string[];
  keywords: string[];
  examples: string[];
  negativeIntents?: string[];
  requiredData?: Array<"takeaways" | "images" | "sources" | "multiple_entities" | "code_snippet" | "install_command">;
  defaultSpan: TileWidth;
  minConfidence: number;
  basePriority: number;
  flexible?: boolean;
}

/**
 * 所有已登记的标准 Widget Key 列表（完全来自 Extension Catalog）
 */
export const ALL_CATALOG_WIDGET_KEYS: ResultWidgetKey[] = getExtensionCatalog().map(e => e.id as ResultWidgetKey);

/**
 * 专为中英文混合设计的 CJK + Latin 字符分词器
 */
export const cjkTokenizer = {
  language: "custom",
  normalizationCache: new Map<string, string[]>(),
  tokenize(raw: string): string[] {
    if (!raw || typeof raw !== "string") return [];
    const tokens: string[] = [];
    const clean = raw.toLowerCase();

    // 1. 提取英文/数字词
    const latinWords = clean.match(/[a-z0-9_]+/g);
    if (latinWords) {
      tokens.push(...latinWords);
    }

    // 2. 提取 CJK 单字与 2-gram 双字元
    const cjkChars = clean.match(/[\u4e00-\u9fa5]/g);
    if (cjkChars) {
      tokens.push(...cjkChars);
      for (let i = 0; i < cjkChars.length - 1; i++) {
        tokens.push(cjkChars[i] + cjkChars[i + 1]);
      }
    }

    return tokens;
  }
};

let oramaDbInstance: AnyOrama | null = null;
let lastOramaFingerprint = "";

export function resetOramaWidgetDb(): void {
  oramaDbInstance = null;
  lastOramaFingerprint = "";
}

export function extensionToCatalogItem(entry: ExtensionCatalogEntry): WidgetCatalogItem {
  return {
    id: entry.id as ResultWidgetKey,
    name: entry.name,
    description: entry.description,
    category: (entry.category as any) || "analysis",
    capabilities: entry.capabilities,
    intents: entry.intents,
    keywords: entry.keywords,
    examples: entry.examples,
    negativeIntents: entry.negativeIntents,
    requiredData: (entry.requiredData as any) || [],
    defaultSpan: (entry.layout.defaultWidth as TileWidth) || 50,
    minConfidence: entry.agent?.minConfidence ?? 0.5,
    basePriority: entry.agent?.priority ?? 80,
    flexible: entry.agent?.flexible ?? true
  };
}

/**
 * 获取特定组件的统一画像（100% 依据 Extension Catalog）
 */
export function getUnifiedCatalogItem(id: string): WidgetCatalogItem | undefined {
  const ext = getExtensionCatalog().find(e => e.id === id);
  return ext ? extensionToCatalogItem(ext) : undefined;
}

/**
 * 获取全量统一组件画像列表（100% 依据 Extension Catalog）
 */
export function getAllUnifiedCatalogItems(): WidgetCatalogItem[] {
  return getExtensionCatalog().map(extensionToCatalogItem);
}

/**
 * 获取或创建 Orama 小组件检索索引（100% 源自 Extension Catalog）
 */
export async function getOramaWidgetDb(): Promise<AnyOrama> {
  const extCatalog = getExtensionCatalog();
  const currentFingerprint = extCatalog.map(c => `${c.id}:${c.version}`).join("|");

  if (oramaDbInstance && currentFingerprint === lastOramaFingerprint) {
    return oramaDbInstance;
  }

  const db = await create({
    schema: {
      id: "string",
      name: "string",
      description: "string",
      keywords: "string[]",
      intents: "string[]",
      capabilities: "string[]",
      examples: "string[]"
    },
    components: {
      tokenizer: cjkTokenizer
    }
  });

  // 纯粹以 Extension Catalog 作为唯一索引数据源
  for (const ext of extCatalog) {
    const item = extensionToCatalogItem(ext);
    await insert(db, {
      id: item.id,
      name: item.name,
      description: item.description,
      keywords: item.keywords,
      intents: item.intents,
      capabilities: item.capabilities,
      examples: item.examples
    });
  }

  oramaDbInstance = db;
  lastOramaFingerprint = currentFingerprint;
  return db;
}

export interface RetrieveWidgetsOptions {
  intent?: string;
  intents?: string[];
  capabilities?: string[];
  entity?: string;
  signals?: ContentSignalsPayload;
  limit?: number;
}

/**
 * 验证组件所需数据是否就绪
 */
function checkDataReadiness(item: WidgetCatalogItem, signals?: ContentSignalsPayload): { ready: boolean; score: number } {
  if (!signals || !item.requiredData || item.requiredData.length === 0) {
    return { ready: true, score: 1.0 };
  }

  let met = 0;
  for (const req of item.requiredData) {
    switch (req) {
      case "takeaways":
        if ((signals.takeawayCount ?? 0) > 0) met++;
        break;
      case "images":
        if ((signals.imageCount ?? 0) > 0 || signals.imageIntent === true) met++;
        break;
      case "sources":
        if ((signals.sourceCount ?? 0) > 0) met++;
        break;
      case "multiple_entities":
        if (signals.hasMultipleEntities === true || (signals.comparisonRows ?? 0) > 0) met++;
        break;
      case "code_snippet":
        if (signals.hasCodeSnippet === true) met++;
        break;
      case "install_command":
        if (signals.hasInstallCommand === true) met++;
        break;
    }
  }

  const ready = met === item.requiredData.length;
  const score = ready ? 1.0 : met / item.requiredData.length;
  return { ready, score };
}

/**
 * 计算与示例语句的字符串模糊吻合度
 */
function calculateExampleMatch(query: string, examples: string[]): number {
  const q = query.toLowerCase().trim();
  let maxScore = 0;
  for (const ex of examples) {
    const e = ex.toLowerCase().trim();
    if (q.includes(e) || e.includes(q)) {
      maxScore = Math.max(maxScore, 1.0);
    } else {
      // 计算重叠字词数
      const qWords = q.match(/[a-z0-9]+|[\u4e00-\u9fa5]/g) || [];
      const eWords = new Set(e.match(/[a-z0-9]+|[\u4e00-\u9fa5]/g) || []);
      if (qWords.length > 0 && eWords.size > 0) {
        const overlap = qWords.filter(w => eWords.has(w)).length;
        const ratio = overlap / Math.max(qWords.length, 1);
        if (ratio > maxScore) maxScore = ratio;
      }
    }
  }
  return Math.min(1.0, maxScore);
}

/**
 * 语义召回核心流水线 (Widget Semantic Retrieval via Orama)
 * ============================================================
 * 融合公式：
 * FinalScore = (SemanticScore * 0.35)
 *            + (IntentScore * 0.25)
 *            + (CapabilityScore * 0.20)
 *            + (DataReadyScore * 0.10)
 *            + (ExampleMatchScore * 0.10)
 *            - (NegativeIntentPenalty * 0.40)
 */
export async function retrieveWidgets(
  query: string,
  options: RetrieveWidgetsOptions = {}
): Promise<CandidateWidget[]> {
  const db = await getOramaWidgetDb();
  const limit = options.limit ?? 15;
  const targetIntent = (options.intent || "").trim().toLowerCase();
  const targetIntents = Array.from(
    new Set([...(options.intents || []), targetIntent].map(i => (i || "").trim().toLowerCase()).filter(Boolean))
  );
  const inputCaps = new Set((options.capabilities || []).map(c => c.toLowerCase()));

  // 1. Orama BM25 多字段加权召回 (支持原 Query 与 Entity 多路搜索)
  const searchQueries = [query];
  if (options.entity && options.entity.trim() && options.entity !== query) {
    searchQueries.push(options.entity.trim());
  }

  const rawScores = new Map<string, number>();
  let maxRawScore = 0.001;

  for (const qTerm of searchQueries) {
    const searchResult = await search(db, {
      term: qTerm,
      boost: {
        keywords: 3.0,
        examples: 2.5,
        name: 2.2,
        intents: 2.0,
        capabilities: 1.8,
        description: 1.2
      },
      limit: 25
    });

    for (const hit of searchResult.hits) {
      const id = (hit.document as any).id as string;
      const prevScore = rawScores.get(id) || 0;
      const newScore = Math.max(prevScore, hit.score);
      rawScores.set(id, newScore);
      if (newScore > maxRawScore) maxRawScore = newScore;
    }
  }

  // 2. 遍历评估所有组件候选 (以 Extension Catalog 为唯一真理来源)
  const candidates: CandidateWidget[] = [];
  const evaluatedCatalogMap = new Map<string, WidgetCatalogItem>();
  for (const ext of getExtensionCatalog()) {
    evaluatedCatalogMap.set(ext.id, extensionToCatalogItem(ext));
  }

  for (const item of evaluatedCatalogMap.values()) {
    // 2.1 语义召回分 (归一化至 0~1)
    const rawOramaScore = rawScores.get(item.id) ?? 0;
    const semanticScore = Math.min(1.0, rawOramaScore / maxRawScore);

    // 2.2 意图契合分 (支持多意图匹配)
    let intentScore = 0;
    if (targetIntents.length > 0) {
      for (const tIntent of targetIntents) {
        if (item.intents.includes(tIntent)) {
          intentScore = Math.max(intentScore, 1.0);
        } else if (item.intents.some(i => tIntent.includes(i) || i.includes(tIntent))) {
          intentScore = Math.max(intentScore, 0.5);
        }
      }
    }

    // 2.3 能力匹配分 (权重提高至 25%)
    const matchedCaps = item.capabilities.filter(c => inputCaps.has(c.toLowerCase()));
    const capabilityScore = inputCaps.size > 0 ? Math.min(1.0, matchedCaps.length / Math.min(inputCaps.size, 4)) : 0.3;

    // 2.4 数据就绪分
    const { ready: dataReady, score: dataReadyScore } = checkDataReadiness(item, options.signals);

    // 硬性阻断：如果明确需要图片但完全无图，或者明确需要实体对比但无多实体，则降低分值
    if (!dataReady && item.requiredData && item.requiredData.length > 0) {
      if (item.id === "image_gallery" && (options.signals?.imageCount ?? 0) === 0 && !options.signals?.imageIntent) {
        continue;
      }
      if (item.id === "comparison" && (options.signals?.comparisonRows ?? 0) === 0 && !options.signals?.hasMultipleEntities) {
        if (!/(vs|区别|对比|比较|哪个好|pk)/i.test(query)) {
          continue;
        }
      }
    }

    // 2.5 示例语句吻合分 (权重降低至 5%，避免挤占能力匹配)
    const exampleMatchScore = calculateExampleMatch(query, item.examples);

    // 2.6 负向意图惩罚
    let negativePenalty = 0;
    if (item.negativeIntents && targetIntents.length > 0) {
      if (item.negativeIntents.some(ni => targetIntents.includes(ni))) {
        negativePenalty = 1.0;
      }
    }

    // 2.7 垂直专属组件（天气、翻译、搜索引擎直达、Token监控）领域防护门槛
    const isSpecializedVertical = ["weather", "translation", "search_engine", "token_usage"].includes(item.id);
    if (isSpecializedVertical) {
      const isDomainQueryHit =
        (item.id === "weather" && (targetIntents.includes("weather") || /(天气|气象|气温|下雨|下雪|降水|温度|穿衣指南|预报|雷阵雨|多云|晴天|阴天|weather|forecast|temperature|rain|climate|台风|空气质量)/i.test(query))) ||
        (item.id === "translation" && (targetIntents.includes("translation") || /(翻译|英文|英语|日语|韩语|法语|德语|西语|俄语|translate|translation|怎么说|什么意思|英译中|中译英|双语|查词|音标)/i.test(query))) ||
        (item.id === "search_engine" && (targetIntents.includes("search_engine_portal") || /(google|bing|baidu|百度|必应|谷歌|搜索引擎|搜狗|sogou|duckduckgo|360|search|engine|搜一下|全网搜)/i.test(query))) ||
        (item.id === "token_usage" && (targetIntents.includes("system_monitor") || /(token|代币|耗费|模型耗时|成本|吞吐|cost|throughput)/i.test(query)));

      if (!isDomainQueryHit) {
        continue;
      }
    }

    // 2.8 加权综合打分 (能力匹配占 25%, 示例匹配占 5%)
    const finalScore =
      (semanticScore * 0.35) +
      (intentScore * 0.25) +
      (capabilityScore * 0.25) +
      (dataReadyScore * 0.10) +
      (exampleMatchScore * 0.05) -
      (negativePenalty * 0.40);

    const reasons: string[] = [];
    if (semanticScore > 0.5) reasons.push("关键词语义高度契合");
    if (intentScore > 0.5) reasons.push(`契合检索意图 (${targetIntents.join("/")})`);
    if (matchedCaps.length > 0) reasons.push(`匹配所需能力: [${matchedCaps.slice(0, 3).join(", ")}]`);
    if (exampleMatchScore > 0.5) reasons.push("命中高频搜索场景");

    candidates.push({
      key: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      capabilities: item.capabilities,
      intents: item.intents,
      semanticScore,
      intentScore,
      capabilityScore,
      dataReadyScore,
      exampleMatchScore,
      finalScore: Math.max(0, finalScore),
      defaultSpan: item.defaultSpan,
      matchedCapabilities: matchedCaps,
      reason: reasons.length > 0 ? reasons.join(" · ") : "备选基础支撑组件"
    });
  }

  // 按综合得分降序排序
  candidates.sort((a, b) => b.finalScore - a.finalScore);

  return candidates.slice(0, limit);
}
