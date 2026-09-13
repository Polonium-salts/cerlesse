import React, { useState } from "react";
import { SearchResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Button } from "../../components/ui/button.js";
import { MarkdownContent } from "./MarkdownContent.js";
import { Sparkles, Copy, Check } from "lucide-react";

interface AIOverviewWidgetProps {
  summary: string;
  query: string;
  modelUsed: string;
  filteredResults: SearchResult[];
}

/**
 * AI 深度综合研报 (ai_overview)
 *
 * shadcn/ui 重做要点：
 *   · 头部动作由"药丸按钮 + 硬编码 zinc 底色"改为 shadcn Button（outline / sm）；
 *   · Markdown 排版整体交给共用的 MarkdownContent（shadcn Typography 语汇）；
 *   · 信源清单仍由 SourcesListWidget 专职呈现，此处不重复渲染。
 */
export const AIOverviewWidget: React.FC<AIOverviewWidgetProps> = ({
  summary,
  query,
  modelUsed,
  filteredResults
}) => {
  const [copied, setCopied] = useState(false);

  const modelShortName =
    modelUsed.split("/").pop()?.replace(":free", "") || "Llama 3.3 70B";

  const handleCopy = () => {
    const fullText = `# ${query} - AI 深度研报\n\n${summary}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IOSWidget
      id="widget-ai-overview"
      title="AI 深度综合研报"
      subtitle={`信源 ${filteredResults.length} 篇 · ${modelShortName}`}
      icon={<Sparkles className="size-4" />}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          title="复制研报全文"
        >
          {copied ? <Check /> : <Copy />}
          <span>{copied ? "已复制" : "复制"}</span>
        </Button>
      }
      className="w-full"
    >
      <MarkdownContent>{summary}</MarkdownContent>
    </IOSWidget>
  );
};
