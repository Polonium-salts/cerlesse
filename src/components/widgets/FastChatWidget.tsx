import React, { useState } from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import { MessageSquare, Send, Sparkles, RefreshCw } from "lucide-react";

interface FastChatWidgetProps {
  query: string;
  followUpQuestions?: string[];
  onAsk: (question: string) => void;
}

export const FastChatWidget: React.FC<FastChatWidgetProps> = ({
  query,
  followUpQuestions = [],
  onAsk
}) => {
  const [inputVal, setInputVal] = useState("");

  const defaultPrompts = followUpQuestions.length > 0
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
      title="智能追问与新对话"
      subtitle="随时针对研报发起深度下钻"
      icon={<MessageSquare className="w-4 h-4 text-purple-500" />}
      badge={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1 font-mono">
          <Sparkles className="w-3 h-3 text-purple-500" />
          <span>实时下钻</span>
        </span>
      }
      className="w-full h-full"
    >
      <div className="flex-1 flex flex-col justify-between space-y-3">
        {/* Chat Prompt Greeting like in reference image: "今天我能帮您什么忙? 早上好" */}
        <div>
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>今天我能帮您探讨什么？</span>
            <button
              onClick={() => onAsk(defaultPrompts[Math.floor(Math.random() * defaultPrompts.length)])}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="随机提问"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Agent 已就绪，您可以点击下方快捷问题或输入新疑问：
          </p>
        </div>

        {/* Quick prompt pills */}
        <div className="space-y-1.5">
          {defaultPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => onAsk(q)}
              className="w-full text-left p-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/50 text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors line-clamp-1 cursor-pointer flex items-center gap-1.5 group"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 group-hover:scale-125 transition-transform shrink-0" />
              <span className="truncate">{q}</span>
            </button>
          ))}
        </div>

        {/* Inline Input Form */}
        <form onSubmit={handleSubmit} className="relative flex items-center pt-1">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="输入针对此研报的追问..."
            className="w-full py-2 pl-3 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="absolute right-1.5 p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </IOSWidget>
  );
};
