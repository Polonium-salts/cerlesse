import type { Usage } from "@aktagon/llmkit-ts";
import { getAiApiClient, getAiApiConfig, LlmProviderError, toLlmProviderError } from "./aiProvider.js";
import { detectQueryLanguage } from "./language.js";

export interface TranslationResult {
  text: string;
  sourceLang: string;
  targetLang: string;
  phonetic?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definitions?: string[];
  examples?: Array<{
    source: string;
    target: string;
  }>;
  synonyms?: string[];
  grammarNotes?: string;
  cached?: boolean;
  usage?: Usage;
}

interface TranslationPayload {
  text?: unknown;
  detectedSourceLang?: unknown;
  phonetic?: unknown;
  pronunciation?: unknown;
  partOfSpeech?: unknown;
  definitions?: unknown;
  examples?: unknown;
  synonyms?: unknown;
  grammarNotes?: unknown;
}

const LANG_NAMES: Record<string, string> = {
  auto: "自动检测",
  zh: "中文",
  en: "英语",
  ja: "日语",
  ko: "韩语",
  fr: "法语",
  de: "德语",
  es: "西班牙语",
  ru: "俄语",
  pt: "葡萄牙语",
  ar: "阿拉伯语",
  it: "意大利语",
  vi: "越南语",
  th: "泰语"
};

const TRANSLATION_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    text: { type: "string" },
    detectedSourceLang: { type: "string" },
    phonetic: { type: "string" },
    pronunciation: { type: "string" },
    partOfSpeech: { type: "string" },
    definitions: { type: "array", items: { type: "string" } },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: { source: { type: "string" }, target: { type: "string" } },
        required: ["source", "target"],
        additionalProperties: false
      }
    },
    synonyms: { type: "array", items: { type: "string" } },
    grammarNotes: { type: "string" }
  },
  required: [
    "text", "detectedSourceLang", "phonetic", "pronunciation", "partOfSpeech",
    "definitions", "examples", "synonyms", "grammarNotes"
  ],
  additionalProperties: false
});

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const translationCache = new Map<string, { result: TranslationResult; expiresAt: number }>();

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseTranslationPayload(text: string): TranslationPayload {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
    return parsed as TranslationPayload;
  } catch (error) {
    throw new LlmProviderError(
      `AI API 返回的翻译结果不是有效 JSON：${error instanceof Error ? error.message : String(error)}`,
      "invalid_response",
      502
    );
  }
}

/** Translate text and preserve the response shape used by the translation endpoint. */
export async function translateText(options: {
  text: string;
  sourceLang?: string;
  targetLang?: string;
  model?: string;
  env?: Record<string, string | undefined>;
}): Promise<TranslationResult> {
  const text = options.text.trim();
  const sourceLang = (options.sourceLang || "auto").trim().toLowerCase();
  const targetLang = (options.targetLang || "zh").trim().toLowerCase();
  if (!text) return { text: "", sourceLang, targetLang };

  const cacheKey = `${sourceLang}->${targetLang}:${text.toLowerCase()}`;
  const cached = translationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, cached: true };
  }
  if (cached) translationCache.delete(cacheKey);

  const aiApiConfig = getAiApiConfig(options.env);
  const sourceName = LANG_NAMES[sourceLang] || sourceLang;
  const targetName = LANG_NAMES[targetLang] || targetLang;
  const prompt = [
    `源语言：${sourceName}`,
    `目标语言：${targetName}`,
    "请翻译下方文本。词句输入还要提供准确音标/发音、词性、主要释义、1-3 条双语例句、近义词；长段落以忠实自然的译文为主，并可补充必要的语法说明。",
    "只输出 JSON，不要使用 Markdown 代码块。JSON 字段为：text（译文）、detectedSourceLang（检测到的语言代码）、phonetic、pronunciation、partOfSpeech、definitions（字符串数组）、examples（含 source 和 target 的数组）、synonyms（字符串数组）、grammarNotes。没有适用内容时使用空字符串或空数组。",
    "待翻译文本：",
    `"""\n${text}\n"""`
  ].join("\n");

  try {
    const response = await getAiApiClient(options.env).text
      .model(options.model || aiApiConfig.model)
      .system("你是一位专业双语翻译与语言学助手。准确保留原意、语气和专业术语，不要增添原文没有的事实。")
      .temperature(0.1)
      .maxTokens(1000)
      .schema(TRANSLATION_SCHEMA)
      .prompt(prompt);

    const payload = parseTranslationPayload(response.text);
    const examples = Array.isArray(payload.examples)
      ? payload.examples.flatMap((example) => {
          if (!example || typeof example !== "object") return [];
          const item = example as Record<string, unknown>;
          return typeof item.source === "string" && typeof item.target === "string"
            ? [{ source: item.source, target: item.target }]
            : [];
        })
      : undefined;
    const result: TranslationResult = {
      text: optionalString(payload.text) || text,
      sourceLang: optionalString(payload.detectedSourceLang) ||
        (sourceLang === "auto" ? detectQueryLanguage(text).code : sourceLang),
      targetLang,
      phonetic: optionalString(payload.phonetic),
      pronunciation: optionalString(payload.pronunciation),
      partOfSpeech: optionalString(payload.partOfSpeech),
      definitions: Array.isArray(payload.definitions)
        ? payload.definitions.filter((value): value is string => typeof value === "string")
        : undefined,
      examples,
      synonyms: Array.isArray(payload.synonyms)
        ? payload.synonyms.filter((value): value is string => typeof value === "string")
        : undefined,
      grammarNotes: optionalString(payload.grammarNotes),
      usage: response.usage
    };

    if (translationCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = translationCache.keys().next().value;
      if (oldestKey) translationCache.delete(oldestKey);
    }
    translationCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    throw toLlmProviderError(error);
  }
}
