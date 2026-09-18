import React, { useState } from "react";
import type { CodePlaygroundData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { codePlaygroundAdapter } from "./adapter.js";
import {
  Play,
  Copy,
  Check,
  RotateCcw,
  Terminal,
  Code2,
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCircle2
} from "lucide-react";

export interface CodePlaygroundWidgetProps {
  data?: CodePlaygroundData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const CodePlaygroundWidget: React.FC<CodePlaygroundWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  
  const initialData: CodePlaygroundData =
    props.data ??
    codePlaygroundAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  const [activeTab, setActiveTab] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [customCode, setCustomCode] = useState<string>(initialData.snippets[0]?.code || "");
  const [consoleOutput, setConsoleOutput] = useState<string>(initialData.snippets[0]?.output || "");
  const [execTime, setExecTime] = useState<number>(initialData.snippets[0]?.executionTimeMs || 120);

  const currentSnippet = initialData.snippets[activeTab] || initialData.snippets[0];

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    const snip = initialData.snippets[index];
    if (snip) {
      setCustomCode(snip.code);
      setConsoleOutput(snip.output || "");
      setExecTime(snip.executionTimeMs || 120);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setExecTime(Math.floor(Math.random() * 80 + 20));
      setConsoleOutput(
        currentSnippet.output ||
          `[Sandbox Runtime] 脚本执行成功。\n返回值: 0 (Exit Code 0)\n耗时: ${execTime}ms`
      );
    }, 400);
  };

  const handleReset = () => {
    setCustomCode(currentSnippet.code);
    setConsoleOutput(currentSnippet.output || "");
  };

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 rounded-2xl border border-amber-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Code2 className="w-4 h-4 text-amber-500" />
            <span className="truncate max-w-[120px]">{currentSnippet.title}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono">
            {currentSnippet.language}
          </span>
        </div>
        <div className="my-2 p-2 rounded-xl bg-zinc-950 text-zinc-300 font-mono text-[11px] truncate">
          {customCode.split("\n")[0] || "// 代码片段"}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>可交互编辑</span>
          <span className="text-amber-500 font-medium">即时运行</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-amber-500/10 via-card to-orange-600/5 rounded-3xl border border-amber-500/20 shadow-xs">
      {/* 头部控制器 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold tracking-wide flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5" />
                交互式代码演练场
              </span>
              <span className="text-xs font-mono text-muted-foreground">JS / TS / Python 沙箱</span>
            </div>
            <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
              {initialData.title}
            </h2>
          </div>

          {/* 操作按钮组 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-background/80 hover:bg-background border border-border/60 text-muted-foreground hover:text-foreground transition-all text-xs flex items-center gap-1"
              title="重置初始代码"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置</span>
            </button>
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-background/80 hover:bg-background border border-border/60 text-muted-foreground hover:text-foreground transition-all text-xs flex items-center gap-1"
              title="复制代码"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "已复制" : "复制"}</span>
            </button>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold transition-all flex items-center gap-1.5 text-xs shadow-xs"
            >
              <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : "fill-current"}`} />
              <span>{isRunning ? "执行中..." : "运行代码"}</span>
            </button>
          </div>
        </div>

        {/* Tab 选项卡 */}
        {initialData.snippets.length > 1 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
            {initialData.snippets.map((snip, idx) => (
              <button
                key={snip.id}
                onClick={() => handleTabChange(idx)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  activeTab === idx
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold shadow-xs"
                    : "bg-background/60 hover:bg-background text-muted-foreground"
                }`}
              >
                {snip.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 代码编辑区与控制台输出左右/上下分栏 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-1">
        {/* 左侧编辑器 */}
        <div className="rounded-2xl bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 flex flex-col overflow-hidden shadow-inner">
          <div className="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-mono">{currentSnippet.language}</span>
            <span className="text-[10px] text-zinc-500">可自由编辑</span>
          </div>
          <textarea
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            className="w-full h-56 p-3 bg-transparent text-zinc-100 font-mono text-xs resize-none focus:outline-none leading-relaxed selection:bg-amber-500/30"
            spellCheck={false}
          />
        </div>

        {/* 右侧控制台输出 */}
        <div className="rounded-2xl bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 flex flex-col overflow-hidden shadow-inner">
          <div className="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <Terminal className="w-3.5 h-3.5" />
              Console Output
            </span>
            <span className="text-[10px] font-mono text-zinc-500">{execTime}ms</span>
          </div>
          <pre className="w-full h-56 p-3 text-emerald-300 font-mono text-xs overflow-auto leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/30">
            {consoleOutput}
          </pre>
        </div>
      </div>

      {/* 底部功能说明 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{currentSnippet.description || "轻量隔离沙箱环境"}</span>
        <span className="text-amber-600 dark:text-amber-400 font-medium">本地即时响应 · 零后端开销</span>
      </div>
    </div>
  );
};
