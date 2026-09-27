import React from "react";
import { GoogleLogo } from "./GoogleLogo.js";
import { SearchBar } from "./SearchBar.js";
import { Button } from "./ui/button.js";
import { Sun, Moon, History, Maximize2, Minimize2, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { AiApiModel } from "../types.js";

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenHistory: () => void;
  onReset: () => void;
  selectedModel: string;
  availableModels: AiApiModel[];
  onSelectModel: (modelId: string) => void;
  isProviderConfigured?: boolean;
  isProviderDisabled?: boolean;
  isModelConfigLoaded?: boolean;
  searxngStatus: string;
  isHomeView: boolean;
  currentQuery?: string;
  onSearch?: (query: string, deep: boolean) => void;
  isLoading?: boolean;
  onSelectTab?: (tab: "summary" | "mindmap" | "comparison" | "sources" | "reasoning") => void;
  isWideCanvas?: boolean;
  onToggleCanvasWidth?: () => void;
  onOpenWidgetGrid?: () => void;
  isGridActive?: boolean;
  onOpenSettings?: () => void;
  isSettingsActive?: boolean;
  hasCustomApiKey?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleDarkMode,
  onOpenHistory,
  onReset,
  selectedModel,
  availableModels,
  onSelectModel,
  isProviderConfigured = false,
  isProviderDisabled = false,
  isModelConfigLoaded = true,
  searxngStatus,
  isHomeView,
  currentQuery = "",
  onSearch,
  isLoading = false,
  isWideCanvas = true,
  onToggleCanvasWidth,
  onOpenWidgetGrid,
  isGridActive = false,
  onOpenSettings,
  isSettingsActive = false,
  hasCustomApiKey = false
}) => {
  const selectedModelInfo = availableModels.find((model) => model.id === selectedModel);
  const modelShortName = selectedModelInfo?.name || selectedModel;

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

          {!isHomeView && !isSettingsActive && onSearch && (
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

        {/* Right: 快速操作 */}
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <Button
              variant={isSettingsActive ? "default" : "outline"}
              size="sm"
              onClick={onOpenSettings}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
              title="配置 AI 大模型、自定义 API Key 与兼容中转接口"
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">模型设置</span>
              {hasCustomApiKey && (
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" title="已配置自定义 API Key" />
              )}
            </Button>
          )}

          {onOpenWidgetGrid && !isSettingsActive && (
            <Button
              variant={isGridActive ? "default" : "outline"}
              size="sm"
              onClick={onOpenWidgetGrid}
              className="h-8 gap-1.5 text-xs font-medium"
              title="显示搜索引擎小组件网格 (Live Tile 12 栅格全景视图)"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">小组件网格</span>
            </Button>
          )}

          {!isProviderDisabled && availableModels.length > 0 ? (
            <label className="flex min-w-0 items-center">
              <span className="sr-only">选择 AI 模型</span>
              <select
                aria-label="选择 AI 模型"
                title={`当前选择模型: ${selectedModel}（Agent 将调用此模型）`}
                value={selectedModel}
                onChange={(event) => onSelectModel(event.target.value)}
                className="h-8 w-[115px] sm:w-[170px] lg:w-[220px] rounded-lg border border-border/80 bg-background/80 hover:bg-muted/80 px-2.5 text-xs font-medium text-foreground outline-none transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.isRecommended ? "★ " : ""}{model.name}（{model.id}）
                  </option>
                ))}
              </select>
            </label>
          ) : isProviderDisabled ? (
            <div
              className="h-8 px-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs font-medium cursor-default"
              title="AI API 当前处于禁用状态，已暂停向上游发起模型请求"
            >
              <span className="size-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              <span className="truncate">AI API 已禁用</span>
            </div>
          ) : isModelConfigLoaded ? (
            <span className="text-xs text-muted-foreground">没有可用模型</span>
          ) : (
            <span className="text-xs text-muted-foreground">正在加载模型…</span>
          )}

          <div
            onClick={onOpenSettings}
            className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-full transition-colors truncate max-w-[200px] ${onOpenSettings ? "cursor-pointer hover:bg-muted" : ""}`}
            title={isProviderDisabled
              ? "AI API 当前处于禁用状态，已暂停向上游发起模型请求"
              : `当前 AI 模型：${selectedModelInfo?.name || selectedModel} (${selectedModel})\n点击进入模型与 API 设置`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isProviderDisabled ? "bg-amber-500" : hasCustomApiKey ? "bg-emerald-500" : isProviderConfigured ? "bg-blue-500" : "bg-muted-foreground"}`} />
            <span className="truncate">{isProviderDisabled ? "AI API 已禁用" : hasCustomApiKey ? `自定义: ${modelShortName}` : isProviderConfigured ? modelShortName : "未配置密钥"}</span>
          </div>

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
