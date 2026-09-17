import { callOpenRouterChat } from "./openrouter.js";

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
}

// In-memory LRU cache for translations
const translationCache = new Map<string, { result: TranslationResult; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getCacheKey(text: string, from: string, to: string): string {
  return `${from}->${to}:${text.trim().toLowerCase()}`;
}

/**
 * 语言名称映射表
 */
const LANG_NAMES: Record<string, { zh: string; en: string }> = {
  auto: { zh: "自动检测", en: "Auto Detect" },
  zh: { zh: "中文", en: "Chinese" },
  en: { zh: "英语", en: "English" },
  ja: { zh: "日语", en: "Japanese" },
  ko: { zh: "韩语", en: "Korean" },
  fr: { zh: "法语", en: "French" },
  de: { zh: "德语", en: "German" },
  es: { zh: "西班牙语", en: "Spanish" },
  ru: { zh: "俄语", en: "Russian" },
  pt: { zh: "葡萄牙语", en: "Portuguese" },
  ar: { zh: "阿拉伯语", en: "Arabic" },
  it: { zh: "意大利语", en: "Italian" },
  vi: { zh: "越南语", en: "Vietnamese" },
  th: { zh: "泰语", en: "Thai" }
};

/**
 * 快速规则启发式翻译（离线降级兜底，保障无大模型 API 或断网时基础可用）
 */
function heuristicTranslate(text: string, from: string, to: string): TranslationResult {
  const trimmed = text.trim();
  const isEnTarget = to === "en";

  // 针对常见高频词与问句的离线词典
  const commonDictionary: Record<string, { en: string; zh: string; phonetic?: string; pos?: string }> = {
    "你好": { en: "Hello / Hi", zh: "你好", phonetic: "nǐ hǎo", pos: "interjection" },
    "谢谢": { en: "Thank you / Thanks", zh: "谢谢", phonetic: "xiè xie", pos: "verb / expression" },
    "再见": { en: "Goodbye / See you", zh: "再见", phonetic: "zài jiàn", pos: "phrase" },
    "对不起": { en: "Sorry / Excuse me", zh: "对不起", phonetic: "duì bu qǐ", pos: "expression" },
    "不客气": { en: "You're welcome", zh: "不客气", phonetic: "bù kè qi", pos: "phrase" },
    "加油": { en: "Keep it up / Go for it", zh: "加油", phonetic: "jiā yóu", pos: "phrase" },
    "hello": { en: "Hello", zh: "你好 / 喂", phonetic: "/həˈləʊ/", pos: "int." },
    "world": { en: "World", zh: "世界 / 全球", phonetic: "/wɜːld/", pos: "n." },
    "search": { en: "Search", zh: "搜索 / 查找 / 探寻", phonetic: "/sɜːtʃ/", pos: "v. & n." },
    "translate": { en: "Translate", zh: "翻译 / 转换 / 解释", phonetic: "/trænzˈleɪt/", pos: "v." },
    "language": { en: "Language", zh: "语言 / 话语 / 表达方式", phonetic: "/ˈlæŋɡwɪdʒ/", pos: "n." },
    "dictionary": { en: "Dictionary", zh: "词典 / 字典", phonetic: "/ˈdɪkʃənri/", pos: "n." },
    "artificial intelligence": { en: "Artificial Intelligence (AI)", zh: "人工智能", phonetic: "/ˌɑːtɪˈfɪʃl ɪnˈtelɪdʒəns/", pos: "n." },
    "agent": { en: "Agent", zh: "代理 / 智能体 / 代理人", phonetic: "/ˈeɪdʒənt/", pos: "n." },
    "layout": { en: "Layout", zh: "布局 / 版面设计 / 排版", phonetic: "/ˈleɪaʊt/", pos: "n." }
  };

  const lookupKey = trimmed.toLowerCase();
  const dictHit = commonDictionary[lookupKey] || commonDictionary[trimmed];

  if (dictHit) {
    const targetText = isEnTarget ? dictHit.en : dictHit.zh;
    return {
      text: targetText,
      sourceLang: from === "auto" ? (/[\u4e00-\u9fa5]/.test(trimmed) ? "zh" : "en") : from,
      targetLang: to,
      phonetic: dictHit.phonetic,
      partOfSpeech: dictHit.pos,
      definitions: [targetText],
      examples: [
        {
          source: trimmed,
          target: targetText
        }
      ]
    };
  }

  // 基础兜底返回
  return {
    text: trimmed,
    sourceLang: from === "auto" ? (/[\u4e00-\u9fa5]/.test(trimmed) ? "zh" : "en") : from,
    targetLang: to,
    definitions: [trimmed]
  };
}

/**
 * 主翻译函数：支持智能语言检测、多语言互译、例句生成、音标标注与词性解析
 */
export async function translateText(options: {
  text: string;
  sourceLang?: string;
  targetLang?: string;
  apiKey?: string;
  model?: string;
  env?: Record<string, string | undefined>;
}): Promise<TranslationResult> {
  const { text, apiKey, model, env } = options;
  const sourceLang = (options.sourceLang || "auto").toLowerCase();
  const targetLang = (options.targetLang || "zh").toLowerCase();

  const trimmed = text.trim();
  if (!trimmed) {
    return {
      text: "",
      sourceLang,
      targetLang
    };
  }

  // Check cache
  const cacheKey = getCacheKey(trimmed, sourceLang, targetLang);
  const cached = translationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, cached: true };
  }

  // If text is short or long, ask OpenRouter with JSON output
  const targetName = LANG_NAMES[targetLang]?.zh || targetLang;
  const sourceName = sourceLang === "auto" ? "自动识别" : (LANG_NAMES[sourceLang]?.zh || sourceLang);

  const systemPrompt = `你是一位高水平的双语翻译大师与语言学专家。
你的任务是将用户提供的文本准确、自然地翻译成目标语言，并提供清晰的发音/音标、词性与实用双语对照例句。
必须遵循以下规范：
1. 译文地道自然，符合当代语境与专业习惯；
2. 如果输入是单词或短语，务必提供准确音标 (phonetic)、词性 (partOfSpeech)、主要释义清单 (definitions) 及 2-3 个经典例句 (examples)；
3. 如果输入是长句子或段落，主要提供精准翻译与语法/修辞提示 (grammarNotes)；
4. 输出必须是合法严格的 JSON 对象，不得包含任何 Markdown 代码块标签以外的多余文本。

输出格式：
{
  "text": "目标语言的高质量译文",
  "detectedSourceLang": "zh|en|ja|ko|fr|de|es|ru|...",
  "phonetic": "国际音标或注音 (如 /ˈeɪdʒənt/ 或 [nǐ hǎo])",
  "partOfSpeech": "词性 (如 n. / v. / adj. / phrase)",
  "definitions": ["主要释义1", "主要释义2"],
  "examples": [
    { "source": "原文例句", "target": "译文例句" }
  ],
  "synonyms": ["近义词1", "近义词2"],
  "grammarNotes": "语境或习惯用法说明"
}`;

  const userPrompt = `源语言：${sourceName}\n目标语言：${targetName}\n待翻译文本：\n"""\n${trimmed}\n"""\n\n请输出对应的翻译 JSON。`;

  try {
    const raw = await callOpenRouterChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: model || "openrouter/free",
      apiKey,
      env,
      responseFormatJson: true,
      timeoutMs: 4000,
      temperature: 0.1,
      maxTokens: 1000
    });

    if (raw) {
      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const result: TranslationResult = {
        text: parsed.text || trimmed,
        sourceLang: parsed.detectedSourceLang || (sourceLang === "auto" ? "en" : sourceLang),
        targetLang,
        phonetic: parsed.phonetic || undefined,
        pronunciation: parsed.pronunciation || undefined,
        partOfSpeech: parsed.partOfSpeech || undefined,
        definitions: Array.isArray(parsed.definitions) ? parsed.definitions : undefined,
        examples: Array.isArray(parsed.examples) ? parsed.examples : undefined,
        synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : undefined,
        grammarNotes: parsed.grammarNotes || undefined
      };

      // Store in LRU cache
      if (translationCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = translationCache.keys().next().value;
        if (firstKey) translationCache.delete(firstKey);
      }
      translationCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + CACHE_TTL_MS
      });

      return result;
    }
  } catch (error) {
    console.warn("Translation via LLM failed or timed out, falling back to heuristic dictionary:", error);
  }

  // Fallback to heuristic
  const fallbackResult = heuristicTranslate(trimmed, sourceLang, targetLang);
  return fallbackResult;
}
