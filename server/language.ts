import { DetectedLanguage } from "../src/types.js";

export const SUPPORTED_LANGUAGES: Record<string, { name: string; localName: string; flag: string; searxngCode: string }> = {
  zh: { name: "Chinese", localName: "中文", flag: "🇨🇳", searxngCode: "zh-CN" },
  en: { name: "English", localName: "English", flag: "🇺🇸", searxngCode: "en-US" },
  ja: { name: "Japanese", localName: "日本語", flag: "🇯🇵", searxngCode: "ja-JP" },
  ko: { name: "Korean", localName: "한국어", flag: "🇰🇷", searxngCode: "ko-KR" },
  es: { name: "Spanish", localName: "Español", flag: "🇪🇸", searxngCode: "es-ES" },
  fr: { name: "French", localName: "Français", flag: "🇫🇷", searxngCode: "fr-FR" },
  de: { name: "German", localName: "Deutsch", flag: "🇩🇪", searxngCode: "de-DE" },
  ru: { name: "Russian", localName: "Русский", flag: "🇷🇺", searxngCode: "ru-RU" },
  pt: { name: "Portuguese", localName: "Português", flag: "🇧🇷", searxngCode: "pt-BR" },
  ar: { name: "Arabic", localName: "العربية", flag: "🇸🇦", searxngCode: "ar-SA" }
};

/**
 * Detect language of query using unicode script analysis and lexical features
 */
export function detectQueryLanguage(text: string): DetectedLanguage {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      code: "zh",
      name: "中文",
      flag: "🇨🇳",
      crossLingualEnabled: false
    };
  }

  // 1. Japanese check (Hiragana \u3040-\u309f or Katakana \u30a0-\u30ff)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(trimmed)) {
    return {
      code: "ja",
      name: "日本語",
      flag: "🇯🇵",
      crossLingualEnabled: true,
      crossLingualSummary: "已激活日英跨语言检索，协同检索全球与本土信源"
    };
  }

  // 2. Korean check (Hangul syllables \uac00-\ud7af or jamo \u1100-\u11ff)
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(trimmed)) {
    return {
      code: "ko",
      name: "한국어",
      flag: "🇰🇷",
      crossLingualEnabled: true,
      crossLingualSummary: "已激活韩英跨语言检索，补充权威全球一手信源"
    };
  }

  // 3. Chinese check (Hanzi \u4e00-\u9fa5 without Japanese kana)
  if (/[\u4e00-\u9fa5]/.test(trimmed)) {
    return {
      code: "zh",
      name: "中文",
      flag: "🇨🇳",
      crossLingualEnabled: true,
      crossLingualSummary: "已激活中英双轨检索，聚合全球一手英文文献与本土深度实践"
    };
  }

  // 4. Cyrillic / Russian check (\u0400-\u04ff)
  if (/[\u0400-\u04ff]/.test(trimmed)) {
    return {
      code: "ru",
      name: "Русский",
      flag: "🇷🇺",
      crossLingualEnabled: true,
      crossLingualSummary: "Активирован мультиязычный поиск для глобальных и региональных источников"
    };
  }

  // 5. Arabic check (\u0600-\u06ff)
  if (/[\u0600-\u06ff]/.test(trimmed)) {
    return {
      code: "ar",
      name: "العربية",
      flag: "🇸🇦",
      crossLingualEnabled: true,
      crossLingualSummary: "تم تفعيل البحث متعدد اللغات لمصادر موثوقة عالمياً ومحلياً"
    };
  }

  // 6. Latin-based languages
  const lower = trimmed.toLowerCase();

  // Spanish detection
  if (
    /[¿¡]/.test(trimmed) ||
    /\b(el|la|los|las|un|una|unos|unas|por|para|cómo|como|con|es|son|diferencia|ventajas|oficial|guía|desarrollo)\b/i.test(lower)
  ) {
    return {
      code: "es",
      name: "Español",
      flag: "🇪🇸",
      crossLingualEnabled: true,
      crossLingualSummary: "Búsqueda multilingüe activada para recursos globales y en español"
    };
  }

  // French detection
  if (
    /\b(le|la|les|un|une|des|dans|pour|comment|avec|est|sont|différence|avantages|officiel|tutoriel|développement)\b/i.test(lower)
  ) {
    return {
      code: "fr",
      name: "Français",
      flag: "🇫🇷",
      crossLingualEnabled: true,
      crossLingualSummary: "Recherche multilingue activée pour les sources mondiales et francophones"
    };
  }

  // German detection
  if (
    /\b(der|die|das|den|dem|des|ein|eine|eines|und|oder|für|wie|mit|ist|sind|nicht|unterschied|vorteile|offizielle|anleitung)\b/i.test(lower)
  ) {
    return {
      code: "de",
      name: "Deutsch",
      flag: "🇩🇪",
      crossLingualEnabled: true,
      crossLingualSummary: "Mehrsprachige Suche für globale und deutschsprachige Quellen aktiviert"
    };
  }

  // Default to English for Latin queries
  return {
    code: "en",
    name: "English",
    flag: "🇺🇸",
    crossLingualEnabled: true,
    crossLingualSummary: "Multilingual query processing active across global indexed sources"
  };
}

/**
 * Determine the target response language: either user explicitly specified, or matching the query language
 */
export function resolveTargetLanguage(userPreference: string | undefined, detected: DetectedLanguage): {
  code: string;
  name: string;
  flag: string;
} {
  if (userPreference && userPreference !== "auto" && SUPPORTED_LANGUAGES[userPreference]) {
    const info = SUPPORTED_LANGUAGES[userPreference];
    return {
      code: userPreference,
      name: info.localName,
      flag: info.flag
    };
  }
  return {
    code: detected.code,
    name: detected.name,
    flag: detected.flag
  };
}

/**
 * Multilingual prompt labels and step localization
 */
export function getStepLocalization(targetLangCode: string) {
  const isEn = targetLangCode === "en";
  const isJa = targetLangCode === "ja";

  if (isEn) {
    return {
      planTitle: "Intent & Multilingual Search Planning",
      planDescRunning: (q: string, langName: string) =>
        `Analyzing query "${q}" (Language: ${langName}), formulating cross-lingual search strategy...`,
      planDescDone: (intent: string, branches: number) =>
        `Intent identified: ${intent}. Generated ${branches} search branches across global and local sources.`,
      searchTitle: "Multi-Source Real-Time Search",
      searchDescRunning: "Connecting concurrently to SearXNG & Direct Web engines across global nodes...",
      searchFallback: "Primary engine throttled; activated high-availability multi-region fallback...",
      filterTitle: "Agent Filtering & Credibility Verification",
      filterDescDone: (count: number) =>
        `Filter complete: retained ${count} high-confidence sources, eliminated duplicate noise.`,
      filterDetails: (count: number, sources: string) => [
        `High-confidence validated sources: ${count}`,
        `Engines & protocols: ${sources}`
      ],
      synthTitle: "Comparative Synthesis & Knowledge Mapping",
      synthDescRunning: (model: string) =>
        `Calling OpenRouter (${model}) to perform cross-source comparison and construct knowledge tree...`,
      synthDescDone: (model: string) =>
        `Executive report, comparison matrix, and mind map generated (Model: ${model}).`
    };
  }

  if (isJa) {
    return {
      planTitle: "検索意図の分析と多言語プランニング",
      planDescRunning: (q: string, langName: string) =>
        `検索キーワード「${q}」（言語: ${langName}）を分析し、クロスリンガル検索戦略を策定中...`,
      planDescDone: (intent: string, branches: number) =>
        `検索意図「${intent}」を特定。グローバルおよび地域ソースにまたがる ${branches} つの検索ブランチを生成。`,
      searchTitle: "リアルタイム多言語・多源検索",
      searchDescRunning: "SearXNG および分散 Web エンジンへ並行接続し、最新情報を取得中...",
      searchFallback: "プライマリ検索が混雑しているため、高可用性フォールバックゲートウェイを起動...",
      filterTitle: "信頼性検証とエージェントフィルタリング",
      filterDescDone: (count: number) =>
        `フィルタリング完了: ${count} 件の高信頼ソースを抽出、重複ノイズを除去。`,
      filterDetails: (count: number, sources: string) => [
        `高信頼検証ソース数: ${count}`,
        `参照エンジン: ${sources}`
      ],
      synthTitle: "多角比較分析とマインドマップ生成",
      synthDescRunning: (model: string) =>
        `OpenRouter (${model}) を呼び出し、多角的な知見の統合と知識マップを構築中...`,
      synthDescDone: (model: string) =>
        `総合レポート、比較マトリクス、マインドマップを生成完了（モデル: ${model}）。`
    };
  }

  // Default Chinese
  return {
    planTitle: "意图剖析与多语言检索规划",
    planDescRunning: (q: string, langName: string) =>
      `分析搜索词 “${q}”（识别语言: ${langName}），规划多源跨语言检索策略`,
    planDescDone: (intent: string, branches: number) =>
      `已确定检索意图: ${intent}，生成 ${branches} 个多维度多语言检索分支`,
    searchTitle: "多源实时检索引擎",
    searchDescRunning: "正在并发连接 SearXNG 实例与直接网页网关，汇聚全球多源信息...",
    searchFallback: "主检索引擎响应受限，已无缝切换至高可用备用网关检索...",
    filterTitle: "Agent 智能过滤与可信度甄别",
    filterDescDone: (count: number) =>
      `过滤完成：保留 ${count} 条高价值可信信源，剔除冗余干扰`,
    filterDetails: (count: number, sources: string) => [
      `去重后高可信信源: ${count} 个`,
      `涉及信息源: ${sources}`
    ],
    synthTitle: "多源对比分析与思维导图生成",
    synthDescRunning: (model: string) =>
      `调用 OpenRouter (${model}) 进行跨源观点比对、构建思维导图...`,
    synthDescDone: (model: string) =>
      `综合研报、多源对比矩阵与思维导图生成完毕（模型: ${model}）`
  };
}
