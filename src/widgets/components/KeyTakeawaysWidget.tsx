import React from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { ListChecks } from "lucide-react";

interface KeyTakeawaysWidgetProps {
  keyTakeaways: string[];
  isCompact?: boolean;
}

/**
 * 核心结论速览 (takeaways)
 *
 * shadcn/ui 重做要点：
 *   · 序号由实心圆形徽标改为 Badge（secondary + 正方形小圆角），
 *     与 shadcn Badge 的 rounded-md 语汇一致；
 *   · 结论正文用 text-sm leading-6 text-foreground，紧凑档降为 text-xs；
 *   · 行距通过 gap 控制，取消每条结论的独立卡片外壳。
 */
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
      icon={<ListChecks className="size-4" />}
      badge={<span className="text-xs text-muted-foreground">{keyTakeaways.length} 条</span>}
      className="w-full"
    >
      <ol className={`flex flex-col ${isCompact ? "gap-2" : "gap-2.5"}`}>
        {keyTakeaways.map((takeaway, index) => (
          <li key={index} className="flex items-start gap-2.5">
            <Badge
              variant="secondary"
              className="mt-0.5 size-5 shrink-0 justify-center rounded-md p-0 tabular-nums"
            >
              {index + 1}
            </Badge>
            <p
              className={`${isCompact ? "text-xs" : "text-sm"} leading-6 text-foreground`}
            >
              {takeaway}
            </p>
          </li>
        ))}
      </ol>
    </IOSWidget>
  );
};
