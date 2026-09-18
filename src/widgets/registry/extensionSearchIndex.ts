import { create, insert, search, type AnyOrama } from "@orama/orama";
import { getExtensionCatalog, ExtensionCatalogEntry } from "./extensionCatalog.js";

let extensionOramaDb: AnyOrama | null = null;
let currentIndexedCatalog: ExtensionCatalogEntry[] = [];
let lastCatalogFingerprint = "";

// 专为中英文混合设计的 CJK + Latin 字符分词器
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

/**
 * 重置索引单例缓存
 */
export function resetExtensionSearchIndex(): void {
  extensionOramaDb = null;
  currentIndexedCatalog = [];
  lastCatalogFingerprint = "";
}

/**
 * 初始化或重建 Extension Orama 搜索数据库
 */
export async function initExtensionSearchIndex(
  customCatalog?: ExtensionCatalogEntry[]
): Promise<AnyOrama> {
  const catalog = customCatalog ?? getExtensionCatalog();
  currentIndexedCatalog = [...catalog];
  lastCatalogFingerprint = catalog.map(c => `${c.id}:${c.version}`).join("|");

  const db = await create({
    schema: {
      id: "string",
      name: "string",
      description: "string",
      tags: "string[]",
      keywords: "string[]",
      intents: "string[]",
      capabilities: "string[]",
      examples: "string[]"
    },
    components: {
      tokenizer: cjkTokenizer
    }
  });

  for (const entry of catalog) {
    await insert(db, {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      tags: entry.tags,
      keywords: entry.keywords,
      intents: entry.intents,
      capabilities: entry.capabilities,
      examples: entry.examples
    });
  }

  extensionOramaDb = db;
  return db;
}

/**
 * 获取现有的 Extension Orama 数据库单例，若检测到注册项变动则自动重建
 */
export async function getExtensionSearchDb(): Promise<AnyOrama> {
  const currentCatalog = getExtensionCatalog();
  const currentFingerprint = currentCatalog.map(c => `${c.id}:${c.version}`).join("|");

  if (extensionOramaDb && currentFingerprint === lastCatalogFingerprint) {
    return extensionOramaDb;
  }

  return initExtensionSearchIndex(currentCatalog);
}

export interface ExtensionSearchHit {
  id: string;
  name: string;
  score: number;
  entry: ExtensionCatalogEntry;
}

/**
 * 依据用户 Query、Intent、Capabilities 检索适配的 Extensions
 */
export async function searchExtensions(
  query: string,
  options: {
    limit?: number;
    intent?: string;
    capabilities?: string[];
  } = {}
): Promise<ExtensionSearchHit[]> {
  const db = await getExtensionSearchDb();
  const limit = options.limit ?? 10;
  const catalogMap = new Map<string, ExtensionCatalogEntry>(
    currentIndexedCatalog.map(c => [c.id, c])
  );

  const searchResult = await search(db, {
    term: query,
    boost: {
      keywords: 3.0,
      examples: 2.5,
      name: 2.2,
      intents: 2.0,
      capabilities: 1.8,
      description: 1.2
    },
    limit: limit * 2
  });

  const hits: ExtensionSearchHit[] = [];
  for (const hit of searchResult.hits) {
    const doc = hit.document as any;
    const entry = catalogMap.get(doc.id);
    if (!entry) continue;

    hits.push({
      id: doc.id,
      name: doc.name,
      score: hit.score,
      entry
    });
  }

  return hits.slice(0, limit);
}
