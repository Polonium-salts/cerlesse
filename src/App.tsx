/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { GoogleLogo } from "./components/GoogleLogo.js";
import { SearchBar } from "./components/SearchBar.js";
import { AIOverviewWidget } from "./components/AIOverviewWidget.js";
import { KeyTakeawaysWidget } from "./components/KeyTakeawaysWidget.js";
import { OfficialPortalWidget } from "./components/OfficialPortalWidget.js";
import { MindMapWidget } from "./components/MindMapWidget.js";
import { ComparisonMatrixWidget } from "./components/ComparisonMatrixWidget.js";
import { SourcesListWidget } from "./components/SourcesListWidget.js";
import { FollowUpWidget } from "./components/FollowUpWidget.js";
import { MetricsTelemetryWidget } from "./components/widgets/MetricsTelemetryWidget.js";
import { QuickActionsToolboxWidget } from "./components/widgets/QuickActionsToolboxWidget.js";
import { QuickAnswerWidget } from "./components/widgets/QuickAnswerWidget.js";
import { TopicDigestWidget } from "./components/widgets/TopicDigestWidget.js";
import { AgentAuditWidget } from "./components/widgets/AgentAuditWidget.js";
import { AnalyticsTrendWidget } from "./components/widgets/AnalyticsTrendWidget.js";
import { VerificationChecklistWidget } from "./components/widgets/VerificationChecklistWidget.js";
import { FastChatWidget } from "./components/widgets/FastChatWidget.js";
import { MobileQRConnectWidget } from "./components/widgets/MobileQRConnectWidget.js";
import { AgentProgressStream } from "./components/AgentProgressStream.js";
import { SearchHistoryDrawer } from "./components/SearchHistoryDrawer.js";
import { AdaptiveLayoutControl } from "./components/AdaptiveLayoutControl.js";
import { AdaptiveMasonryGrid } from "./components/AdaptiveMasonryGrid.js";
import { CockpitWorkspace } from "./components/CockpitWorkspace.js";
import { UniqueCardWidget } from "./components/widgets/UniqueCardWidget.js";
import { UniqueCardForgeModal } from "./components/UniqueCardForgeModal.js";
import { 
  AgentStep, 
  SearchSynthesisResult, 
  UserSettings, 
  OpenRouterModel,
  AdaptiveLayoutStrategy,
  LayoutIntentType,
  ResultWidgetKey,
  LayoutAlignmentMode,
  AutoFillGapsMode,
  AgentTeamReport,
  CustomCardData,
  ALL_RESULT_WIDGET_KEYS
} from "./types.js";
import { 
  computeAdaptiveLayoutFromQuery, 
  getStrategyForPreset,
  calculateAdaptiveBinPacking,
  getWidgetGridClass
} from "./lib/adaptiveLayout.js";
import { motion } from "motion/react";
import { 
  LayoutGrid, 
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
  Zap
} from "lucide-react";

const DEFAULT_SETTINGS: UserSettings = {
  openRouterApiKey: "",
  selectedModel: "openrouter/free",
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

  // Settings state with auto-migration from deprecated model slugs (e.g. deepseek/deepseek-r1:free)
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const savedRaw = localStorage.getItem("ai_search_settings");
      if (!savedRaw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(savedRaw);
      // Auto-migrate deprecated deepseek free slug to valid default
      if (parsed.selectedModel === "deepseek/deepseek-r1:free") {
        parsed.selectedModel = "openrouter/free";
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);

  // Search execution state
  const [currentQuery, setCurrentQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [activeResult, setActiveResult] = useState<SearchSynthesisResult | null>(null);
  const [agentTeam, setAgentTeam] = useState<AgentTeamReport | null>(null);
  const [activeTab, setActiveTab] = useState<"bento" | "mindmap" | "comparison" | "sources" | "reasoning" | "custom_cards">("bento");
  const [sharedCopied, setSharedCopied] = useState(false);

  // Dynamic Unique Custom Cards state
  const [customCards, setCustomCards] = useState<CustomCardData[]>(() => {
    try {
      const saved = localStorage.getItem("cerlesse_custom_cards");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
  const [preselectedSourceIds, setPreselectedSourceIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem("cerlesse_custom_cards", JSON.stringify(customCards));
    } catch (e) {
      console.error("Failed to persist custom cards:", e);
    }
  }, [customCards]);

  const handleOpenForgeModal = (sourceIds?: string[]) => {
    setPreselectedSourceIds(sourceIds || []);
    setIsForgeModalOpen(true);
  };

  const handleCardCreated = (newCard: CustomCardData) => {
    setCustomCards(prev => [newCard, ...prev]);
  };

  const handleUpdateCard = (updated: CustomCardData) => {
    setCustomCards(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDeleteCard = (id: string) => {
    setCustomCards(prev => prev.filter(c => c.id !== id));
  };

  // Adaptive Layout state: automatically arranged based on query & agent intent
  const [layoutPreset, setLayoutPreset] = useState<LayoutIntentType | "custom">("deep_research");
  const [customWidgetOrder, setCustomWidgetOrder] = useState<ResultWidgetKey[] | null>(null);

  // Interaction Mode: "bento" (4-column Bento grid of atomic widgets) vs "cockpit" (Zero-scroll click-only cockpit)
  const [interactionMode, setInteractionMode] = useState<"cockpit" | "bento">(() => {
    const saved = localStorage.getItem("search_interaction_mode");
    return (saved === "bento" || saved === "cockpit") ? saved : "bento"; // default: 4-column modular Bento grid of atomic widgets
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

  // Intelligent Layout Fine-Tuning Panel Open State (Toggled from Top Navigation Bar)
  const [isLayoutControlOpen, setIsLayoutControlOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("layout_finetune_collapsed");
    return saved !== null ? saved === "false" : false; // default hidden
  });

  const handleToggleLayoutControl = () => {
    if (activeTab !== "bento") {
      setActiveTab("bento");
      setIsLayoutControlOpen(true);
      try {
        localStorage.setItem("layout_finetune_collapsed", "false");
      } catch (e) {}
    } else {
      setIsLayoutControlOpen((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("layout_finetune_collapsed", String(!next));
        } catch (e) {}
        return next;
      });
    }
  };

  // When a new search completes or activeResult changes, automatically adopt Agent's intent recommendation
  useEffect(() => {
    if (activeResult) {
      const rec = computeAdaptiveLayoutFromQuery(activeResult, undefined, { autoFillGaps, autoFillMode });
      setLayoutPreset(rec.intentType);
      setCustomWidgetOrder(rec.componentOrder);
      setCustomEnabledWidgets(rec.enabledWidgets || null);
      setCustomWidgetSpans({});
    }
  }, [activeResult]);

  // Compute the currently effective strategy
  const currentStrategy = React.useMemo<AdaptiveLayoutStrategy>(() => {
    if (!activeResult) return getStrategyForPreset("balanced", "", true, undefined, undefined, { autoFillGaps, autoFillMode });
    const hasOfficial = activeResult.filteredResults.some((r) => r.isOfficial);

    const baseRec = computeAdaptiveLayoutFromQuery(activeResult, customWidgetSpans, { autoFillGaps, autoFillMode });
    const activeEnabled = customEnabledWidgets || baseRec.enabledWidgets || ALL_RESULT_WIDGET_KEYS;

    const targetOrder: ResultWidgetKey[] = customWidgetOrder || baseRec.componentOrder;
    // Filter down to enabled widgets only for the visual layout
    const visibleOrder: ResultWidgetKey[] = targetOrder.filter((k) => activeEnabled.includes(k));
    const safeVisibleOrder: ResultWidgetKey[] = visibleOrder.length > 0 ? visibleOrder : ["quick_answer", "takeaways", "sources"];

    const emphasized: ResultWidgetKey = safeVisibleOrder.includes(baseRec.emphasizedWidget)
      ? baseRec.emphasizedWidget
      : safeVisibleOrder[0];

    const packing = calculateAdaptiveBinPacking(safeVisibleOrder, {
      emphasizedWidget: emphasized,
      intentType: layoutPreset === "custom" ? baseRec.intentType : (layoutPreset as LayoutIntentType),
      hasOfficialSite: hasOfficial,
      maxColumnsPerRow: 4,
      customSpans: customWidgetSpans,
      autoFillGaps,
      autoFillMode
    });

    return {
      ...baseRec,
      intentType: layoutPreset === "custom" ? baseRec.intentType : (layoutPreset as LayoutIntentType),
      componentOrder: packing.autoFilledOrder || safeVisibleOrder,
      emphasizedWidget: emphasized,
      gridConfig: packing.gridConfig,
      totalRows: packing.totalRows,
      maxColumnsPerRow: 4,
      packingMethod: "agent-adaptive-binpack",
      enabledWidgets: activeEnabled,
      disabledWidgets: ALL_RESULT_WIDGET_KEYS.filter(k => !activeEnabled.includes(k)),
      widgetStatusMap: baseRec.widgetStatusMap,
      customWidgetSpans,
      alignmentMode,
      autoFillGaps,
      autoFillMode,
      filledGapsCount: packing.filledGapsCount
    };
  }, [activeResult, layoutPreset, customWidgetOrder, customEnabledWidgets, customWidgetSpans, alignmentMode, autoFillGaps, autoFillMode]);

  const currentEnabledWidgets = currentStrategy.enabledWidgets || ALL_RESULT_WIDGET_KEYS;

  const activeWidgetOrder = customWidgetOrder || currentStrategy.componentOrder;

  const handleSelectPreset = (preset: LayoutIntentType) => {
    setLayoutPreset(preset);
    const strat = getStrategyForPreset(preset, activeResult?.query, activeResult?.filteredResults.some(r => r.isOfficial));
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
      const currentList = prev || currentStrategy.enabledWidgets || [
        "takeaways",
        "official_portal",
        "ai_overview",
        "mindmap",
        "comparison",
        "sources",
        "followup"
      ];
      let nextList: ResultWidgetKey[];
      if (currentList.includes(widgetKey)) {
        if (currentList.length <= 1) return currentList; // Keep at least 1 widget
        nextList = currentList.filter((k) => k !== widgetKey);
      } else {
        nextList = [...currentList, widgetKey];
      }
      return nextList;
    });
    setLayoutPreset("custom");
  };

  const handleResetToRecommended = () => {
    if (!activeResult) return;
    const rec = computeAdaptiveLayoutFromQuery(activeResult);
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

  // Load config from server
  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          setAvailableModels(data.models);
          // If current selectedModel was deprecated or default without custom key, auto-select the ultra-fast default model
          setSettings(prev => {
            if (prev.selectedModel === "deepseek/deepseek-r1:free" || (data.defaultModel && prev.selectedModel === "openrouter/free" && !prev.openRouterApiKey)) {
              const updated = { ...prev, selectedModel: data.defaultModel };
              localStorage.setItem("ai_search_settings", JSON.stringify(updated));
              return updated;
            }
            return prev;
          });
        }
      })
      .catch(err => console.warn("Failed to load server config", err));
  }, []);

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("ai_search_history");
  };

  const handleResetSession = () => {
    setActiveResult(null);
    setAgentSteps([]);
    setAgentTeam(null);
    setCurrentQuery("");
    setErrorMessage(null);
    setActiveTab("bento");
  };

  const executeSearch = async (query: string, deep: boolean = true) => {
    if (!query.trim() || isLoading) return;

    setCurrentQuery(query);
    setIsLoading(true);
    setErrorMessage(null);
    setAgentSteps([]);
    setAgentTeam(null);
    setActiveResult(null);
    setActiveTab("bento");

    const queryParams = new URLSearchParams();
    queryParams.set("q", query.trim());
    if (settings.selectedModel) queryParams.set("model", settings.selectedModel);
    if (settings.openRouterApiKey && settings.openRouterApiKey.trim()) {
      queryParams.set("apiKey", settings.openRouterApiKey.trim());
    }
    if (settings.searxngCustomUrl && settings.searxngCustomUrl.trim()) {
      queryParams.set("searxngUrl", settings.searxngCustomUrl.trim());
    }
    queryParams.set("deep", deep ? "true" : "false");
    if (settings.language) queryParams.set("lang", settings.language);

    let hasCompleted = false;

    const fallbackPostSearch = async () => {
      if (hasCompleted) return;
      hasCompleted = true;
      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            model: settings.selectedModel || undefined,
            apiKey: settings.openRouterApiKey?.trim() || undefined,
            customSearxngUrl: settings.searxngCustomUrl?.trim() || undefined,
            enableDeepSearch: deep,
            targetLanguage: settings.language || "auto"
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Agent 搜索服务响应异常");
        }

        const result: SearchSynthesisResult = await res.json();
        setActiveResult(result);
        setAgentSteps(result.steps || []);
        if (result.agentTeam) {
          setAgentTeam(result.agentTeam);
        }
        if (result.customCards && result.customCards.length > 0) {
          setCustomCards(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const newCards = result.customCards!.filter(c => !existingIds.has(c.id));
            const updated = [...newCards, ...prev];
            try {
              localStorage.setItem("ai_custom_cards", JSON.stringify(updated));
            } catch {
              // ignore
            }
            return updated;
          });
        }
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

    // Safety watchdog timer: if stream stalls for more than 25 seconds, gracefully trigger fallback
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

      // Handle real-time AgentTeam collaborative matrix updates
      eventSource.addEventListener("team_update", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.agentTeam) {
            setAgentTeam(data.agentTeam);
          }
        } catch (e) {
          console.warn("Failed to parse SSE team update", e);
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
            if (result.agentTeam) {
              setAgentTeam(result.agentTeam);
            }
            if (result.customCards && result.customCards.length > 0) {
              setCustomCards(prev => {
                const existingIds = new Set(prev.map(c => c.id));
                const newCards = result.customCards!.filter(c => !existingIds.has(c.id));
                const updated = [...newCards, ...prev];
                try {
                  localStorage.setItem("ai_custom_cards", JSON.stringify(updated));
                } catch {
                  // ignore
                }
                return updated;
              });
            }
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

    } catch (err: any) {
      clearTimeout(watchdogTimer);
      fallbackPostSearch();
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setSharedCopied(true);
    setTimeout(() => setSharedCopied(false), 2000);
  };

  const isHomeView = !activeResult && !isLoading && agentSteps.length === 0;
  const officialSite = activeResult?.filteredResults.find(r => r.isOfficial);

  const getGridClassForWidget = (key: ResultWidgetKey, isEmphasized: boolean) => {
    const placement = currentStrategy.gridConfig?.[key];
    if (placement) {
      return getWidgetGridClass(placement);
    }
    switch (key) {
      case "comparison":
        return isEmphasized ? "col-span-12" : "col-span-12 lg:col-span-6";
      case "mindmap":
        return isEmphasized ? "col-span-12" : "col-span-12 lg:col-span-6";
      case "ai_overview":
        return "col-span-12 lg:col-span-8";
      case "takeaways":
        return "col-span-12 lg:col-span-4";
      case "official_portal":
        return "col-span-12 sm:col-span-6 lg:col-span-3";
      case "followup":
        return "col-span-12 sm:col-span-6 lg:col-span-3";
      case "sources":
        return "col-span-12";
      case "custom_cards":
        return "col-span-12 lg:col-span-6";
      default:
        return "col-span-12";
    }
  };

  const renderWidgetContent = (key: ResultWidgetKey, overrideCompact?: boolean) => {
    if (!activeResult) return null;
    const placement = currentStrategy.gridConfig?.[key];
    const isCompact = overrideCompact ?? placement?.isCompact ?? (placement?.colSpanLg ? placement.colSpanLg <= 4 : false);

    switch (key) {
      case "custom_cards":
        if (!customCards || customCards.length === 0) return null;
        return (
          <div className="space-y-4 w-full">
            {customCards.map((card) => (
              <UniqueCardWidget
                key={card.id}
                card={card}
                onUpdateCard={handleUpdateCard}
                onDeleteCard={handleDeleteCard}
                isCompact={isCompact}
              />
            ))}
          </div>
        );
      case "quick_answer":
        return (
          <QuickAnswerWidget
            query={activeResult.query}
            summary={activeResult.summary}
            keyTakeaways={activeResult.keyTakeaways}
          />
        );
      case "metrics_telemetry":
        return (
          <MetricsTelemetryWidget
            result={activeResult}
          />
        );
      case "actions_toolbox":
        return (
          <QuickActionsToolboxWidget
            result={activeResult}
            onReSearch={() => executeSearch(activeResult.query, settings.enableDeepSearch)}
            onOpenForgeModal={() => handleOpenForgeModal()}
          />
        );
      case "analytics_trend":
        return (
          <AnalyticsTrendWidget
            result={activeResult}
            onViewDeepAnalysis={() => setActiveTab("sources")}
          />
        );
      case "verification_checklist":
        return (
          <VerificationChecklistWidget
            result={activeResult}
          />
        );
      case "fast_chat":
        return (
          <FastChatWidget
            query={activeResult.query}
            followUpQuestions={activeResult.followUpQuestions}
            onAsk={(q) => executeSearch(q, settings.enableDeepSearch)}
          />
        );
      case "mobile_qr":
        return (
          <MobileQRConnectWidget
            query={activeResult.query}
            url={officialSite?.url}
          />
        );
      case "topic_digest":
        return (
          <TopicDigestWidget
            query={activeResult.query}
            summary={activeResult.summary}
            filteredResults={activeResult.filteredResults}
          />
        );
      case "agent_workflow":
        return (
          <AgentAuditWidget
            steps={activeResult.steps}
            query={activeResult.query}
            executionTimeMs={activeResult.executionTimeMs}
            modelUsed={activeResult.modelUsed}
            agentTeam={activeResult.agentTeam || agentTeam}
            onViewDetails={() => setActiveTab("reasoning")}
          />
        );
      case "comparison":
        return (
          <ComparisonMatrixWidget
            comparisonTable={activeResult.comparisonTable}
            query={activeResult.query}
          />
        );
      case "mindmap":
        return (
          <MindMapWidget
            rootNode={activeResult.mindMap}
            query={activeResult.query}
            isDark={darkMode}
          />
        );
      case "official_portal":
        return (
          <OfficialPortalWidget
            query={activeResult.query}
            officialWebsite={officialSite}
            detectedLanguage={activeResult.detectedLanguage}
            rawResultCount={activeResult.rawResultCount}
            filteredCount={activeResult.filteredResults.length}
            isCompact={isCompact}
          />
        );
      case "takeaways":
        return (
          <KeyTakeawaysWidget
            keyTakeaways={activeResult.keyTakeaways}
            isCompact={isCompact}
          />
        );
      case "ai_overview":
        return (
          <AIOverviewWidget
            summary={activeResult.summary}
            query={activeResult.query}
            modelUsed={activeResult.modelUsed}
            filteredResults={activeResult.filteredResults}
            detectedLanguage={activeResult.detectedLanguage}
            onOpenMindMap={() => setActiveTab("mindmap")}
            onOpenComparison={() => setActiveTab("comparison")}
          />
        );
      case "sources":
        return (
          <SourcesListWidget
            results={activeResult.filteredResults}
            rawResultCount={activeResult.rawResultCount}
            isCompact={isCompact}
            onForgeCardFromSource={(srcId) => handleOpenForgeModal([srcId])}
            onOpenForgeModal={() => handleOpenForgeModal()}
          />
        );
      case "followup":
        return (
          <FollowUpWidget
            questions={activeResult.followUpQuestions}
            onQuestionClick={(q) => executeSearch(q, settings.enableDeepSearch)}
            isCompact={isCompact}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f2f2f6] dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* iOS App Header */}
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onReset={handleResetSession}
        selectedModel={settings.selectedModel}
        hasApiKey={Boolean(settings.openRouterApiKey)}
        searxngStatus={settings.searxngCustomUrl ? "自定义实例" : "高可用集群"}
        isHomeView={isHomeView}
        currentQuery={currentQuery}
        onSearch={(q, deep) => executeSearch(q, deep)}
        isLoading={isLoading}
        isWideCanvas={isWideCanvas}
        onToggleCanvasWidth={handleToggleCanvasWidth}
        onToggleLayoutControl={activeResult ? handleToggleLayoutControl : undefined}
        isLayoutControlOpen={isLayoutControlOpen}
        layoutStrategyName={currentStrategy?.intentLabel}
        isCustomizedLayout={layoutPreset === "custom"}
      />

      {/* iOS Segmented Navigation Bar (When on Search Results Page) */}
      {!isHomeView && (
        <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-[#121214]/70 backdrop-blur-xl sticky top-16 z-30">
          <div className={`${isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar transition-all duration-200`}>
            {/* iOS Segmented Control */}
            <div className="p-1 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/80 flex items-center gap-1 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("bento")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeTab === "bento"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>全景网格</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("mindmap")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeTab === "mindmap"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>思维导图</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("comparison")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeTab === "comparison"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>对比矩阵</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("sources")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeTab === "sources"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>已验证信源</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("reasoning")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeTab === "reasoning"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <Workflow className="w-3.5 h-3.5 text-blue-500" />
                <span>AgentTeam 协作</span>
                {(activeResult?.agentTeam?.speedupMultiplier || agentTeam?.speedupMultiplier) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {activeResult?.agentTeam?.speedupMultiplier || agentTeam?.speedupMultiplier}x
                  </span>
                )}
              </button>
            </div>

            {/* Right Meta Info & Quick Action */}
            <div className="hidden md:flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
              {activeResult?.detectedLanguage && (
                <div 
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-200/60 dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium"
                >
                  <span>{activeResult.detectedLanguage.flag}</span>
                  <span>{activeResult.detectedLanguage.name}</span>
                  {activeResult.detectedLanguage.crossLingualEnabled && (
                    <span className="text-[10px] text-zinc-500">· 跨语言</span>
                  )}
                </div>
              )}
              {activeResult && (
                <span>
                  共汇聚 {activeResult.filteredResults.length} 条核心信源
                </span>
              )}
              <button
                onClick={() => handleOpenForgeModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity text-xs font-semibold shadow-2xs cursor-pointer"
                title="根据搜索结果创建独有卡片组件"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>创建独有卡片</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                title="分享此搜索研报"
              >
                {sharedCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{sharedCopied ? "已复制链接" : "分享"}</span>
              </button>
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
          </div>
        )}

        {/* SEARCH RESULTS VIEW */}
        {!isHomeView && (
          <div className={`${isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"} w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1 flex flex-col transition-all duration-200`}>
            {/* Error Notification */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-3xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 flex items-center justify-between gap-3 text-red-700 dark:text-red-300 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={() => executeSearch(currentQuery, settings.enableDeepSearch)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-red-200 dark:border-red-800 hover:bg-red-50 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>重试</span>
                </button>
              </div>
            )}

            {/* Real-time Agent Stream (When loading or before synthesis completed) */}
            {(isLoading || (agentSteps.length > 0 && !activeResult)) && (
              <div className="mb-6">
                <AgentProgressStream
                  steps={agentSteps}
                  query={currentQuery}
                  isComplete={!isLoading && Boolean(activeResult)}
                  executionTimeMs={activeResult?.executionTimeMs}
                  agentTeam={agentTeam || activeResult?.agentTeam}
                />
              </div>
            )}

            {/* Results Bento Grid & Focused Tabs */}
            {activeResult && (
              <div className="flex-1">
                {/* 1. PRIMARY SEARCH SYNTHESIS VIEW */}
                {activeTab === "bento" && (
                  <div className="space-y-5">
                    {/* Agent Adaptive Layout Control Header */}
                    <AdaptiveLayoutControl
                      currentStrategy={currentStrategy}
                      selectedPreset={layoutPreset}
                      activeOrder={activeWidgetOrder}
                      enabledWidgets={currentEnabledWidgets}
                      alignmentMode={alignmentMode}
                      interactionMode={interactionMode}
                      customWidgetSpans={customWidgetSpans}
                      autoFillGaps={autoFillGaps}
                      autoFillMode={autoFillMode}
                      onToggleAutoFillGaps={handleToggleAutoFillGaps}
                      onChangeAutoFillMode={handleChangeAutoFillMode}
                      onToggleInteractionMode={handleToggleInteractionMode}
                      onToggleAlignmentMode={handleToggleAlignmentMode}
                      onChangeWidgetSpan={handleChangeWidgetSpan}
                      onSelectPreset={handleSelectPreset}
                      onMoveWidget={handleMoveWidget}
                      onToggleWidgetActivation={handleToggleWidgetActivation}
                      onResetToRecommended={handleResetToRecommended}
                      isWideCanvas={isWideCanvas}
                      onToggleCanvasWidth={handleToggleCanvasWidth}
                      isCollapsed={!isLayoutControlOpen}
                      onToggleCollapse={(collapsed) => setIsLayoutControlOpen(!collapsed)}
                      hideCollapsedBar={true}
                    />

                    {/* Mode A: ZERO-SCROLL CLICK-ONLY COCKPIT (Ultra-efficient, no window scroll required) */}
                    {interactionMode === "cockpit" ? (
                      <CockpitWorkspace
                        activeResult={activeResult}
                        settings={settings}
                        onExecuteSearch={(q, deep) => executeSearch(q, deep)}
                        onSwitchToBentoGrid={() => handleToggleInteractionMode("bento")}
                        isDark={darkMode}
                        customCards={customCards}
                        onUpdateCard={handleUpdateCard}
                        onDeleteCard={handleDeleteCard}
                        onOpenForgeModal={handleOpenForgeModal}
                      />
                    ) : (
                      /* Mode B: 4-CELL FREE-FLOW BENTO GRID (Multi-row scrollable bento layout) */
                      <div className="space-y-4">
                        <AdaptiveMasonryGrid
                          strategy={currentStrategy}
                          enabledWidgets={currentStrategy.componentOrder}
                          isWideCanvas={isWideCanvas}
                          alignmentMode={alignmentMode}
                          autoFillGaps={autoFillGaps}
                          autoFillMode={autoFillMode}
                          renderWidget={(key, isCompact) => renderWidgetContent(key, isCompact)}
                          getGridClassForWidget={(key, isEmphasized) => getGridClassForWidget(key, isEmphasized)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. TAB: FULLSCREEN INTERACTIVE MIND MAP */}
                {activeTab === "mindmap" && (
                  <div className="w-full">
                    <MindMapWidget
                      rootNode={activeResult.mindMap}
                      query={activeResult.query}
                      isDark={darkMode}
                    />
                  </div>
                )}

                {/* 3. TAB: FULL COMPARISON MATRIX */}
                {activeTab === "comparison" && (
                  <div className="w-full">
                    <ComparisonMatrixWidget
                      comparisonTable={activeResult.comparisonTable}
                      query={activeResult.query}
                    />
                  </div>
                )}

                {/* 4. TAB: FULL FILTERED SOURCES */}
                {activeTab === "sources" && (
                  <div className="w-full">
                    <SourcesListWidget
                      results={activeResult.filteredResults}
                      rawResultCount={activeResult.rawResultCount}
                      onForgeCardFromSource={(srcId) => handleOpenForgeModal([srcId])}
                      onOpenForgeModal={() => handleOpenForgeModal()}
                    />
                  </div>
                )}

                {/* 5. TAB: AGENT REASONING STREAM */}
                {activeTab === "reasoning" && (
                  <div className="w-full max-w-5xl mx-auto">
                    <AgentProgressStream
                      steps={activeResult.steps}
                      query={activeResult.query}
                      isComplete={true}
                      executionTimeMs={activeResult.executionTimeMs}
                      agentTeam={activeResult.agentTeam || agentTeam}
                    />
                  </div>
                )}
              </div>
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
          if (res.customCards && res.customCards.length > 0) {
            setCustomCards(prev => {
              const existingIds = new Set(prev.map(c => c.id));
              const newCards = res.customCards!.filter(c => !existingIds.has(c.id));
              return [...newCards, ...prev];
            });
          }
          setActiveTab("bento");
        }}
        onClear={handleClearHistory}
      />

      {/* Unique Card Forge Modal */}
      {activeResult && (
        <UniqueCardForgeModal
          isOpen={isForgeModalOpen}
          onClose={() => setIsForgeModalOpen(false)}
          query={activeResult.query}
          results={activeResult.filteredResults}
          onCardCreated={handleCardCreated}
          preselectedResultIds={preselectedSourceIds}
        />
      )}

      {/* iOS Minimalist Footer in Gray & White */}
      <footer className="w-full border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-[#121214]/50 text-xs text-zinc-500 dark:text-zinc-400 mt-auto">
        <div className={`${isWideCanvas ? "w-full max-w-[2560px] 2xl:max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 flex flex-wrap items-center justify-between gap-3 transition-all duration-200`}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Cerlesse</span>
            <span>·</span>
            <span>基于 SearXNG 与 OpenRouter 大模型</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer" onClick={() => setIsHistoryOpen(true)}>
              历史记录
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
