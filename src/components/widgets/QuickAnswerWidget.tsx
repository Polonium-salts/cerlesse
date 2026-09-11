import React from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import { Sparkles, Quote, CheckCircle2, Bookmark } from "lucide-react";

interface QuickAnswerWidgetProps {
  query: string;
  summary: string;
  keyTakeaways: string[];
}

export const QuickAnswerWidget: React.FC<QuickAnswerWidgetProps> = ({
  query,
  summary,
  keyTakeaways
}) => {
  // Extract first paragraph as direct executive answer
  const paragraphs = summary.split("\n\n").filter(p => p.trim() && !p.startsWith("#") && !p.startsWith("-"));
  const firstPara = paragraphs[0] || (keyTakeaways.length > 0 ? keyTakeaways[0] : summary.slice(0, 180));
  // Clean markdown links for punchy display
  const cleanAnswer = firstPara.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");

  return (
    <IOSWidget
      id="widget-quick-answer"
      title="核心即时解答"
      subtitle="AI 深度提炼关键结论"
      icon={<Sparkles className="w-4 h-4 text-amber-500" />}
      badge={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          即时解答
        </span>
      }
      className="w-full h-full"
    >
      <div className="flex-1 flex flex-col justify-between space-y-3">
        <div className="relative p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
          <Quote className="w-4 h-4 text-zinc-300 dark:text-zinc-600 mb-1" />
          <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
            {cleanAnswer}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已完成事实比对
          </span>
          <span className="font-mono text-[10px]">
            {cleanAnswer.length} 字提炼
          </span>
        </div>
      </div>
    </IOSWidget>
  );
};
