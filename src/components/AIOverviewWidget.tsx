import React, { useState } from "react";
import Markdown from "react-markdown";
import { SearchResult, DetectedLanguage } from "../types.js";
import { IOSWidget } from "./ui/IOSWidget.js";
import { 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Bookmark, 
  GitFork, 
  Scale,
  ShieldCheck
} from "lucide-react";

interface AIOverviewWidgetProps {
  summary: string;
  query: string;
  modelUsed: string;
  filteredResults: SearchResult[];
  detectedLanguage?: DetectedLanguage;
  onOpenMindMap?: () => void;
  onOpenComparison?: () => void;
}

export const AIOverviewWidget: React.FC<AIOverviewWidgetProps> = ({
  summary,
  query,
  modelUsed,
  filteredResults,
  detectedLanguage,
  onOpenMindMap,
  onOpenComparison
}) => {
  const [copied, setCopied] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);

  const modelShortName = modelUsed.split("/").pop()?.replace(":free", "") || "Llama 3.3 70B";

  const handleCopy = () => {
    const fullText = `# ${query} - AI 深度研报\n\n${summary}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayedSources = showAllSources ? filteredResults : filteredResults.slice(0, 4);

  return (
    <IOSWidget
      id="widget-ai-overview"
      title="AI 深度综合研报"
      subtitle={`多源交叉验证 · 模型: ${modelShortName} · 信源: ${filteredResults.length} 篇`}
      icon={<Sparkles className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
      badge={
        detectedLanguage ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center gap-1">
            <span>{detectedLanguage.flag}</span>
            <span>{detectedLanguage.name}</span>
            {detectedLanguage.crossLingualEnabled && (
              <span className="text-zinc-400">· 跨语言</span>
            )}
          </span>
        ) : undefined
      }
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="复制研报全文"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "已复制" : "复制"}</span>
          </button>
        </div>
      }
      className="w-full"
    >
      <div className="space-y-5">
        {/* Markdown Content in Gray & White Refined Typography */}
        <div className="prose prose-zinc dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed">
          <Markdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mt-4 mb-2">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mt-4 mb-2 pb-1 border-b border-zinc-200/80 dark:border-zinc-800">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-3 mb-1.5">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-zinc-800 dark:text-zinc-300 leading-7 my-2.5">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1.5 my-2.5 text-zinc-800 dark:text-zinc-300">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1.5 my-2.5 text-zinc-800 dark:text-zinc-300">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-6">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-3 border-zinc-400 dark:border-zinc-500 pl-3.5 py-1.5 my-3 italic text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 rounded-r-xl">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-700/60">
                  {children}
                </code>
              )
            }}
          >
            {summary}
          </Markdown>
        </div>

        {/* Citation Reference Chips in Gray & White */}
        {filteredResults.length > 0 && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" />
                <span>引用源卡片</span>
              </span>

              {filteredResults.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllSources(!showAllSources)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium"
                >
                  {showAllSources ? "收起" : `展开全部 ${filteredResults.length} 个`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
                    className="flex flex-col justify-between p-2.5 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                        <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center font-mono font-bold text-[9px]">
                          {idx + 1}
                        </span>
                        <span className="truncate">{host}</span>
                      </div>
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                        {res.title}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{res.engine || "web"}</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </IOSWidget>
  );
};
