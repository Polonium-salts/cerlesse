import React from "react";
import { GoogleLogo } from "./GoogleLogo.js";
import { SearchBar } from "./SearchBar.js";
import { Button } from "./ui/button.js";
import { Sun, Moon, History, Maximize2, Minimize2 } from "lucide-react";

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
  onToggleCanvasWidth
}) => {
  const modelShortName = selectedModel === "openrouter/free"
    ? "Auto Free"
    : (selectedModel.split("/").pop()?.replace(":free", "") || "Auto Free");

  return (
    <header className="sticky top-0 z-40 w-full bg-background/85 backdrop-blur-xl border-b border-border transition-colors">
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

        {/* Right: 快速操作。图标靠 lucide 默认 currentColor 跟随按钮前景色，
            不再有滑动 knob、双色日月与状态点。 */}
        <div className="flex items-center gap-2">
          <span
            className="hidden md:inline text-xs text-muted-foreground truncate max-w-[160px] select-none"
            title={`当前推理模型：${modelShortName}（免费额度）`}
          >
            {modelShortName}
          </span>

          {onToggleCanvasWidth && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleCanvasWidth}
              title={isWideCanvas ? "切换为居中标准画幅 (1280px)" : "切换为全屏宽画幅 (卡片铺满两侧空白)"}
            >
              {isWideCanvas ? <Minimize2 /> : <Maximize2 />}
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={onOpenHistory}
            title="搜索与研报历史"
          >
            <History />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onToggleDarkMode}
            title={darkMode ? "当前：深色模式 (点击切换为浅色模式)" : "当前：浅色模式 (点击切换为深色模式)"}
            aria-label={darkMode ? "切换到浅色模式" : "切换到深色模式"}
          >
            {darkMode ? <Moon /> : <Sun />}
            <span className="sr-only">
              {darkMode ? "当前深色模式，点击切换浅色模式" : "当前浅色模式，点击切换深色模式"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
};
