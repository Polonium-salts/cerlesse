import React, { useState } from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Button } from "../../components/ui/button.js";
import { MarkdownContent } from "./MarkdownContent.js";
import { Sparkles, Copy, Check } from "lucide-react";
import type { WidgetPlannedSize } from "../../types.js";

interface QuickAnswerWidgetProps {
  query: string;
  summary: string;
  keyTakeaways: string[];
  /** 真实信源篇数（res.filteredResults.length），0 时不渲染该行 */
  sourceCount?: number;
  /** 检索到的语言名（res.detectedLanguage?.name），缺失时不渲染该行 */
  languageName?: string;
  size?: WidgetPlannedSize | "wide";
  copyText?: (text: string) => void;
}

/**
 * 直接速答 (quick_answer)
 *
 * 答案头条形态：
 *   · 主答案改用 MarkdownContent 渲染 —— 保留 summary 的行内引文 [1](url) 与粗体，
 *     此前用正则把引文剥成纯文字，锚点磁贴上的信源链接全部丢失；
 *   · 宽磁贴（wide/full）双栏：正文 + 右侧上下文栏；窄档自动退化单栏；
 *   · 上下文栏只渲染真实值（原始查询 / 语言 / 信源数），缺数据整行不渲染 —— 不填占位、不编造；
 *   · 复制动作走 Button，两态切换，与 ai_overview 写法一致。
 * 不做要点列表（那是「核心结论速览」takeaways 的职责），不引入任何置信度/质检类编造指标。
 */
export const QuickAnswerWidget: React.FC<QuickAnswerWidgetProps> = ({
  query,
  summary,
  keyTakeaways,
  sourceCount = 0,
  languageName,
  size,
  copyText
}) => {
  const [copied, setCopied] = useState(false);

  // 取正文首段作为直接答案；无正文时回落首条结论，再回落截断原文
  const paragraphs = (summary || "")
    .split("\n\n")
    .filter((p) => p.trim() && !p.startsWith("#") && !p.startsWith("-"));
  const answer =
    paragraphs[0] || (keyTakeaways?.length > 0 ? keyTakeaways[0] : (summary || "").slice(0, 180));

  const handleCopy = () => {
    (copyText || ((text: string) => navigator.clipboard?.writeText(text)))(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 仅宽档铺开右侧上下文栏；medium/large 空间不足以并排，退化为单栏
  const showRail = size === "wide" || size === "full";
  const metaRows = (
    [
      query ? { label: "原始查询", value: query } : null,
      languageName ? { label: "语言", value: languageName } : null,
      sourceCount > 0 ? { label: "信源", value: `${sourceCount} 篇` } : null
    ] as Array<{ label: string; value: string } | null>
  ).filter((row): row is { label: string; value: string } => row !== null);

  return (
    <IOSWidget
      id="widget-quick-answer"
      title="核心即时解答"
      icon={<Sparkles className="size-4" />}
      actions={
        <Button variant="outline" size="sm" onClick={handleCopy} title="复制即答正文">
          {copied ? <Check /> : <Copy />}
          <span>{copied ? "已复制" : "复制"}</span>
        </Button>
      }
      className="w-full h-full"
    >
      <div className="flex flex-1 min-h-0 gap-4">
        <div className="min-w-0 flex-1">
          <MarkdownContent className="[&_p]:my-0 [&_p]:text-[15px] [&_p]:leading-7">
            {answer}
          </MarkdownContent>
        </div>

        {showRail && metaRows.length > 0 && (
          <aside className="flex w-[168px] shrink-0 flex-col gap-3 rounded-lg border bg-muted/40 p-3">
            {metaRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="break-words text-xs leading-5 text-foreground">{row.value}</span>
              </div>
            ))}
          </aside>
        )}
      </div>
    </IOSWidget>
  );
};
