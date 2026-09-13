import React from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Compass, ArrowUpRight } from "lucide-react";

interface FollowUpWidgetProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isCompact?: boolean;
}

/**
 * 延伸探索建议 (follow_up)
 *
 * shadcn/ui 重做要点：
 *   · 每行换用 shadcn 菜单行语汇 —— hover:bg-accent + hover:text-accent-foreground，
 *     rounded-md，文字 text-sm，右侧箭头 text-muted-foreground，
 *     取代此前的 hover 灰色写字与 text-[13px] 等任意值；
 *   · 移除逐行边框与阴影，行与行之间只靠留白区分。
 */
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
      icon={<Compass className="size-4" />}
      className="w-full"
    >
      <div className={`flex flex-col ${isCompact ? "gap-0.5" : "gap-1"}`}>
        {questions.map((question, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onQuestionClick(question)}
            className="group/row flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
          >
            <span className="min-w-0 flex-1 text-sm leading-5 text-foreground group-hover/row:text-accent-foreground line-clamp-2">
              {question}
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-accent-foreground" />
          </button>
        ))}
      </div>
    </IOSWidget>
  );
};
