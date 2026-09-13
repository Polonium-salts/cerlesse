import React, { useState } from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Button } from "../../components/ui/button.js";
import { SlidersHorizontal, Copy, Check, FileDown, Volume2, Sparkles } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";

interface QuickActionsToolboxWidgetProps {
  result: SearchSynthesisResult;
  onOpenForgeModal?: () => void;
}

/**
 * 快捷工具箱 (actions_toolbox)
 *
 * shadcn/ui 重做要点：
 *   · 四个动作全部换用 shadcn Button：主操作 default、其余 outline，
 *     统一 h-9 / rounded-md / text-sm / shadow-xs，取代此前的药丸按钮与手写 bg；
 *   · 仍保持 2×2 网格，只保留四个真实可用的动作
 *     （复制研报 / 导出 MD / 语音朗读 / 独有卡片工坊），无装饰性开关。
 */
export const QuickActionsToolboxWidget: React.FC<QuickActionsToolboxWidgetProps> = ({
  result,
  onOpenForgeModal
}) => {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleCopy = () => {
    const fullText = `# ${result.query} - 核心研报\n\n${result.summary}\n\n## 核心速览\n${result.keyTakeaways
      .map((t, i) => `${i + 1}. ${t}`)
      .join("\n")}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    setExporting(true);
    const fullText = `# ${result.query} - 深度研报\n\n生成时间: ${new Date(
      result.timestamp
    ).toLocaleString()}\n模型: ${result.modelUsed}\n\n## 核心速览\n${result.keyTakeaways
      .map((t, i) => `${i + 1}. ${t}`)
      .join("\n")}\n\n## 研报正文\n${result.summary}\n\n## 参考文献\n${result.filteredResults
      .map((r, i) => `[${i + 1}] ${r.title} - ${r.url}`)
      .join("\n")}`;

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
    if (!("speechSynthesis" in window)) return;
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(result.keyTakeaways.join(". "));
    utterance.lang = "zh-CN";
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <IOSWidget
      id="widget-quick-actions"
      title="快捷工具箱"
      icon={<SlidersHorizontal className="size-4" />}
      className="w-full h-full"
    >
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleCopy}>
          {copied ? <Check /> : <Copy />}
          <span>{copied ? "已复制" : "复制研报"}</span>
        </Button>

        <Button variant="outline" onClick={handleExportMarkdown}>
          <FileDown />
          <span>{exporting ? "导出中..." : "导出 MD"}</span>
        </Button>

        <Button
          variant={isPlayingAudio ? "default" : "outline"}
          onClick={handlePlayAudio}
          className="min-w-0"
        >
          <Volume2 />
          <span className="truncate">{isPlayingAudio ? "朗读中..." : "语音朗读"}</span>
        </Button>

        {onOpenForgeModal && (
          <Button
            variant="outline"
            onClick={onOpenForgeModal}
            title="根据本次搜索结果智能生成独有卡片"
            className="min-w-0"
          >
            <Sparkles />
            <span className="truncate">独有卡片工坊</span>
          </Button>
        )}
      </div>
    </IOSWidget>
  );
};
