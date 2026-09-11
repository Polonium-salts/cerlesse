import React, { useState } from "react";
import Markdown from "react-markdown";
import { IOSWidget } from "../ui/IOSWidget.js";
import { FileText, Layers, ChevronRight, Bookmark, Sparkles, ExternalLink } from "lucide-react";
import { SearchResult } from "../../types.js";

interface TopicDigestWidgetProps {
  summary: string;
  query: string;
  filteredResults: SearchResult[];
}

export const TopicDigestWidget: React.FC<TopicDigestWidgetProps> = ({
  summary,
  query,
  filteredResults
}) => {
  // Parse sections based on markdown headers (## or ###)
  const sections = React.useMemo(() => {
    const rawSections = summary.split(/(?=\n##\s)/g).filter(s => s.trim().length > 0);
    if (rawSections.length <= 1) {
      // Split into paragraphs if no markdown h2 headers exist
      const paras = summary.split("\n\n").filter(p => p.trim());
      return [
        {
          title: "核心研报解析",
          content: paras.slice(0, 3).join("\n\n")
        },
        paras.length > 3 ? {
          title: "架构与技术要点",
          content: paras.slice(3).join("\n\n")
        } : null
      ].filter(Boolean) as { title: string; content: string }[];
    }

    return rawSections.map((sec, idx) => {
      const lines = sec.trim().split("\n");
      const firstLine = lines[0].replace(/^##\s*/, "").replace(/^#\s*/, "");
      const body = lines.slice(1).join("\n").trim();
      return {
        title: firstLine || `专题分面 ${idx + 1}`,
        content: body || lines[0]
      };
    });
  }, [summary]);

  const [activeSecIndex, setActiveSecIndex] = useState(0);
  const currentSection = sections[activeSecIndex] || sections[0];

  return (
    <IOSWidget
      id="widget-topic-digest"
      title="分面专题研报"
      subtitle={`多维度拆解 (${sections.length} 个专题)`}
      icon={<Layers className="w-4 h-4 text-purple-500" />}
      badge={
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          深度分面
        </span>
      }
      className="w-full h-full"
    >
      <div className="flex-1 flex flex-col justify-between space-y-3">
        {/* Section Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {sections.map((sec, index) => (
            <button
              key={index}
              onClick={() => setActiveSecIndex(index)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeSecIndex === index
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50"
              }`}
            >
              {sec.title}
            </button>
          ))}
        </div>

        {/* Section Content Area */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 flex-1 min-h-[120px] max-h-[260px] overflow-y-auto">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
            <span>{currentSection?.title}</span>
          </h4>
          <div className="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            <Markdown>{currentSection?.content || ""}</Markdown>
          </div>
        </div>

        {/* Bottom meta & switch */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400">
          <span>专题 {activeSecIndex + 1} / {sections.length}</span>
          {activeSecIndex < sections.length - 1 && (
            <button
              onClick={() => setActiveSecIndex((prev) => Math.min(sections.length - 1, prev + 1))}
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>下一专题</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </IOSWidget>
  );
};
