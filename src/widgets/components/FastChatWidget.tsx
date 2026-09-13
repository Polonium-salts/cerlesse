import React, { useState } from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { MessageSquare, Send, Plus } from "lucide-react";

interface FastChatWidgetProps {
  query: string;
  followUpQuestions?: string[];
  onAsk: (question: string) => void;
}

/**
 * 追问 (fast_chat)
 *
 * shadcn/ui 重做要点：
 *   · 输入区改为 shadcn 标准组合：Input（h-9 / rounded-md / border-input /
 *     focus-visible:ring-[3px]）+ Button size="icon" 发送键，
 *     取代此前的"药丸输入框 + 内嵌圆形按钮"；
 *   · 快捷问句行换用 shadcn 菜单行语汇（hover:bg-accent / rounded-md）；
 *   · 发送键在无输入时 disabled:opacity-50，符合 shadcn 禁用态规范。
 */
export const FastChatWidget: React.FC<FastChatWidgetProps> = ({
  query,
  followUpQuestions = [],
  onAsk
}) => {
  const [inputVal, setInputVal] = useState("");

  const defaultPrompts =
    followUpQuestions.length > 0
      ? followUpQuestions.slice(0, 3)
      : [
          "能简要总结该主题的核心优缺点吗？",
          "针对实际项目，有什么落地实践建议？",
          "与同类方案横向对比，选型优先级如何？"
        ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onAsk(inputVal.trim());
    setInputVal("");
  };

  return (
    <IOSWidget
      id="widget-fast-chat"
      title="追问"
      icon={<MessageSquare className="size-4" />}
      className="w-full h-full"
    >
      <div className="flex flex-1 flex-col justify-between gap-3">
        {/* 快捷问句：shadcn 菜单行 */}
        <div className="flex flex-col gap-0.5">
          {defaultPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onAsk(q)}
              className="group/row flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
            >
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs text-muted-foreground group-hover/row:text-accent-foreground">
                {q}
              </span>
            </button>
          ))}
        </div>

        {/* 输入区：shadcn Input + Icon Button */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="输入针对此研报的追问..."
          />
          <Button type="submit" size="icon" disabled={!inputVal.trim()} title="发送追问">
            <Send />
          </Button>
        </form>
      </div>
    </IOSWidget>
  );
};
