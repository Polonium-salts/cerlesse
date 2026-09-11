import React, { useState } from "react";
import Markdown from "react-markdown";
import { SearchResult, DetectedLanguage } from "../types.js";
import { 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Bookmark, 
  Share2, 
  ArrowRight,
  ShieldCheck,
  Globe
} from "lucide-react";

interface GoogleAIOverviewProps {
  summary: string;
  keyTakeaways: string[];
  followUpQuestions: string[];
  filteredResults: SearchResult[];
  modelUsed: string;
  onFollowUpClick: (question: string) => void;
  query: string;
  detectedLanguage?: DetectedLanguage;
  onOpenMindMap?: () => void;
  onOpenComparison?: () => void;
}

export const GoogleAIOverview: React.FC<GoogleAIOverviewProps> = ({
  summary,
  keyTakeaways,
  followUpQuestions,
  filteredResults,
  modelUsed,
  onFollowUpClick,
  query,
  detectedLanguage,
  onOpenMindMap,
  onOpenComparison
}) => {
  const [copied, setCopied] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const [expandedTakeaways, setExpandedTakeaways] = useState(true);

  const modelShortName = modelUsed.split("/").pop()?.replace(":free", "") || "Llama 3.3 70B";

  const handleCopy = () => {
    const fullText = `# ${query} - Google AI 概览与综合研报\n\n` + 
      summary + 
      "\n\n### 核心结论\n" + 
      keyTakeaways.map(k => `- ${k}`).join("\n");
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayedSources = showAllSources ? filteredResults : filteredResults.slice(0, 4);

  return (
    <div className="rounded-3xl border border-[#d3e3fd] dark:border-[#3c4043] bg-[#f8fafd] dark:bg-[#303134] p-5 sm:p-7 shadow-xs mb-8 transition-colors">
      {/* Top Banner: Google AI Overview Branding */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e1eaf8] dark:border-[#3c4043]">
        <div className="flex items-center gap-2.5">
          {/* Google 4-color Sparkle Icon */}
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-[#e8eaed]">
                AI 概览
              </h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                已交叉验证
              </span>
              {detectedLanguage && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <span>{detectedLanguage.flag}</span>
                  <span>{detectedLanguage.name}理解</span>
                  {detectedLanguage.crossLingualEnabled && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">· 跨语言检索</span>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-[#9aa0a6] mt-0.5">
              基于 {filteredResults.length} 个实时公开信源综合提炼 · 引擎：SearXNG · 模型：{modelShortName}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            title="复制 AI 概览内容"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "已复制" : "复制"}</span>
          </button>

          {onOpenMindMap && (
            <button
              onClick={onOpenMindMap}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
            >
              <span>思维导图</span>
            </button>
          )}
        </div>
      </div>

      {/* Key Takeaways Cards */}
      {keyTakeaways && keyTakeaways.length > 0 && (
        <div className="my-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              核心要点速览
            </span>
            <button
              onClick={() => setExpandedTakeaways(!expandedTakeaways)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1"
            >
              <span>{expandedTakeaways ? "折叠" : "展开"}</span>
              {expandedTakeaways ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {expandedTakeaways && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {keyTakeaways.map((takeaway, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-white dark:bg-[#202124] border border-[#dfe1e5] dark:border-[#3c4043] shadow-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-sm text-zinc-800 dark:text-[#e8eaed] leading-relaxed">
                    {takeaway}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Markdown Synthesis Body */}
      <div className="prose prose-zinc dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed my-4">
        <Markdown
          components={{
            h1: ({ children }) => <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#e8eaed] mt-5 mb-2.5">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-[#e8eaed] mt-5 mb-2 pb-1 border-b border-zinc-200 dark:border-zinc-700">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-[#e8eaed] mt-4 mb-2">{children}</h3>,
            p: ({ children }) => <p className="text-zinc-800 dark:text-[#bdc1c6] leading-7 my-2.5">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 my-2.5 text-zinc-800 dark:text-[#bdc1c6]">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1.5 my-2.5 text-zinc-800 dark:text-[#bdc1c6]">{children}</ol>,
            li: ({ children }) => <li className="leading-6">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-3 border-blue-500 pl-4 py-1.5 italic my-3 text-zinc-600 dark:text-zinc-400 bg-white/60 dark:bg-zinc-900/40 rounded-r-xl">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-800 dark:text-zinc-200">
                {children}
              </code>
            )
          }}
        >
          {summary}
        </Markdown>
      </div>

      {/* Google SGE Citation Chips Ribbon */}
      {filteredResults.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#e1eaf8] dark:border-[#3c4043]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-blue-500" />
              <span>验证信源 ({filteredResults.length})</span>
            </span>

            {filteredResults.length > 4 && (
              <button
                onClick={() => setShowAllSources(!showAllSources)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>{showAllSources ? "收起部分" : `查看全部 ${filteredResults.length} 个信源`}</span>
                {showAllSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {displayedSources.map((res, idx) => {
              let host = "";
              try {
                host = new URL(res.url).hostname;
              } catch {
                host = res.url;
              }
              return (
                <a
                  key={res.id || idx}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-between p-2.5 rounded-xl border border-[#dfe1e5] dark:border-[#3c4043] bg-white dark:bg-[#202124] hover:shadow-xs hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span className="w-3.5 h-3.5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-mono font-bold text-[9px]">
                        {idx + 1}
                      </span>
                      <span className="truncate">{host}</span>
                    </div>
                    <p className="text-xs font-medium text-zinc-900 dark:text-[#e8eaed] group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2 leading-snug">
                      {res.title}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>{res.engine || "web"}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* People Also Ask / Follow Up Questions */}
      {followUpQuestions && followUpQuestions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#e1eaf8] dark:border-[#3c4043]">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-2.5">
            其他人还在搜
          </span>
          <div className="flex flex-col gap-2">
            {followUpQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onFollowUpClick(q)}
                className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#202124] border border-[#dfe1e5] dark:border-[#3c4043] hover:border-zinc-400 dark:hover:border-zinc-500 text-left text-xs sm:text-sm text-zinc-800 dark:text-[#e8eaed] transition-all group cursor-pointer"
              >
                <span className="font-medium">{q}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
