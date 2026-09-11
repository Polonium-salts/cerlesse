import React from "react";
import { IOSWidget } from "./ui/IOSWidget.js";
import { Compass, ArrowUpRight } from "lucide-react";

interface FollowUpWidgetProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isCompact?: boolean;
}

export const FollowUpWidget: React.FC<FollowUpWidgetProps> = ({
  questions,
  onQuestionClick,
  isCompact = false
}) => {
  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <IOSWidget
      id="widget-follow-ups"
      title="延伸探索建议"
      subtitle={isCompact ? undefined : "相关主题与深入挖掘"}
      icon={<Compass className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
      className="w-full"
    >
      <div className={`flex flex-col ${isCompact ? "space-y-1.5" : "space-y-2.5"}`}>
        {questions.map((question, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onQuestionClick(question)}
            className={`w-full flex items-center justify-between ${
              isCompact ? "p-2.5 rounded-xl" : "p-3.5 rounded-2xl"
            } bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 text-left transition-all group cursor-pointer`}
          >
            <span className={`${isCompact ? "text-xs" : "text-xs sm:text-sm"} font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white line-clamp-2`}>
              {question}
            </span>
            <div className={`${isCompact ? "w-5 h-5 rounded-lg" : "w-6 h-6 rounded-xl"} bg-white dark:bg-zinc-700/90 text-zinc-500 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white flex items-center justify-center shrink-0 ml-2 border border-zinc-200/60 dark:border-zinc-600 shadow-2xs group-hover:scale-105 transition-all`}>
              <ArrowUpRight className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            </div>
          </button>
        ))}
      </div>
    </IOSWidget>
  );
};
