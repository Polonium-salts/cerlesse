import React from "react";
import { GoogleLogo } from "./GoogleLogo.js";
import { SearchBar } from "./SearchBar.js";
import { Sun, Moon, History, RefreshCw, Cpu, Layers, Maximize2, Minimize2, Sparkles, ChevronDown } from "lucide-react";

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenHistory: () => void;
  onReset: () => void;
  selectedModel: string;
  hasApiKey: boolean;
  searxngStatus: string;
  isHomeView: boolean;
  currentQuery?: string;
  onSearch?: (query: string, deep: boolean) => void;
  isLoading?: boolean;
  onSelectTab?: (tab: "summary" | "mindmap" | "comparison" | "sources" | "reasoning") => void;
  isWideCanvas?: boolean;
  onToggleCanvasWidth?: () => void;
  onToggleLayoutControl?: () => void;
  isLayoutControlOpen?: boolean;
  layoutStrategyName?: string;
  isCustomizedLayout?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleDarkMode,
  onOpenHistory,
  onReset,
  selectedModel,
  hasApiKey,
  searxngStatus,
  isHomeView,
  currentQuery = "",
  onSearch,
  isLoading = false,
  isWideCanvas = true,
  onToggleCanvasWidth,
  onToggleLayoutControl,
  isLayoutControlOpen = false,
  layoutStrategyName,
  isCustomizedLayout = false
}) => {
  const modelShortName = selectedModel === "openrouter/free"
    ? "Auto Free"
    : (selectedModel.split("/").pop()?.replace(":free", "") || "Auto Free");

  return (
    <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-[#121214]/85 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors">
      <div className={`${isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between gap-4 transition-all duration-200`}>
        {/* Left: Brand Logo & Inline Search */}
        <div className="flex items-center gap-4 flex-1 max-w-3xl">
          <div
            onClick={onReset}
            className="cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95"
            title="返回首页"
          >
            <GoogleLogo size="sm" badgeText="Agent" />
          </div>

          {!isHomeView && onSearch && (
            <div className="flex-1 max-w-xl min-w-0">
              <SearchBar
                onSearch={onSearch}
                isLoading={isLoading}
                initialQuery={currentQuery}
                isHomeView={false}
              />
            </div>
          )}
        </div>

        {/* Right: iOS-like Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Intelligent Adaptive Layout Toggle Button */}
          {!isHomeView && onToggleLayoutControl && (
            <button
              type="button"
              onClick={onToggleLayoutControl}
              title={isLayoutControlOpen ? "收起智能排版微调面板" : "展开智能排版与卡片微调面板"}
              className={`group flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-2xs ${
                isLayoutControlOpen
                  ? "bg-blue-500/15 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400 border-blue-500/40 ring-1 ring-blue-500/30 shadow-xs"
                  : "bg-zinc-100/90 hover:bg-zinc-200/90 dark:bg-zinc-800/90 dark:hover:bg-zinc-700/90 text-zinc-700 dark:text-zinc-200 border-zinc-200/80 dark:border-zinc-700/80"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 transition-transform ${isLayoutControlOpen ? "text-blue-500 animate-pulse scale-110" : "text-blue-500 group-hover:rotate-12"}`} />
              <span className="hidden xs:inline sm:inline">智能排版</span>
              <span className="inline xs:hidden sm:hidden">排版</span>
              {layoutStrategyName && (
                <span className="hidden xl:inline text-[11px] font-normal text-zinc-500 dark:text-zinc-400 max-w-[85px] truncate">
                  · {isCustomizedLayout ? "自定义" : layoutStrategyName}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${isLayoutControlOpen ? "rotate-180 text-blue-500" : ""}`} />
            </button>
          )}

          {/* Quick Model Chip (iOS Pill) */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-800/80 text-xs text-zinc-800 dark:text-zinc-200 select-none"
            title="当前推理模型"
          >
            <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
            <span className="font-semibold text-xs truncate max-w-[130px]">{modelShortName}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white dark:bg-zinc-900 text-zinc-500 font-mono">
              免费
            </span>
          </div>

          {/* Fullscreen/Canvas Width Toggle */}
          {onToggleCanvasWidth && (
            <button
              onClick={onToggleCanvasWidth}
              title={isWideCanvas ? "切换为居中标准画幅 (1280px)" : "切换为全屏宽画幅 (卡片铺满两侧空白)"}
              className={`w-9 h-9 rounded-2xl flex items-center justify-center border transition-all active:scale-95 cursor-pointer ${
                isWideCanvas
                  ? "bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                  : "bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700/60 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
              }`}
            >
              {isWideCanvas ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* History Button (iOS Squircle) */}
          <button
            onClick={onOpenHistory}
            title="搜索与研报历史"
            className="w-9 h-9 rounded-2xl flex items-center justify-center bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/60 transition-all active:scale-95"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Dark/Light Mode Toggle (iOS Capsule Dual-State Toggle) */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? "当前：深色模式 (点击切换为浅色模式)" : "当前：浅色模式 (点击切换为深色模式)"}
            aria-label={darkMode ? "切换到浅色模式" : "切换到深色模式"}
            className="group relative flex items-center h-9 px-1 rounded-2xl bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-800 border border-zinc-300/80 dark:border-zinc-700/80 transition-all duration-300 cursor-pointer select-none active:scale-95 shadow-2xs overflow-hidden"
          >
            {/* Sliding Pill Knob */}
            <div
              className={`absolute top-1 bottom-1 w-7 rounded-xl transition-all duration-300 ease-out shadow-xs ${
                darkMode
                  ? "left-[calc(100%-2rem)] bg-zinc-700/95 border border-zinc-600/70 shadow-sm"
                  : "left-1 bg-white border border-zinc-200/90 shadow-sm"
              }`}
            />

            {/* Sun Icon (Light Mode) */}
            <div
              className={`relative z-10 w-7 h-7 flex items-center justify-center transition-all duration-300 ${
                !darkMode
                  ? "text-amber-500 scale-105"
                  : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 scale-90"
              }`}
            >
              <Sun
                className={`w-4 h-4 transition-transform duration-300 ${
                  !darkMode ? "rotate-0 text-amber-500 stroke-[2.2]" : "-rotate-45 opacity-60"
                }`}
              />
            </div>

            {/* Moon Icon (Dark Mode) */}
            <div
              className={`relative z-10 w-7 h-7 flex items-center justify-center transition-all duration-300 ${
                darkMode
                  ? "text-indigo-400 scale-105"
                  : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 scale-90"
              }`}
            >
              <Moon
                className={`w-4 h-4 transition-transform duration-300 ${
                  darkMode ? "rotate-0 text-indigo-400 fill-indigo-400/20 stroke-[2.2]" : "rotate-45 opacity-60"
                }`}
              />
            </div>

            <span className="sr-only">
              {darkMode ? "当前深色模式，点击切换浅色模式" : "当前浅色模式，点击切换深色模式"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
