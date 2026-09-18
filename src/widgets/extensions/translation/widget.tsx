import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Languages,
  ArrowLeftRight,
  Copy,
  Check,
  Volume2,
  Sparkles,
  RotateCcw,
  BookOpen,
  CornerDownLeft,
  X
} from "lucide-react";
import type { TranslationData, DictEntry } from "./types.js";
import { SUPPORTED_LANGS, LOCAL_DICTIONARY } from "./dictionary.js";
import { translationAdapter, parseTranslationQuery } from "./adapter.js";
import type { WidgetContext } from "../../sdk/types.js";

export interface TranslationWidgetProps {
  data?: TranslationData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
  query?: string;
}

export const TranslationWidget: React.FC<TranslationWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const initialData: TranslationData = props.data ?? translationAdapter.transform(
    props.query || props.context?.activeResult?.query || props.activeResult?.query || "苹果",
    props.context?.activeResult || props.activeResult
  );

  const [inputText, setInputText] = useState<string>(initialData.sourceText);
  const [sourceLang, setSourceLang] = useState<string>(initialData.sourceLanguage || "zh");
  const [targetLang, setTargetLang] = useState<string>(initialData.targetLanguage || "en");
  
  const [translatedResult, setTranslatedResult] = useState<DictEntry | null>(() => {
    if (initialData.translation) {
      return {
        translation: initialData.translation,
        phonetic: initialData.phonetic,
        partOfSpeech: initialData.partOfSpeech,
        definition: initialData.definition,
        examples: initialData.examples
      };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // 当外部 query 变化时同步
  useEffect(() => {
    const rawQ = props.query || props.context?.activeResult?.query || props.activeResult?.query;
    if (rawQ) {
      const parsed = parseTranslationQuery(rawQ);
      setInputText(parsed.extractedText);
      setSourceLang(parsed.sourceLang);
      setTargetLang(parsed.targetLang);
    }
  }, [props.query, props.context?.activeResult, props.activeResult]);

  // 执行核心查词/翻译逻辑
  const performTranslation = (text: string, src: string, tgt: string) => {
    const cleanText = text.trim();
    if (!cleanText) {
      setTranslatedResult(null);
      return;
    }

    setIsLoading(true);

    const lowerClean = cleanText.toLowerCase();
    const hit = LOCAL_DICTIONARY[cleanText]?.[tgt] || LOCAL_DICTIONARY[lowerClean]?.[tgt];

    if (hit) {
      setTranslatedResult(hit);
      setIsLoading(false);
      return;
    }

    // 智能规则推导模拟翻译
    setTimeout(() => {
      let syntheticTranslation = "";
      if (tgt === "en") {
        syntheticTranslation = cleanText
          .split("")
          .map((ch) => (ch === "中" ? "China" : ch === "好" ? "Good" : ch))
          .join(" ");
        if (syntheticTranslation === cleanText) {
          syntheticTranslation = `${cleanText} (English translation)`;
        }
      } else if (tgt === "ja") {
        syntheticTranslation = `${cleanText} (日本語訳)`;
      } else if (tgt === "zh") {
        syntheticTranslation = `${cleanText} (中文释义)`;
      } else {
        syntheticTranslation = `${cleanText} [${tgt.toUpperCase()}]`;
      }

      setTranslatedResult({
        translation: syntheticTranslation,
        definition: `暂未收录本地离线词典完整条目，已为您极速呈现基础对照。`,
        partOfSpeech: "phrase"
      });
      setIsLoading(false);
    }, 150);
  };

  useEffect(() => {
    performTranslation(inputText, sourceLang, targetLang);
  }, [inputText, sourceLang, targetLang]);

  // 互换源语言和目标语言
  const handleSwapLangs = () => {
    const oldSource = sourceLang;
    const oldTarget = targetLang;
    setSourceLang(oldTarget);
    setTargetLang(oldSource);
    if (translatedResult?.translation) {
      setInputText(translatedResult.translation.replace(/\s*\(.*?\)/g, "").trim());
    }
  };

  // 语音合成朗读
  const handleSpeak = (textToSpeak: string, langCode: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const targetOption = SUPPORTED_LANGS.find((l) => l.code === langCode);
      if (targetOption?.voiceLang) {
        utterance.lang = targetOption.voiceLang;
      }
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  };

  // 复制结果
  const handleCopy = (text: string) => {
    if (!text) return;
    if (props.context?.copyText) {
      props.context.copyText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/5 rounded-2xl border border-indigo-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <Languages className="w-4 h-4" />
            <span>智能翻译词典</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 font-medium">
            {sourceLang.toUpperCase()} → {targetLang.toUpperCase()}
          </span>
        </div>
        <div className="my-2">
          <div className="text-xs text-muted-foreground truncate">{inputText || "输入词句"}</div>
          <div className="text-xl font-bold tracking-tight text-foreground mt-1 truncate">
            {translatedResult?.translation || "正在翻译..."}
          </div>
          {translatedResult?.phonetic && (
            <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
              {translatedResult.phonetic}
            </div>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{translatedResult?.partOfSpeech || "双语互译"}</span>
          <button
            onClick={() => handleCopy(translatedResult?.translation || "")}
            className="text-xs hover:text-foreground transition-colors"
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-indigo-500/10 via-card to-purple-600/5 rounded-3xl border border-indigo-500/20 shadow-xs">
      {/* 头部控制栏：语种切换器 */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/60 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <Languages className="w-4 h-4" />
          </span>
          <span className="text-sm font-bold text-foreground">双语精翻与词典</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 font-medium">
            极速直出
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-2xl border border-border/60 text-xs">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="bg-transparent font-medium px-2 py-1 outline-hidden text-foreground cursor-pointer text-xs"
          >
            {SUPPORTED_LANGS.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-popover text-popover-foreground">
                {lang.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleSwapLangs}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="互换语言"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="bg-transparent font-medium px-2 py-1 outline-hidden text-foreground cursor-pointer text-xs"
          >
            {SUPPORTED_LANGS.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-popover text-popover-foreground">
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 核心双语对照卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3 flex-1 min-h-0">
        {/* 输入源侧 */}
        <div className="flex flex-col justify-between p-3.5 rounded-2xl bg-background/60 border border-border/60">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>原文 ({sourceLang.toUpperCase()})</span>
              {inputText && (
                <button
                  onClick={() => setInputText("")}
                  className="hover:text-foreground transition-colors p-0.5"
                  title="清空"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="请输入需要翻译的词汇、短语或句子..."
              rows={3}
              className="w-full bg-transparent resize-none text-sm text-foreground outline-hidden placeholder:text-muted-foreground/60 leading-relaxed font-normal"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
            <span>{inputText.length} 字符</span>
            <button
              onClick={() => handleSpeak(inputText, sourceLang)}
              disabled={!inputText}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              title="朗读原文"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 译文与词典释义侧 */}
        <div className="flex flex-col justify-between p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 mb-1">
              <span>译文 ({targetLang.toUpperCase()})</span>
              {translatedResult?.partOfSpeech && (
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-indigo-500/10">
                  {translatedResult.partOfSpeech}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>正在进行精准释义...</span>
              </div>
            ) : translatedResult ? (
              <div>
                <div className="text-base font-bold text-foreground tracking-tight flex items-baseline gap-2 flex-wrap">
                  <span>{translatedResult.translation}</span>
                  {translatedResult.phonetic && (
                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-normal">
                      {translatedResult.phonetic}
                    </span>
                  )}
                </div>

                {translatedResult.definition && (
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {translatedResult.definition}
                  </p>
                )}

                {translatedResult.examples && translatedResult.examples.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-indigo-500/10 space-y-1.5">
                    <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-indigo-500" />
                      <span>双语权威例句</span>
                    </div>
                    {translatedResult.examples.map((ex, idx) => (
                      <div key={idx} className="text-xs bg-background/50 p-2 rounded-xl border border-border/40">
                        <div className="text-foreground font-medium">{ex.src}</div>
                        <div className="text-muted-foreground text-[11px] mt-0.5">{ex.dst}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4">暂无翻译结果</div>
            )}
          </div>

          <div className="flex items-center justify-end gap-1 pt-2 border-t border-indigo-500/10 text-xs">
            <button
              onClick={() => handleSpeak(translatedResult?.translation || "", targetLang)}
              disabled={!translatedResult?.translation}
              className="p-1 rounded-md hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 transition-colors"
              title="发音朗读"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleCopy(translatedResult?.translation || "")}
              disabled={!translatedResult?.translation}
              className="p-1 rounded-md hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 transition-colors"
              title="复制译文"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 底部快捷推荐词条 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          <span>高频词库:</span>
          {["苹果", "人工智能", "机器学习", "世界", "hello"].map((word) => (
            <button
              key={word}
              onClick={() => setInputText(word)}
              className="px-2 py-0.5 rounded-lg bg-background hover:bg-muted text-foreground text-[11px] border border-border/60 transition-colors"
            >
              {word}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-indigo-500/80 shrink-0 hidden sm:inline">本地引擎</span>
      </div>
    </div>
  );
};
