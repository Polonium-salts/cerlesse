import React, { useState } from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import { 
  SlidersHorizontal, 
  Copy, 
  Check, 
  FileDown, 
  Share2, 
  Volume2, 
  Sparkles, 
  Zap, 
  RefreshCw,
  Search,
  CheckCircle2
} from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";

interface QuickActionsToolboxWidgetProps {
  result: SearchSynthesisResult;
  onDeepSearchToggle?: () => void;
  onReSearch?: () => void;
  onOpenForgeModal?: () => void;
}

export const QuickActionsToolboxWidget: React.FC<QuickActionsToolboxWidgetProps> = ({
  result,
  onDeepSearchToggle,
  onReSearch,
  onOpenForgeModal
}) => {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [deepMode, setDeepMode] = useState(false);

  const handleCopy = () => {
    const fullText = `# ${result.query} - 核心研报\n\n${result.summary}\n\n## 核心速览\n${result.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    setExporting(true);
    const fullText = `# ${result.query} - 深度研报\n\n生成时间: ${new Date(result.timestamp).toLocaleString()}\n模型: ${result.modelUsed}\n\n## 核心速览\n${result.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n## 研报正文\n${result.summary}\n\n## 参考文献\n${result.filteredResults.map((r, i) => `[${i + 1}] ${r.title} - ${r.url}`).join("\n")}`;
    
    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.query}_research_report.md`;
    link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExporting(false), 1000);
  };

  const handlePlayAudio = () => {
    if ('speechSynthesis' in window) {
      if (isPlayingAudio) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      } else {
        const cleanText = result.keyTakeaways.join(". ");
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "zh-CN";
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        setIsPlayingAudio(true);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <IOSWidget
      id="widget-quick-actions"
      title="快捷控制与工具箱"
      subtitle="操作指令与研报导出"
      icon={<SlidersHorizontal className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
      className="w-full h-full"
    >
      <div className="flex-1 flex flex-col justify-between space-y-3.5">
        {/* Buttons Row (like in the top-left of the screenshot) */}
        <div>
          <span className="text-[11px] font-medium text-zinc-400 block mb-1.5">导出与共享</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-all text-xs font-semibold shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "已复制" : "复制研报"}</span>
            </button>

            <button
              onClick={handleExportMarkdown}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-all text-xs font-semibold border border-zinc-200/60 dark:border-zinc-700/60 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{exporting ? "导出中..." : "导出 MD"}</span>
            </button>
          </div>
        </div>

        {/* Secondary Action Row */}
        <div>
          <span className="text-[11px] font-medium text-zinc-400 block mb-1.5">智能辅助与组件</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePlayAudio}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                isPlayingAudio 
                  ? "bg-blue-500 text-white border-blue-600 animate-pulse" 
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="truncate">{isPlayingAudio ? "朗读中..." : "语音朗读"}</span>
            </button>

            {onOpenForgeModal && (
              <button
                onClick={onOpenForgeModal}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all border border-blue-500/30 bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 cursor-pointer shadow-2xs"
                title="根据本次搜索结果智能生成独有卡片"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="truncate">独有卡片工坊</span>
              </button>
            )}
          </div>
        </div>

        {/* Toggle Switch Row (like buttons/switches in screenshot) */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">深度多源模式</span>
            </div>
            <button
              onClick={() => setDeepMode(!deepMode)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                deepMode ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <div 
                className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-900 transition-transform ${
                  deepMode ? "translate-x-4" : "translate-x-0"
                }`} 
              />
            </button>
          </div>
        </div>
      </div>
    </IOSWidget>
  );
};
