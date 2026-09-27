import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { TranslationData } from "./types.js";
import { LOCAL_DICTIONARY } from "./dictionary.js";

export function parseTranslationQuery(query: string): {
  extractedText: string;
  sourceLang: string;
  targetLang: string;
} {
  let text = (query || "").trim();
  let source = "zh";
  let target = "en";

  // 匹配语言定向，例如 "苹果的英文"、"用英语怎么说"、"中译英"、"翻译成日文"
  if (/(英文|英语|english)/i.test(text)) {
    target = "en";
  } else if (/(日文|日语|japanese)/i.test(text)) {
    target = "ja";
  } else if (/(韩文|韩语|korean)/i.test(text)) {
    target = "ko";
  } else if (/(法文|法语|french)/i.test(text)) {
    target = "fr";
  } else if (/(德文|德语|german)/i.test(text)) {
    target = "de";
  } else if (/(中文|汉语|chinese)/i.test(text)) {
    target = "zh";
    source = "en";
  }

  // 剔除搜索前缀修饰词提取核心实体词
  let cleaned = text
    .replace(/^翻译\s*[:：(（]?/i, "")
    .replace(/[)）]$/i, "")
    .replace(/(用英语怎么说|用英文怎么说|用日语怎么说|用韩语怎么说|英语怎么说|英文怎么说|日语怎么说|韩语怎么说|怎么说|什么意思|英译中|中译英|日译中|中译日)/gi, "")
    .replace(/(的英文|的英语|的日文|的韩文|的中文|的法语|的德语)/gi, "")
    .replace(/(翻译成英文|翻译成英语|翻译成中文|翻译成日文)/gi, "")
    .replace(/(怎么读|音标|读音|发音|释义)/gi, "")
    .replace(/(英语|英文|日语|日文|韩语|韩文|法语|德语|西语)/gi, "")
    .trim();

  // 如果待翻译文本本身几乎全是英文字符，默认源语言为英语、目标语言为中文
  if (/^[a-zA-Z\s,.'"-]+$/.test(cleaned) && cleaned.length > 0 && target === "en") {
    source = "en";
    target = "zh";
  }

  return {
    extractedText: cleaned || "苹果",
    sourceLang: source,
    targetLang: target
  };
}

export interface TranslationAdapterType extends WidgetAdapter<any, TranslationData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): TranslationData;
  validate(data: TranslationData): boolean;
}

export const translationAdapter: TranslationAdapterType = {
  canHandle(query: string) {
    return /(翻译|英文|英语|日文|日语|韩文|韩语|法文|法语|德文|德语|translate|translation|什么意思|怎么读|怎么说)/i.test(query);
  },

  transform(query: string, result?: any): TranslationData {
    const q = query || result?.query || "苹果";
    const { extractedText, sourceLang, targetLang } = parseTranslationQuery(q);

    // 尝试直接匹配本地离线词典
    const lowerKey = extractedText.toLowerCase();
    const entry = LOCAL_DICTIONARY[extractedText]?.[targetLang] || LOCAL_DICTIONARY[lowerKey]?.[targetLang];

    return {
      sourceText: extractedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      translation: entry ? entry.translation : `[${targetLang.toUpperCase()}] ${extractedText}`,
      phonetic: entry?.phonetic,
      partOfSpeech: entry?.partOfSpeech,
      definition: entry?.definition,
      examples: entry?.examples,
      detectedLanguage: sourceLang
    };
  },

  validate(data: TranslationData): boolean {
    return Boolean(data && data.sourceText && data.targetLanguage);
  }
};
