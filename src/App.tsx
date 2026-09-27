/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { GoogleLogo } from "./components/GoogleLogo.js";
import { SearchBar } from "./components/SearchBar.js";
import { RelatedLinksWidget } from "./widgets/components/RelatedLinksWidget.js";
import { AgentProgressStream } from "./components/AgentProgressStream.js";
import { AgentOrchestrationLoader } from "./components/AgentOrchestrationLoader.js";
import { SearchHistoryDrawer } from "./components/SearchHistoryDrawer.js";
import { TileDesktopView } from "./components/desktop/TileDesktopView.js";
import { WidgetMarketplaceDrawer } from "./components/desktop/WidgetMarketplaceDrawer.js";
import { CockpitWorkspace } from "./components/CockpitWorkspace.js";
import { ImageGalleryPage } from "./components/ImageGalleryPage.js";
import { Alert, AlertDescription } from "./components/ui/alert.js";
import { Button } from "./components/ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs.js";
import { WidgetRegistry, WidgetRuntime } from "./widgets/index.js";
import { 
  AgentStep, 
  SearchSynthesisResult, 
  UserSettings, 
  AiApiModel,
  AdaptiveLayoutStrategy,
  LayoutIntentType,
  ResultWidgetKey,
  LayoutAlignmentMode,
  AutoFillGapsMode,
  AgentTeamReport,
  WidgetPlannedSize,
  ALL_RESULT_WIDGET_KEYS
} from "./types.js";
import {
  computeAdaptiveLayoutFromQuery, 
  getStrategyForPreset,
  calculateAdaptiveBinPacking,
  getWidgetGridClass,
  resolveDynamicCapabilityWidgets
} from "./lib/adaptiveLayout.js";
import { resolveActivationTargets, applyAlwaysOnGuarantee, WIDGET_ACTIVATION_POLICY } from "./widgets/widgetContract.js";
import { evaluateWidgetApplicability } from "./widgets/applicability.js";
import { navigate, readRoute, useRoute, RouteTab } from "./lib/router.js";
import { motion } from "motion/react";
import { 
  LayoutGrid, 
  Images,
  GitFork, 
  Scale, 
  Database, 
  BrainCircuit, 
  AlertCircle, 
  RefreshCw, 
  Share2,
  Check,
  FileText,
  Sparkles,
  Workflow,
  Zap,
  SlidersHorizontal
} from "lucide-react";

const DEFAULT_SETTINGS: UserSettings = {
  selectedModel: "gpt-4o-mini",
  customApiBaseUrl: undefined,
  customApiKey: undefined,
  customProvider: undefined,
  temperature: 0.2,
  maxIterations: 12,
  searxngCustomUrl: "",
  language: "zh-CN",
  maxResults: 15,
  enableDeepSearch: true
};

export default function App() {
  // Theme state: respects saved choice or system preference
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    if (document.documentElement.classList.contains("dark")) return true;
    return window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
  });

  // Settings state: respects user customized models, custom API keys, endpoints and search preferences.
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const savedRaw = localStorage.getItem("ai_search_settings");
      if (!savedRaw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(savedRaw);
      if (!parsed.selectedModel || typeof parsed.selectedModel !== "string") {
        parsed.selectedModel = DEFAULT_SETTINGS.selectedModel;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<AiApiModel[]>([]);
  const [isAiApiConfigured, setIsAiApiConfigured] = useState(false);
  const [isAiApiDisabled, setIsAiApiDisabled] = useState(false);
  const [isModelConfigLoaded, setIsModelConfigLoaded] = useState(false);

  // Search execution state
  const [currentQuery, setCurrentQuery] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    // 直接访问 /mindmap?q=xxx 等深链接时先进入加载态，避免闪现空状态
    const initial = readRoute();
    return Boolean(initial.tab && initial.query);
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [activeResult, setActiveResult] = useState<SearchSynthesisResult | null>(null);
  // 路由驱动页面：每个页面拥有独立的 URL 目录
  // / 首页 · /search 全景网格 · /mindmap 思维导图 · /comparison 对比矩阵 · /sources 已验证信源 · /reasoning Agent 思考流
  const route = useRoute();
  const activeTab: RouteTab = route.tab ?? "bento";

  // 页面跳转：结果页携带当前查询词，便于分享与前进/后退
  const goToPage = (tab: RouteTab | null, options: { replace?: boolean } = {}) => {
    navigate(tab, tab ? (activeResult?.query || currentQuery) : "", options);
  };

  const [sharedCopied, setSharedCopied] = useState(false);

  // Adaptive Layout state: automatically arranged based on query & agent intent
  const [layoutPreset, setLayoutPreset] = useState<LayoutIntentType | "custom">("deep_research");
  const [customWidgetOrder, setCustomWidgetOrder] = useState<ResultWidgetKey[] | null>(null);

  // Interaction Mode: default to "bento" (iOS & Android 4-column Modular Desktop Grid of widgets)
  const [interactionMode, setInteractionMode] = useState<"cockpit" | "bento">(() => {
    const saved = localStorage.getItem("search_interaction_mode");
    return (saved === "cockpit" || saved === "bento") ? saved : "bento";
  });

  const handleToggleInteractionMode = (mode: "cockpit" | "bento") => {
    setInteractionMode(mode);
    localStorage.setItem("search_interaction_mode", mode);
  };

  // Canvas width mode: "full" (expands cards across whole screen eliminating side blanks) vs "standard" (1280px)
  const [isWideCanvas, setIsWideCanvas] = useState<boolean>(() => {
    const saved = localStorage.getItem("search_canvas_is_wide");
    return saved !== null ? saved === "true" : true; // default: full canvas enabled
  });

  // Layout Alignment Mode: "masonry" (Free-flow Adaptive, no forced row alignment) vs "grid" (classic 12-col row-aligned)
  const [alignmentMode, setAlignmentMode] = useState<LayoutAlignmentMode>(() => {
    const saved = localStorage.getItem("search_layout_alignment_mode");
    return (saved === "grid" || saved === "masonry") ? saved : "masonry"; // default to masonry (free-flow adaptive)
  });

  const handleToggleAlignmentMode = (mode: LayoutAlignmentMode) => {
    setAlignmentMode(mode);
    localStorage.setItem("search_layout_alignment_mode", mode);
  };

  // Track enabled widgets (auto-decided by agent or user customized)
  const [customEnabledWidgets, setCustomEnabledWidgets] = useState<ResultWidgetKey[] | null>(null);
  const [customWidgetSpans, setCustomWidgetSpans] = useState<Partial<Record<ResultWidgetKey, number>>>({});

  // 🧩 Automatic Card Gap-Filling (Dense packing & auto space absorption)
  const [autoFillGaps, setAutoFillGaps] = useState<boolean>(() => {
    const saved = localStorage.getItem("search_auto_fill_gaps");
    return saved !== null ? saved === "true" : true;
  });
  const [autoFillMode, setAutoFillMode] = useState<AutoFillGapsMode>(() => {
    const saved = localStorage.getItem("search_auto_fill_mode") as AutoFillGapsMode;
    return saved || "dense";
  });

  const handleToggleAutoFillGaps = (enabled: boolean) => {
    setAutoFillGaps(enabled);
    localStorage.setItem("search_auto_fill_gaps", String(enabled));
  };

  const handleChangeAutoFillMode = (mode: AutoFillGapsMode) => {
    setAutoFillMode(mode);
    localStorage.setItem("search_auto_fill_mode", mode);
  };

  const handleToggleCanvasWidth = () => {
    setIsWideCanvas((prev) => {
      const next = !prev;
      localStorage.setItem("search_canvas_is_wide", String(next));
      return next;
    });
  };

  // Widget Marketplace Drawer Open State
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState<boolean>(false);

  // When a new search completes or activeResult changes, automatically adopt Agent's intent recommendation
  useEffect(() => {
    if (activeResult) {
      if (activeResult.layoutStrategy) {
        if (activeResult.layoutStrategy.gridConfig?.image_gallery) {
          activeResult.layoutStrategy.gridConfig.image_gallery.colSpanLg = 9;
          activeResult.layoutStrategy.gridConfig.image_gallery.width = 75;
          activeResult.layoutStrategy.gridConfig.image_gallery.isAutoFilled = false;
        }
        if (activeResult.layoutStrategy.customWidgetSpans?.image_gallery) {
          activeResult.layoutStrategy.customWidgetSpans.image_gallery = 9;
        }
      }
      const rec = activeResult.layoutStrategy || computeAdaptiveLayoutFromQuery(activeResult.query, activeResult);
      if (rec.gridConfig?.image_gallery) {
        rec.gridConfig.image_gallery.colSpanLg = 9;
        rec.gridConfig.image_gallery.width = 75;
        rec.gridConfig.image_gallery.isAutoFilled = false;
      }
      if (rec.customWidgetSpans?.image_gallery) {
        rec.customWidgetSpans.image_gallery = 9;
      }
      setLayoutPreset(rec.intentType);
      setCustomWidgetOrder(rec.componentOrder);
      setCustomEnabledWidgets(rec.enabledWidgets || null);
      setCustomWidgetSpans({});
    }
  }, [activeResult]);

  // Compute the currently effective strategy
  const currentStrategy = React.useMemo<AdaptiveLayoutStrategy>(() => {
    if (!activeResult) return getStrategyForPreset("balanced");

    const baseRec = activeResult.layoutStrategy || computeAdaptiveLayoutFromQuery(activeResult.query, activeResult);
    const eligibleRegistryKeys = ALL_RESULT_WIDGET_KEYS.filter((key) =>
      WidgetRegistry.has(key) && evaluateWidgetApplicability(key, activeResult.query, activeResult).applicable
    );
    const eligibleSet = new Set(eligibleRegistryKeys);
    const activeEnabled = (customEnabledWidgets || baseRec.enabledWidgets || ALL_RESULT_WIDGET_KEYS)
      .filter((key) => eligibleSet.has(key));

    const targetOrder: ResultWidgetKey[] = customWidgetOrder || baseRec.componentOrder;
    // Agent 决策仅负责推荐；最终展示还必须通过 registry 与数据适用性检查。
    const visibleOrder: ResultWidgetKey[] = targetOrder.filter((key) => activeEnabled.includes(key));

    const droppedByRegistry = targetOrder.filter((key) => !WidgetRegistry.has(key));
    if (droppedByRegistry.length > 0) {
      console.warn(
        `[App] ${droppedByRegistry.length} 个小组件因未注册被剔除: [${droppedByRegistry.join(", ")}]`,
        WidgetRegistry.diagnose(droppedByRegistry[0])
      );
    }

    // 每次搜索均从注册表中为 Codex 的启停结果补位：只显示 5–10 个可用组件。
    const floorTargets = resolveActivationTargets(eligibleRegistryKeys.length);
    const floorRequired = floorTargets.poolStarved ? floorTargets.hardFloor : floorTargets.min;
    const plannedOrder = (activeResult?.widgetPlan?.widgetOrder || []).filter((key) => eligibleSet.has(key));
    const modelSelectedWidgetsOnly = activeResult.generationStatus === "agent_completed";
    const candidateOrder = [...visibleOrder];
    const selectedSet = new Set(candidateOrder);
    if (!modelSelectedWidgetsOnly && candidateOrder.length < floorRequired) {
      for (const key of [...plannedOrder, ...eligibleRegistryKeys]) {
        if (candidateOrder.length >= floorRequired) break;
        if (selectedSet.has(key)) continue;
        candidateOrder.push(key);
        selectedSet.add(key);
      }
    }
    const boundedOrder = candidateOrder.slice(0, WIDGET_ACTIVATION_POLICY.max);
    const safeVisibleOrder = modelSelectedWidgetsOnly
      ? boundedOrder
      : applyAlwaysOnGuarantee(boundedOrder, (key) => eligibleSet.has(key));

    if (visibleOrder.length < floorRequired) {
      console.warn(
        `[App] 小组件数量保障触发：原可见组件 ${visibleOrder.length} < 最低 ${floorRequired}，` +
        `已从注册表补位至 ${safeVisibleOrder.length} 个（适用组件 ${eligibleRegistryKeys.length} 个）`
      );
    }

    // 注册中心彻底为空的极端情形仍保留相关链接作为桌面兜底。
    const finalVisibleOrder: ResultWidgetKey[] = safeVisibleOrder.length > 0
      ? safeVisibleOrder
      : (modelSelectedWidgetsOnly ? [] : ["related_links"]);

    const emphasized: ResultWidgetKey = finalVisibleOrder.includes(baseRec.emphasizedWidget)
      ? baseRec.emphasizedWidget
      : finalVisibleOrder[0];

    const packing = calculateAdaptiveBinPacking(finalVisibleOrder, {
      emphasizedWidget: emphasized,
      intentType: layoutPreset === "custom" ? baseRec.intentType : (layoutPreset as LayoutIntentType),
      customSpans: customWidgetSpans,
      enabledWidgets: safeVisibleOrder,
      autoFillGaps,
      autoFillMode
    });

    if (packing.gridConfig.image_gallery) {
      packing.gridConfig.image_gallery.colSpanLg = 9;
      packing.gridConfig.image_gallery.width = 75;
      packing.gridConfig.image_gallery.isAutoFilled = false;
    }

    const finalCustomSpans = { ...(baseRec.customWidgetSpans || {}), ...customWidgetSpans };
    if (finalCustomSpans.image_gallery) {
      finalCustomSpans.image_gallery = 9;
    }

    // 用户尚未手动调过任何跨度时，布局数字直接沿用排版 Agent 的决策单：
    // 那份数字是用「磁贴桌面正在使用的同一套行带装箱求解器」预演出来的，
    // 因此控制栏上的行数/补位列数与用户实际看到的画面口径完全一致（决策即渲染）。
    const userTouchedSpans = Object.keys(customWidgetSpans).length > 0;
    const trustAgentMetrics = !userTouchedSpans && baseRec.layoutAgentDecision != null;

    return {
      ...baseRec,
      intentType: layoutPreset === "custom" ? baseRec.intentType : (layoutPreset as LayoutIntentType),
      componentOrder: finalVisibleOrder,
      emphasizedWidget: emphasized,
      gridConfig: packing.gridConfig,
      totalRows: trustAgentMetrics ? (baseRec.totalRows ?? packing.totalRows) : packing.totalRows,
      maxColumnsPerRow: 12,
      packingMethod: "semantic-css-grid",
      enabledWidgets: finalVisibleOrder,
      disabledWidgets: ALL_RESULT_WIDGET_KEYS.filter(k => !finalVisibleOrder.includes(k)),
      widgetStatusMap: baseRec.widgetStatusMap,
      // 合并而非覆盖：排版 Agent 给出的栅格跨度是宽度权威，用户手动调整则拥有更高优先级。
      // （原实现直接用用户态覆盖，会把 Agent 精心编排的宽度整批打回默认值）
      customWidgetSpans: finalCustomSpans,
      alignmentMode,
      autoFillGaps,
      autoFillMode,
      filledGapsCount: trustAgentMetrics
        ? (baseRec.filledGapsCount ?? packing.filledGapsCount ?? 0)
        : (packing.filledGapsCount ?? 0)
    };
  }, [activeResult, layoutPreset, customWidgetOrder, customEnabledWidgets, customWidgetSpans, alignmentMode, autoFillGaps, autoFillMode]);

  const currentEnabledWidgets = currentStrategy.enabledWidgets || ALL_RESULT_WIDGET_KEYS;

  const activeWidgetOrder = customWidgetOrder || currentStrategy.componentOrder;

  const handleSelectPreset = (preset: LayoutIntentType) => {
    setLayoutPreset(preset);
    const strat = getStrategyForPreset(preset, activeResult);
    setCustomWidgetOrder(strat.componentOrder);
    setCustomEnabledWidgets(strat.enabledWidgets);
    setCustomWidgetSpans({});
  };

  const handleChangeWidgetSpan = (widgetKey: ResultWidgetKey, span: number) => {
    setCustomWidgetSpans((prev) => ({
      ...prev,
      [widgetKey]: span
    }));
    setLayoutPreset("custom");
  };

  const handleMoveWidget = (widgetKey: ResultWidgetKey, direction: "up" | "down") => {
    const current = [...activeWidgetOrder];
    const index = current.indexOf(widgetKey);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    const [moved] = current.splice(index, 1);
    current.splice(targetIndex, 0, moved);
    setLayoutPreset("custom");
    setCustomWidgetOrder(current);
  };

  const handleToggleWidgetActivation = (widgetKey: ResultWidgetKey) => {
    setCustomEnabledWidgets((prev) => {
      const currentList = prev || currentStrategy.enabledWidgets || resolveDynamicCapabilityWidgets(currentStrategy.intentType);
      let nextList: ResultWidgetKey[];
      if (currentList.includes(widgetKey)) {
        if (currentList.length <= WIDGET_ACTIVATION_POLICY.min) return currentList;
        nextList = currentList.filter((k) => k !== widgetKey);
      } else {
        if (currentList.length >= WIDGET_ACTIVATION_POLICY.max) return currentList;
        nextList = [...currentList, widgetKey];
      }
      return nextList;
    });
    setLayoutPreset("custom");
  };

  const handleResetToRecommended = () => {
    if (!activeResult) return;
    const rec = computeAdaptiveLayoutFromQuery(activeResult.query, activeResult);
    setLayoutPreset(rec.intentType);
    setCustomWidgetOrder(rec.componentOrder);
    setCustomEnabledWidgets(rec.enabledWidgets || null);
    setCustomWidgetSpans({});
  };

  // Search history
  const [history, setHistory] = useState<{ query: string; timestamp: number; result: SearchSynthesisResult }[]>(() => {
    try {
      const saved = localStorage.getItem("ai_search_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync theme class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Persist user preferences, including their selected model.
  useEffect(() => {
    localStorage.setItem("ai_search_settings", JSON.stringify(settings));
  }, [settings]);

  // Load config and the configured model from the server; the API key stays server-side.
  useEffect(() => {
    fetch("/api/config")
      .then(res => {
        if (!res.ok) throw new Error(`Configuration request failed (${res.status})`);
        return res.json();
      })
      .then(data => {
        setIsAiApiConfigured(Boolean(data.hasApiKey));
        setIsAiApiDisabled(Boolean(data.isAiApiDisabled));
        const models = Array.isArray(data.models) ? data.models as AiApiModel[] : [];
        setAvailableModels(models);
        setSettings(prev => {
          if (prev.customApiKey || prev.customApiBaseUrl || prev.customProvider) return prev;
          const configuredModelIds = new Set(models.map((model) => model.id));
          if (configuredModelIds.has(prev.selectedModel)) return prev;
          const nextModel = configuredModelIds.has(data.defaultModel)
            ? data.defaultModel
            : (models[0]?.id || DEFAULT_SETTINGS.selectedModel);
          return { ...prev, selectedModel: nextModel };
        });
      })
      .catch(err => console.warn("Failed to load server config", err))
      .finally(() => setIsModelConfigLoaded(true));
  }, []);

  const handleSelectModel = (modelId: string) => {
    setSettings(prev => {
      const next = { ...prev, selectedModel: modelId };
      try {
        localStorage.setItem("ai_search_settings", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("ai_search_history");
  };

  const handleResetSession = () => {
    setActiveResult(null);
    setAgentSteps([]);
    setCurrentQuery("");
    setErrorMessage(null);
    navigate(null, "", { replace: false });
  };

  const executeSearch = async (query: string, deep: boolean = true) => {
    if (!query.trim() || isLoading) return;
    await runSearch(query, deep);
  };

  // 真正的检索执行体（不做节流判断，供深链接自动检索直接调用）
  const runSearch = async (query: string, deep: boolean = true) => {
    setCurrentQuery(query);
    setIsLoading(true);
    setErrorMessage(null);
    setAgentSteps([]);
    setActiveResult(null);

    // 结果始终落在当前页面目录下并携带查询词，保证每个页面 URL 可分享
    navigate(route.tab ?? "bento", query.trim(), { replace: !route.isHome });

    const queryParams = new URLSearchParams();
    queryParams.set("q", query.trim());
    if (settings.selectedModel) queryParams.set("model", settings.selectedModel);
    if (settings.searxngCustomUrl && settings.searxngCustomUrl.trim()) {
      queryParams.set("searxngUrl", settings.searxngCustomUrl.trim());
    }
    queryParams.set("deep", deep ? "true" : "false");
    if (settings.language) queryParams.set("lang", settings.language);
    if (settings.customApiKey?.trim()) queryParams.set("apiKey", settings.customApiKey.trim());
    if (settings.customApiBaseUrl?.trim()) queryParams.set("apiBaseUrl", settings.customApiBaseUrl.trim());
    if (typeof settings.temperature === "number") queryParams.set("temperature", String(settings.temperature));
    if (typeof settings.maxIterations === "number") queryParams.set("maxIterations", String(settings.maxIterations));

    let hasCompleted = false;

    const fallbackPostSearch = async () => {
      if (hasCompleted) return;
      hasCompleted = true;
      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(settings.customApiKey?.trim() ? { "x-custom-api-key": settings.customApiKey.trim() } : {}),
            ...(settings.customApiBaseUrl?.trim() ? { "x-custom-base-url": settings.customApiBaseUrl.trim() } : {})
          },
          body: JSON.stringify({
            query: query.trim(),
            model: settings.selectedModel || undefined,
            customSearxngUrl: settings.searxngCustomUrl?.trim() || undefined,
            enableDeepSearch: deep,
            targetLanguage: settings.language || "auto",
            apiKey: settings.customApiKey?.trim() || undefined,
            apiBaseUrl: settings.customApiBaseUrl?.trim() || undefined,
            temperature: settings.temperature,
            maxIterations: settings.maxIterations
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Agent 搜索服务响应异常");
        }

        const result: SearchSynthesisResult = await res.json();
        setActiveResult(result);
        setAgentSteps(result.steps || []);
        setIsLoading(false);

        setHistory(prev => {
          const next = [{ query, timestamp: Date.now(), result }, ...prev.slice(0, 19)];
          try {
            localStorage.setItem("ai_search_history", JSON.stringify(next));
          } catch {
            // ignore localStorage quota errors
          }
          return next;
        });
      } catch (err: any) {
        setErrorMessage(err.message || "执行 Agent 搜索失败，请稍后重试");
        setIsLoading(false);
      }
    };

    let eventSource: EventSource | null = null;

    // Safety watchdog timer: if the stream stalls for more than 25 seconds, gracefully trigger fallback
    const watchdogTimer = setTimeout(() => {
      if (!hasCompleted) {
        console.warn("Agent stream watchdog reached, falling back to POST API...");
        try {
          eventSource?.close();
        } catch {
          // ignore
        }
        fallbackPostSearch();
      }
    }, 25000);

    try {
      eventSource = new EventSource(`/api/agent/stream?${queryParams.toString()}`);

      // Handle real-time pipeline step updates
      eventSource.addEventListener("step", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.allSteps && Array.isArray(data.allSteps)) {
            setAgentSteps(data.allSteps);
          } else if (data.currentStep) {
            setAgentSteps(prev => {
              const index = prev.findIndex(s => s.id === data.currentStep.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = data.currentStep;
                return updated;
              } else {
                return [...prev, data.currentStep];
              }
            });
          }
        } catch (e) {
          console.warn("Failed to parse SSE agent step", e);
        }
      });

      // Handle successful synthesis completion directly from stream data
      eventSource.addEventListener("complete", (event: MessageEvent) => {
        clearTimeout(watchdogTimer);
        eventSource.close();
        if (hasCompleted) return;

        try {
          const result: SearchSynthesisResult = JSON.parse(event.data);
          if (result && result.summary) {
            hasCompleted = true;
            setActiveResult(result);
            setAgentSteps(result.steps || []);
            setIsLoading(false);

            setHistory(prev => {
              const next = [{ query, timestamp: Date.now(), result }, ...prev.slice(0, 19)];
              try {
                localStorage.setItem("ai_search_history", JSON.stringify(next));
              } catch {
                // ignore
              }
              return next;
            });
            return;
          }
        } catch (e) {
          console.warn("Failed to parse complete event data, falling back to POST", e);
        }

        fallbackPostSearch();
      });

      // Handle agent-side error event
      eventSource.addEventListener("error", (event: any) => {
        clearTimeout(watchdogTimer);
        eventSource.close();
        if (hasCompleted) return;

        if (event.data) {
          try {
            const errData = JSON.parse(event.data);
            if (errData.message) {
              hasCompleted = true;
              setErrorMessage(errData.message);
              setIsLoading(false);
              return;
            }
          } catch {
            // fallback
          }
        }

        // Connection dropped or interrupted, seamlessly fallback to POST API
        fallbackPostSearch();
      });

      eventSource.onerror = () => {
        clearTimeout(watchdogTimer);
        eventSource.close();
        if (!hasCompleted) {
          fallbackPostSearch();
        }
      };

    } catch {
      clearTimeout(watchdogTimer);
      fallbackPostSearch();
    }
  };

  // 路由 ⇄ 研报数据同步：
  // 1) 深链接直达（如 /mindmap?q=xxx）自动发起检索；
  // 2) 浏览器前进/后退时按地址栏查询词对齐数据。
  const hasBootstrappedRef = React.useRef(false);
  const lastSyncedQueryRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!route.isKnown) {
      navigate(null, "", { replace: true });
      return;
    }

    const routeQuery = route.query.trim();
    if (!routeQuery) {
      hasBootstrappedRef.current = true;
      return;
    }

    const isBootstrapping = !hasBootstrappedRef.current;
    hasBootstrappedRef.current = true;

    const activeQuery = (activeResult?.query || "").trim();
    if (!isBootstrapping && routeQuery === activeQuery) return;
    if (lastSyncedQueryRef.current === routeQuery) return;
    if (!isBootstrapping && isLoading) return;

    lastSyncedQueryRef.current = routeQuery;
    void runSearch(routeQuery, settings.enableDeepSearch);
  }, [route.path, route.isKnown, route.query, activeResult?.query, isLoading]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setSharedCopied(true);
    setTimeout(() => setSharedCopied(false), 2000);
  };

  const isHomeView = route.isHome;
  const officialSite = activeResult?.filteredResults.find(r => r.isOfficial);

  const getGridClassForWidget = (key: ResultWidgetKey, isEmphasized: boolean) => {
    const placement = currentStrategy.gridConfig?.[key];
    if (placement) {
      return getWidgetGridClass(placement);
    }
    const mod = WidgetRegistry.get(key);
    if (mod) {
      if (mod.width === 100) return "col-span-12";
      if (mod.width === 75) return isEmphasized ? "col-span-12" : "col-span-12 lg:col-span-9";
      if (mod.width === 25) return "col-span-12 sm:col-span-6 lg:col-span-3";
      return "col-span-12 lg:col-span-6";
    }
    return "col-span-12";
  };

  const renderWidgetContent = (
    key: ResultWidgetKey, 
    overrideCompact?: boolean,
    size?: WidgetPlannedSize,
    onResize?: (nextSize: WidgetPlannedSize) => void
  ) => {
    if (!activeResult) return null;
    const placement = currentStrategy.gridConfig?.[key];
    const isCompact = overrideCompact ?? (size === 25) ?? placement?.isCompact ?? (placement?.colSpanLg ? placement.colSpanLg <= 3 : false);

    // 插件系统架构核心：统一通过 WidgetRegistry 调度渲染所有官方插件模块
    const widgetModule = WidgetRegistry.get(key);
    if (!widgetModule) {
      const isDev = Boolean((import.meta as any)?.env?.DEV);
      if (isDev) {
        console.error("[WidgetRegistry] Missing requested widget:", {
          requestedWidget: key,
          registeredWidgets: WidgetRegistry.getAll().map(w => String(w.id))
        });
      }
      return (
        <div
          key={String(key)}
          data-widget-id={String(key)}
          className="w-full min-h-[140px] rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 flex flex-col justify-center"
        >
          <div className="text-xs font-semibold text-destructive">
            小组件不可用
          </div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            {String(key)}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            组件可能未成功注册，或 Registry 与 Catalog 状态不一致。
          </div>
        </div>
      );
    }


    // 注入应用层动作回调 (Actions)
    const boundModule = {
      ...widgetModule,
      actions: {
        ...(widgetModule.actions || {}),
        openMindMap: () => goToPage("mindmap"),
        openComparison: () => goToPage("comparison"),
        openImagePage: () => goToPage("images"),
        reSearch: () => executeSearch(activeResult.query, settings.enableDeepSearch),
        viewDeepAnalysis: () => goToPage("sources"),
        viewDetails: () => goToPage("reasoning")
      }
    };

    return (
      <WidgetRuntime
        key={String(key)}
        module={boundModule}
        activeResult={activeResult}
        size={size}
        isCompact={isCompact}
        onResize={onResize}
        onExecuteSearch={(q, deep) => executeSearch(q, deep)}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* iOS App Header */}
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onReset={handleResetSession}
        selectedModel={settings.selectedModel}
        availableModels={availableModels}
        onSelectModel={handleSelectModel}
        isProviderConfigured={isAiApiConfigured}
        isProviderDisabled={isAiApiDisabled}
        isModelConfigLoaded={isModelConfigLoaded}
        searxngStatus={settings.searxngCustomUrl ? "自定义实例" : "高可用集群"}
        isHomeView={isHomeView}
        currentQuery={currentQuery}
        onSearch={(q, deep) => executeSearch(q, deep)}
        isLoading={isLoading}
        isWideCanvas={isWideCanvas}
        onToggleCanvasWidth={handleToggleCanvasWidth}
        onOpenWidgetGrid={() => {
          if (isHomeView) {
            setIsMarketplaceOpen(true);
          } else {
            handleToggleInteractionMode("bento");
            goToPage("bento");
          }
        }}
        isGridActive={!isHomeView && activeTab === "bento" && interactionMode === "bento"}
        onOpenSettings={() => goToPage("settings")}
        isSettingsActive={activeTab === "settings"}
        hasCustomApiKey={Boolean(settings.customApiKey?.trim())}
      />

      {/* 结果页顶部导航：单一分段控件 + 一句元信息 + 两个操作按钮 */}
      {!isHomeView && activeTab !== "settings" && (
        <div className="border-b border-border bg-background/70 backdrop-blur-xl sticky top-16 z-30">
          <div className={`${isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar transition-all duration-200`}>
            <Tabs
              value={activeTab}
              onValueChange={(v) => goToPage(v as RouteTab)}
              className="shrink-0"
            >
              <TabsList>
                <TabsTrigger value="bento" className="flex items-center gap-1.5 font-medium">
                  <LayoutGrid className="size-3.5" />
                  <span>小组件网格</span>
                </TabsTrigger>
                <TabsTrigger value="images" className="flex items-center gap-1.5 font-medium">
                  <Images className="size-3.5" />
                  <span>图片图库</span>
                </TabsTrigger>
                <TabsTrigger value="mindmap">
                  <GitFork />
                  思维导图
                </TabsTrigger>
                <TabsTrigger value="comparison">
                  <Scale />
                  对比矩阵
                </TabsTrigger>
                <TabsTrigger value="sources">
                  <Database />
                  已验证信源
                </TabsTrigger>
                <TabsTrigger value="reasoning">
                  <Workflow />
                  Agent 思考流
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right Meta Info & Quick Action */}
            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
              {activeResult && (
                <span className="whitespace-nowrap">
                  {activeResult.detectedLanguage
                    ? `${activeResult.detectedLanguage.name} · `
                    : ""}
                  {activeResult.filteredResults.length} 条核心信源
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                title="分享此搜索研报"
              >
                {sharedCopied ? <Check /> : <Share2 />}
                {sharedCopied ? "已复制链接" : "分享"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full">
        {/* HOMEPAGE VIEW: Clean Minimal Spotlight Search */}
        {isHomeView && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
            {/* iOS Center Brand Logo */}
            <div className="mb-8 flex flex-col items-center select-none">
              <GoogleLogo size="xl" showBadge={true} badgeText="Agent" />
            </div>

            {/* iOS Spotlight Search Bar */}
            <div className="w-full">
              <SearchBar
                onSearch={(q, deep) => executeSearch(q, deep)}
                isLoading={isLoading}
                initialQuery={currentQuery}
                isHomeView={true}
              />
            </div>

            {/* 首页小组件中心与图片图库快捷入口 */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMarketplaceOpen(true)}
                className="rounded-full h-8 px-3.5 gap-1.5 border-border/80 bg-background/60 hover:bg-muted/80 backdrop-blur-md shadow-xs transition-all hover:scale-105"
                title="浏览所有搜索引擎小组件 (Live Tile 磁贴矩阵与插件系统)"
              >
                <LayoutGrid className="size-3.5 text-primary" />
                <span className="font-medium text-foreground">小组件网格库</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold">12 磁贴</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage("images")}
                className="rounded-full h-8 px-3.5 gap-1.5 border-border/80 bg-background/60 hover:bg-muted/80 backdrop-blur-md shadow-xs transition-all hover:scale-105"
                title="进入专门加载与浏览图片的页面"
              >
                <Images className="size-3.5 text-pink-500" />
                <span className="font-medium text-foreground">图片图库专区</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-500 font-mono font-semibold">HD 画廊</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage("settings")}
                className="rounded-full h-8 px-3.5 gap-1.5 border-border/80 bg-background/60 hover:bg-muted/80 backdrop-blur-md shadow-xs transition-all hover:scale-105"
                title="选择 AI 大语言模型并配置自定义 API Key"
              >
                <SlidersHorizontal className="size-3.5 text-amber-500" />
                <span className="font-medium text-foreground">模型与 API 设置</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-semibold">
                  {settings.customApiKey ? "已自定义" : "配置"}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* SEARCH RESULTS VIEW */}
        {!isHomeView && (
          <div className={`${isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"} w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1 flex flex-col transition-all duration-200`}>
            {activeTab === "settings" ? (
              <ModelSettingsPage
                settings={settings}
                onUpdateSettings={(newPartial) => {
                  setSettings((prev) => {
                    const next = { ...prev, ...newPartial };
                    try {
                      localStorage.setItem("ai_search_settings", JSON.stringify(next));
                    } catch {}
                    return next;
                  });
                }}
                availableModels={availableModels}
                isServerKeyConfigured={isAiApiConfigured}
                isServerDisabled={isAiApiDisabled}
                defaultServerModel={DEFAULT_SETTINGS.selectedModel}
                onBack={() => {
                  if (activeResult) {
                    goToPage("bento");
                  } else {
                    goToPage(null);
                  }
                }}
                onGoToSearch={(q) => {
                  const targetQuery = q || "深度学习前沿进展";
                  setCurrentQuery(targetQuery);
                  goToPage("bento");
                  void executeSearch(targetQuery, settings.enableDeepSearch);
                }}
              />
            ) : (
              <>
            {/* Error Notification */}
            {errorMessage && (
              <Alert
                variant="destructive"
                className="mb-6 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => executeSearch(currentQuery, settings.enableDeepSearch)}
                >
                  <RefreshCw />
                  重试
                </Button>
              </Alert>
            )}

            {/* 极简搜索加载状态：检索进行中呈现纯粹简洁微动效，结果就绪后平滑展开研报 */}
            {(isLoading || (agentSteps.length > 0 && !activeResult)) && (
              <div className="flex-1 flex items-center justify-center min-h-[40vh]">
                <AgentOrchestrationLoader
                  steps={agentSteps}
                  query={currentQuery}
                  isStreaming={isLoading}
                />
              </div>
            )}

            {/* Empty State: 直接访问结果页目录但尚无研报数据 */}
            {!activeResult && !isLoading && agentSteps.length === 0 && (
              errorMessage ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-lg mx-auto">
                  <div className={`size-11 rounded-full ${isAiApiDisabled ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"} flex items-center justify-center mb-3`}>
                    <AlertCircle className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">
                    {isAiApiDisabled ? "AI API 当前已禁用" : "Agent 模型调用未完成"}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    {errorMessage}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeSearch(currentQuery, settings.enableDeepSearch)}
                      className="gap-1.5"
                    >
                      <RefreshCw className="size-3.5" />
                      重新尝试检索
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage("images")}
                      className="gap-1.5"
                    >
                      体验实时图片检索 (基于独立搜索引擎)
                    </Button>
                  </div>
                </div>
              ) : activeTab === "images" ? (
                <div className="w-full">
                  <ImageGalleryPage
                    activeResult={null}
                    query={route.query || currentQuery}
                    onExecuteSearch={(q, deep) => executeSearch(q, deep)}
                    isWideCanvas={isWideCanvas}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center py-24 text-center">
                  <p className="text-sm text-muted-foreground">
                    当前页面暂无研报数据，请在顶部搜索框输入关键词开始检索。
                  </p>
                </div>
              )
            )}

            {/* Results Bento Grid & Focused Tabs */}
            {activeResult && (
              <div className="flex-1">
                {activeResult.generationStatus === "degraded_search" && (
                  <Alert variant="destructive" className="mb-5">
                    <AlertCircle />
                    <AlertDescription>
                      这是搜索结果降级内容，未由大模型完成 Agent 综合；请勿视为 AI 结论。
                    </AlertDescription>
                  </Alert>
                )}
                {/* 1. PRIMARY SEARCH SYNTHESIS VIEW */}
                {activeTab === "bento" && (
                  <div className="space-y-5">
                    {/* Mode A: ZERO-SCROLL CLICK-ONLY COCKPIT (Ultra-efficient, no window scroll required) */}
                    {interactionMode === "cockpit" ? (
                      <CockpitWorkspace
                        activeResult={activeResult}
                        settings={settings}
                        onExecuteSearch={(q, deep) => executeSearch(q, deep)}
                        onSwitchToBentoGrid={() => handleToggleInteractionMode("bento")}
                        isDark={darkMode}
                      />
                    ) : (
                      /* Mode B: 动态 Live Tile 12 栅格磁贴桌面系统 (iOS 毛玻璃拟物 + Windows Phone Live Tile) */
                      <div className="space-y-4">
                        <TileDesktopView
                          strategy={currentStrategy}
                          enabledWidgets={currentStrategy.componentOrder}
                          widgetPlan={activeResult.widgetPlan}
                          activeResult={activeResult}
                          isWideCanvas={isWideCanvas}
                          onOpenMarketplace={() => setIsMarketplaceOpen(true)}
                          onExecuteSearch={(q, deep) => executeSearch(q, deep)}
                          onNavigateTab={(tab) => goToPage(tab)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. TAB: DEDICATED IMAGE GALLERY PAGE */}
                {activeTab === "images" && (
                  <div className="w-full">
                    <ImageGalleryPage
                      activeResult={activeResult}
                      query={activeResult.query || currentQuery}
                      onExecuteSearch={(q, deep) => executeSearch(q, deep)}
                      isWideCanvas={isWideCanvas}
                    />
                  </div>
                )}

                {/* 3. TAB: RELATED LINKS */}
                {(activeTab === "mindmap" || activeTab === "comparison" || activeTab === "sources") && (
                  <div className="w-full">
                    <RelatedLinksWidget
                      result={activeResult}
                      query={activeResult.query}
                      onExecuteSearch={(q, deep) => executeSearch(q, deep)}
                    />
                  </div>
                )}

                {/* 4. TAB: AGENT REASONING STREAM */}
                {activeTab === "reasoning" && (
                  <div className="w-full max-w-5xl mx-auto">
                    <AgentProgressStream
                      steps={activeResult.steps}
                      query={activeResult.query}
                      isComplete={true}
                      executionTimeMs={activeResult.executionTimeMs}
                    />
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Search History Drawer */}
      <SearchHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={(res) => {
          setActiveResult(res);
          setCurrentQuery(res.query);
          setAgentSteps(res.steps || []);
          navigate("bento", res.query.trim(), { replace: false });
        }}
        onClear={handleClearHistory}
      />

      {/* Widget Marketplace Drawer (小组件商店 / 磁贴中心) */}
      <WidgetMarketplaceDrawer
        isOpen={isMarketplaceOpen}
        onClose={() => setIsMarketplaceOpen(false)}
        activeTileIds={(currentStrategy?.componentOrder || []).map(String)}
        onAddTile={(id) => {
          setCustomEnabledWidgets((prev) => {
            const current = prev || currentStrategy?.componentOrder || [];
            if (!current.includes(id as any) && current.length < WIDGET_ACTIVATION_POLICY.max) {
              return [...current, id as any];
            }
            return current;
          });
          setCustomWidgetOrder((prev) => {
            const current = prev || currentStrategy?.componentOrder || [];
            if (!current.includes(id as any) && current.length < WIDGET_ACTIVATION_POLICY.max) {
              return [...current, id as any];
            }
            return current;
          });
        }}
        onRemoveTile={(id) => {
          setCustomEnabledWidgets((prev) => {
            const current = prev || currentStrategy?.componentOrder || [];
            if (current.length <= WIDGET_ACTIVATION_POLICY.min) return current;
            return current.filter((k) => String(k) !== id);
          });
          setCustomWidgetOrder((prev) => {
            const current = prev || currentStrategy?.componentOrder || [];
            if (current.length <= WIDGET_ACTIVATION_POLICY.min) return current;
            return current.filter((k) => String(k) !== id);
          });
        }}
      />

      {/* 页脚：一行元信息，无装饰 */}
      <footer className="w-full border-t border-border text-xs text-muted-foreground mt-auto">
        <div className={`${isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 flex flex-wrap items-center justify-between gap-3 transition-all duration-200`}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Cerlesse</span>
            <span>·</span>
            <span>基于 SearXNG 与 OpenAI-compatible 大模型</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hover:text-foreground cursor-pointer" onClick={() => setIsHistoryOpen(true)}>
              历史记录
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
