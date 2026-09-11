import React from "react";
import { IOSWidget } from "./ui/IOSWidget.js";
import { ListChecks, CheckCircle2, Bookmark } from "lucide-react";

interface KeyTakeawaysWidgetProps {
  keyTakeaways: string[];
  isCompact?: boolean;
}

export const KeyTakeawaysWidget: React.FC<KeyTakeawaysWidgetProps> = ({
  keyTakeaways,
  isCompact = false
}) => {
  if (!keyTakeaways || keyTakeaways.length === 0) {
    return null;
  }

  return (
    <IOSWidget
      id="widget-key-takeaways"
      title="核心结论速览"
      subtitle={isCompact ? undefined : "关键洞见快速浏览"}
      icon={<ListChecks className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
      badge={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
          {keyTakeaways.length} 条
        </span>
      }
      className="w-full"
    >
      <div className={`flex flex-col ${isCompact ? "space-y-2" : "space-y-2.5"}`}>
        {keyTakeaways.map((takeaway, index) => (
          <div
            key={index}
            className={`flex items-start gap-2.5 ${
              isCompact ? "p-2.5 rounded-xl" : "p-3.5 rounded-2xl"
            } bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors`}
          >
            <span className={`${isCompact ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-[11px]"} rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}>
              {index + 1}
            </span>
            <p className={`${isCompact ? "text-xs" : "text-xs sm:text-sm"} text-zinc-900 dark:text-zinc-100 leading-relaxed font-normal`}>
              {takeaway}
            </p>
          </div>
        ))}
      </div>
    </IOSWidget>
  );
};
