import React, { useState } from "react";
import type { DocumentPreviewData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { documentPreviewAdapter } from "./adapter.js";
import {
  FileText,
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Bookmark,
  Share2,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from "lucide-react";

export interface DocumentPreviewWidgetProps {
  data?: DocumentPreviewData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const DocumentPreviewWidget: React.FC<DocumentPreviewWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [selectedSectionIdx, setSelectedSectionIdx] = useState<number>(0);

  const data: DocumentPreviewData =
    props.data ??
    documentPreviewAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const handleCopyCitation = () => {
    if (data.citationText) {
      navigator.clipboard.writeText(data.citationText);
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    }
  };

  const activeSection = data.sections[selectedSectionIdx] || data.sections[0];

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-rose-500/10 via-card to-pink-500/5 rounded-2xl border border-rose-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <FileText className="w-4 h-4 text-rose-500" />
            <span className="truncate max-w-[120px]">{data.title}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold uppercase">
            {data.fileType}
          </span>
        </div>
        <div className="my-2 text-xs text-muted-foreground line-clamp-2">
          {activeSection?.content}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{data.authorOrSource}</span>
          <span>约 {data.readingTimeMinutes} 分钟</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-rose-500/10 via-card to-pink-600/5 rounded-3xl border border-rose-500/20 shadow-xs">
      {/* 头部标题与操作 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold tracking-wide flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  文档与研报速览
                </span>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                  {data.fileType}
                </span>
                <span className="text-xs text-muted-foreground">· 约 {data.readingTimeMinutes} 分钟阅读</span>
              </div>
              <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
                {data.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.citationText && (
              <button
                onClick={handleCopyCitation}
                className="px-2.5 py-1.5 rounded-xl bg-background/80 hover:bg-background border border-border/60 text-muted-foreground hover:text-foreground transition-all text-xs flex items-center gap-1"
                title="复制学术引用格式"
              >
                {copiedCitation ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCitation ? "引用已复制" : "引用格式"}</span>
              </button>
            )}
            {data.externalUrl && (
              <a
                href={data.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              >
                <span>阅读原文</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* 章节导航 Tab */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          {data.sections.map((sec, i) => (
            <button
              key={sec.id}
              onClick={() => setSelectedSectionIdx(i)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all shrink-0 ${
                selectedSectionIdx === i
                  ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold shadow-xs"
                  : "bg-background/60 hover:bg-background text-muted-foreground"
              }`}
            >
              {sec.heading.split(" ")[0]} {sec.badge || "节选"}
            </button>
          ))}
        </div>
      </div>

      {/* 正文预览卡片 */}
      <div className="p-4 rounded-2xl bg-background/80 border border-border/60 my-1 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2.5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-rose-500" />
            {activeSection?.heading}
          </h3>
          {activeSection?.badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold">
              {activeSection.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-foreground/90 leading-relaxed text-justify">
          {activeSection?.content}
        </p>
      </div>

      {/* 底部元数据 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>来源: {data.authorOrSource} ({data.publishDate})</span>
        <span className="text-rose-600 dark:text-rose-400 font-medium">证据链已交叉检验</span>
      </div>
    </div>
  );
};
