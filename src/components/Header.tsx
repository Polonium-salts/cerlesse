import React, { useState } from "react";
import { GoogleLogo } from "./GoogleLogo.js";
import { SearchBar } from "./SearchBar.js";
import { Button } from "./ui/button.js";
import {
  Sun,
  Moon,
  Sparkles,
  Key,
  Loader2,
  Check,
  CheckCircle2,
  SlidersHorizontal,
  X
} from "lucide-react";
import { AiApiModel } from "../types.js";
import { useModelProviderStore } from "../state/modelProviderStore.js";
import { ModelSelectorDropdown } from "./ModelSelectorDropdown.js";

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenHistory?: () => void;
  onReset: () => void;
  selectedModel: string;
  availableModels: AiApiModel[];
  onSelectModel: (modelId: string) => void;
  isProviderConfigured?: boolean;
  isProviderDisabled?: boolean;
  isModelConfigLoaded?: boolean;
  searxngStatus?: string;
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
  onReset,
  selectedModel: propSelectedModel,
  availableModels: propAvailableModels,
  onSelectModel,
  isHomeView,
  currentQuery = "",
  onSearch,
  isLoading = false,
  isWideCanvas = true,
  onOpenSettings,
  isSettingsActive = false
}) => {
  const {
    status,
    models: storeModels,
    selectedModel: storeSelectedModel,
    setSelectedModel: setStoreSelectedModel,
    detectAndLoadModels,
    isDetecting,
    detectedProviderName,
    customApiKey
  } = useModelProviderStore();

  const [isQuickConfigOpen, setIsQuickConfigOpen] = useState(false);
  const [inputKey, setInputKey] = useState(customApiKey || "");
  const [inputBaseUrl, setInputBaseUrl] = useState("");
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  // 合并 Props 与 Store 中的模型列表
  const effectiveModels = storeModels.length > 0
    ? storeModels
    : (propAvailableModels.length > 0 ? propAvailableModels : []);
  
  const currentModel = storeSelectedModel || propSelectedModel || effectiveModels[0]?.id || "deepseek-chat";

  const handleModelChange = (modelId: string) => {
    setStoreSelectedModel(modelId);
    onSelectModel(modelId);
  };

  const handleApplyQuickKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setConfigFeedback("正在自动识别服务与拉取可用模型...");
    const result = await detectAndLoadModels(inputKey.trim(), inputBaseUrl.trim() || undefined);
    if (result && result.models && result.models.length > 0) {
      setConfigFeedback(`✓ 已识别并自动加载 ${result.models.length} 个可用模型`);
      if (result.defaultModel) {
        onSelectModel(result.defaultModel);
      }
      setTimeout(() => {
        setIsQuickConfigOpen(false);
        setConfigFeedback(null);
      }, 1200);
    } else {
      setConfigFeedback("未检测到有效模型，请检查 API Key 或网络");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background/85 backdrop-blur-xl border-b border-border transition-colors pt-[env(safe-area-inset-top,0px)]">
      <div
        className={`${
          isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"
        } mx-auto px-2.5 sm:px-6 lg:px-8 xl:px-10 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4 transition-all duration-200`}
      >
        {/* Left: Brand Logo & Inline Search */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 max-w-3xl">
          <div
            onClick={onReset}
            className="cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95 flex items-center"
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

        {/* Right: 重构后的现代化模型选择面板、API 快捷探查与主题切换 */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* 1. 现代化重构的模型选择面板 */}
          <ModelSelectorDropdown
            currentModelId={currentModel}
            models={effectiveModels}
            onSelectModel={handleModelChange}
            isDetecting={isDetecting}
            providerName={detectedProviderName || status?.provider}
            onOpenSettings={onOpenSettings}
          />

          {/* 快速 API 密钥填入与自动拉取模型弹层 */}
          <div className="relative shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsQuickConfigOpen((v) => !v)}
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl transition-all cursor-pointer shadow-xs shrink-0 ${
                isQuickConfigOpen || customApiKey ? "border-primary/40 text-primary bg-primary/5" : "border-border/80"
              }`}
              title="填入 API Key 自动加载对应服务与可用模型"
            >
              <Key className="size-3.5" />
            </Button>

            {isQuickConfigOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-24px)] max-w-sm sm:w-96 p-4 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">API 自动识别与模型加载</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickConfigOpen(false)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <form onSubmit={handleApplyQuickKey} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground block mb-1">
                      API Key（自动识别 DeepSeek / UnoRouter / OpenRouter / Groq / OpenAI）
                    </label>
                    <input
                      type="password"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="粘贴 sk-... / gsk_... 等密钥"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      自定义 Base URL（可选，留空则由 Key 自动推断）
                    </label>
                    <input
                      type="text"
                      value={inputBaseUrl}
                      onChange={(e) => setInputBaseUrl(e.target.value)}
                      placeholder="例如：https://api.deepseek.com/v1"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {configFeedback && (
                    <div className="text-[11px] p-2 rounded-md bg-muted/60 text-foreground font-medium flex items-center gap-1.5">
                      {isDetecting ? <Loader2 className="size-3 animate-spin text-primary" /> : <CheckCircle2 className="size-3 text-emerald-500" />}
                      <span>{configFeedback}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      已识别服务: <strong className="text-foreground">{detectedProviderName || "自动适配"}</strong>
                    </span>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isDetecting || !inputKey.trim()}
                      className="h-7 px-3 text-xs gap-1 cursor-pointer bg-primary text-primary-foreground"
                    >
                      {isDetecting ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      <span>自动探测并拉取</span>
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 2. 主题切换 */}
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleDarkMode}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-border/80 hover:bg-muted/70 transition-all cursor-pointer shadow-xs shrink-0"
            title={
              darkMode
                ? "当前：深色模式 (点击切换为浅色模式)"
                : "当前：浅色模式 (点击切换为深色模式)"
            }
            aria-label={darkMode ? "切换到浅色模式" : "切换到深色模式"}
          >
            {darkMode ? (
              <Moon className="size-4 text-primary transition-transform duration-200" />
            ) : (
              <Sun className="size-4 text-amber-500 transition-transform duration-200" />
            )}
            <span className="sr-only">
              {darkMode ? "当前深色模式，点击切换浅色模式" : "当前浅色模式，点击切换深色模式"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
};
