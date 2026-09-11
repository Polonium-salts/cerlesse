import React, { useState, useRef, useMemo, useEffect } from "react";
import { MindMapNode } from "../types.js";
import { Card } from "./ui/Card.js";
import { Button } from "./ui/Button.js";
import { Badge } from "./ui/Badge.js";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  Dices,
  Palette,
  GitFork,
  Search,
  Compass,
  FolderOpen,
  FolderMinus,
  Info,
  Layers,
  ArrowRightLeft,
  Workflow
} from "lucide-react";
import {
  MindMapTopology,
  MindMapVisualTheme,
  MindMapLinkStyle,
  MindMapStyleConfig,
  inferAgentMindMapStyle,
  generateNextMindMapStyle,
  computeMindMapLayout,
  CalculatedMindMapNode
} from "../lib/mindMapLayouts.js";

interface MindMapViewProps {
  rootNode: MindMapNode;
  query: string;
  isCompact?: boolean;
  colSpan?: number;
  isDark?: boolean;
  isFullscreen?: boolean;
}

export const MindMapView: React.FC<MindMapViewProps> = ({
  rootNode,
  query,
  isCompact = false,
  colSpan,
  isDark: propIsDark,
  isFullscreen = false
}) => {
  // Adaptive canvas height based on widget span & intent
  const canvasHeightClass = useMemo(() => {
    if (isFullscreen) {
      return "h-[calc(94vh-170px)] min-h-[500px]";
    }
    if (isCompact || (colSpan !== undefined && colSpan <= 4)) {
      return "h-[340px] sm:h-[380px]";
    }
    if (colSpan !== undefined && colSpan <= 6) {
      return "h-[420px] sm:h-[460px]";
    }
    return "h-[480px] sm:h-[540px]";
  }, [isFullscreen, isCompact, colSpan]);

  // Agent initial style inference
  const initialAgentStyle = useMemo(() => {
    return inferAgentMindMapStyle(query, rootNode);
  }, [query, rootNode]);

  const [currentConfig, setCurrentConfig] = useState<MindMapStyleConfig>(initialAgentStyle);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"canvas" | "outline">("canvas");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [styleGenerationCount, setStyleGenerationCount] = useState(0);

  // Performance refs for butter-smooth 60fps/120fps hardware accelerated dragging
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 50, y: 150 });
  const zoomRef = useRef(1);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Sync when query or rootNode changes
  useEffect(() => {
    const recommended = inferAgentMindMapStyle(query, rootNode);
    setCurrentConfig(recommended);
    setCollapsedNodeIds(new Set());
    setSelectedNode(null);
  }, [query, rootNode]);

  // Fast GPU transform applicator
  const updateTransformDirect = (p: { x: number; y: number }, z: number, animate = false) => {
    if (!viewportRef.current) return;
    viewportRef.current.style.transition = animate
      ? "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
      : "none";
    viewportRef.current.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) scale(${z})`;
  };

  // High-performance pointer handlers with pointer capture (never drops drag off canvas edges)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button
    if (e.button !== 0 && e.pointerType === "mouse") return;

    // Do not initiate drag if clicking an interactive control
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) {
      return;
    }

    isDraggingRef.current = true;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y
    };
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}

    if (viewportRef.current) {
      viewportRef.current.style.transition = "none";
      viewportRef.current.style.willChange = "transform";
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - pointerStartPosRef.current.x;
    const deltaY = e.clientY - pointerStartPosRef.current.y;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      hasMovedRef.current = true;
    }

    const nextX = e.clientX - dragStartRef.current.x;
    const nextY = e.clientY - dragStartRef.current.y;
    panRef.current = { x: nextX, y: nextY };

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // Schedule directly on next display refresh tick
    rafIdRef.current = requestAnimationFrame(() => {
      if (viewportRef.current) {
        viewportRef.current.style.transform = `translate3d(${Math.round(nextX)}px, ${Math.round(nextY)}px, 0) scale(${zoomRef.current})`;
      }
      rafIdRef.current = null;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch (err) {}

    if (viewportRef.current) {
      viewportRef.current.style.willChange = "auto";
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Sync React state once on mouseup (no continuous re-renders during drag)
    setPan({ ...panRef.current });
  };

  // Wheel zoom & pan (non-passive listener for smooth trackpad & mouse wheel)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || viewMode !== "canvas") return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+Scroll
        const zoomDelta = -e.deltaY * 0.008;
        const currentZ = zoomRef.current;
        const nextZ = Math.min(2.4, Math.max(0.25, Number((currentZ * (1 + zoomDelta)).toFixed(3))));

        // Pivot around cursor
        const nextX = cursorX - (cursorX - panRef.current.x) * (nextZ / currentZ);
        const nextY = cursorY - (cursorY - panRef.current.y) * (nextZ / currentZ);

        panRef.current = { x: nextX, y: nextY };
        zoomRef.current = nextZ;

        updateTransformDirect(panRef.current, nextZ, false);
        setZoom(nextZ);
        setPan(panRef.current);
      } else {
        // Trackpad 2-finger pan or regular scroll
        const nextX = panRef.current.x - e.deltaX;
        const nextY = panRef.current.y - e.deltaY;
        panRef.current = { x: nextX, y: nextY };

        updateTransformDirect(panRef.current, zoomRef.current, false);
        setPan(panRef.current);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [viewMode]);

  const handleResetZoom = (cx?: number, cy?: number) => {
    const targetZoom = 1;
    let targetPan = { x: 50, y: 150 };
    if (cx !== undefined && cy !== undefined) {
      targetPan = { x: -cx + 400, y: -cy + 300 };
    }
    setZoom(targetZoom);
    setPan(targetPan);
    panRef.current = targetPan;
    zoomRef.current = targetZoom;
    updateTransformDirect(targetPan, targetZoom, true);
  };

  const handleStepZoom = (delta: number) => {
    const nextZ = Math.min(2.4, Math.max(0.3, Number((zoomRef.current + delta).toFixed(2))));
    setZoom(nextZ);
    zoomRef.current = nextZ;
    updateTransformDirect(panRef.current, nextZ, true);
  };

  const toggleCollapse = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedNodeIds(new Set());
  };

  const handleCollapseAll = () => {
    const allCategoryIds = new Set<string>();
    rootNode.children?.forEach((cat) => {
      allCategoryIds.add(cat.id);
    });
    setCollapsedNodeIds(allCategoryIds);
  };

  // Agent random style generator (infinite combinations)
  const handleRandomizeStyle = () => {
    const next = generateNextMindMapStyle(currentConfig);
    setCurrentConfig(next);
    setStyleGenerationCount((c) => c + 1);
  };

  const handleResetToAgentRecommended = () => {
    const rec = inferAgentMindMapStyle(query, rootNode);
    setCurrentConfig(rec);
  };

  // Check if dark mode is active in the document or passed via prop
  const isDark = propIsDark !== undefined
    ? propIsDark
    : typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  // Calculate Layout based on current topology and theme
  const { nodes, links, bounds, centerPoint } = useMemo(() => {
    return computeMindMapLayout(rootNode, currentConfig, collapsedNodeIds, isDark);
  }, [rootNode, currentConfig, collapsedNodeIds, isDark]);

  // Adjust pan when topology drastically changes
  useEffect(() => {
    let nextPan = { x: 60, y: 150 };
    let nextZoom = 0.95;
    if (currentConfig.topology === "radial" || currentConfig.topology === "galaxy_force") {
      nextPan = { x: -bounds.width / 2 + 500, y: -bounds.height / 2 + 380 };
      nextZoom = 0.85;
    } else if (currentConfig.topology === "bilateral") {
      nextPan = { x: -bounds.width / 2 + 500, y: -bounds.height / 2 + 350 };
      nextZoom = 0.9;
    } else if (currentConfig.topology === "org_chart") {
      nextPan = { x: 100, y: 50 };
      nextZoom = 0.95;
    }
    setPan(nextPan);
    setZoom(nextZoom);
    panRef.current = nextPan;
    zoomRef.current = nextZoom;
    updateTransformDirect(nextPan, nextZoom, true);
  }, [currentConfig.topology, bounds.width, bounds.height]);

  // Filter nodes matching keyword
  const highlightedNodeIds = useMemo(() => {
    if (!searchKeyword.trim()) return new Set<string>();
    const kw = searchKeyword.toLowerCase();
    const matches = new Set<string>();
    nodes.forEach((n) => {
      if (n.label.toLowerCase().includes(kw) || n.description?.toLowerCase().includes(kw)) {
        matches.add(n.id);
      }
    });
    return matches;
  }, [nodes, searchKeyword]);

  // Convert mindmap to markdown outline
  const generateMarkdownOutline = (node: MindMapNode, level = 0): string => {
    const indent = "  ".repeat(level);
    let str = `${indent}- **${node.label}**${node.description ? `: ${node.description}` : ""}\n`;
    if (node.children) {
      node.children.forEach((c) => {
        str += generateMarkdownOutline(c, level + 1);
      });
    }
    return str;
  };

  const handleCopyOutline = () => {
    const outline = `# ${query} - 知识架构导图大纲\n\n` + generateMarkdownOutline(rootNode);
    navigator.clipboard.writeText(outline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* 1. TOP AGENT ORCHESTRATION BANNER */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="w-7 h-7 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                Agent 架构排版：{currentConfig.agentLabel}
              </span>
              {styleGenerationCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 font-mono text-[10px]">
                  迭代 #{styleGenerationCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
              {currentConfig.agentReasoning}
            </p>
          </div>
        </div>

        {/* Quick Style Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRandomizeStyle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm hover:shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
            title="让 Agent 从无限拓扑与视觉组合中随机排列换一种新风格"
          >
            <Dices className="w-3.5 h-3.5 animate-spin-slow" />
            <span>Agent 灵感重排 🎲</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStylePicker(!showStylePicker)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              showStylePicker
                ? "bg-zinc-200 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100"
                : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>样式微调</span>
          </button>

          <button
            type="button"
            onClick={handleResetToAgentRecommended}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            title="恢复 Agent 初始根据语义推断的最佳样式"
          >
            <RotateCcw className="w-3 h-3" />
            <span>推荐复位</span>
          </button>
        </div>
      </div>

      {/* 2. STYLE PICKER EXPANDABLE DRAWER */}
      {showStylePicker && (
        <div className="p-4 rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 shadow-lg space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Topology Picker */}
            <div>
              <label className="font-semibold text-zinc-800 dark:text-zinc-200 block mb-2 flex items-center gap-1.5">
                <Workflow className="w-3.5 h-3.5 text-blue-500" />
                <span>拓扑排列架构 ({currentConfig.topology})</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "radial", label: "中心 360° 辐射" },
                  { id: "bilateral", label: "双翼对等平衡" },
                  { id: "horizontal", label: "经典横向树" },
                  { id: "org_chart", label: "自顶向下金字塔" },
                  { id: "timeline_flow", label: "演进时序波浪" },
                  { id: "galaxy_force", label: "引力星系图谱" }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        topology: item.id as MindMapTopology,
                        agentLabel: `${item.label} · 自定义模式`
                      }))
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                      currentConfig.topology === item.id
                        ? "bg-blue-500 text-white font-bold shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Theme Picker */}
            <div>
              <label className="font-semibold text-zinc-800 dark:text-zinc-200 block mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-500" />
                <span>视觉主题风格 ({currentConfig.theme})</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "cyber_neon", label: "赛博全息霓虹" },
                  { id: "aurora_glass", label: "极光微绒毛玻璃" },
                  { id: "cosmic_galaxy", label: "深空天体星轨" },
                  { id: "spectral_vibrant", label: "多光谱多彩渐变" },
                  { id: "obsidian_slate", label: "黑曜石黑金" },
                  { id: "nordic_clean", label: "北欧极简灰度" }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        theme: item.id as MindMapVisualTheme
                      }))
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                      currentConfig.theme === item.id
                        ? "bg-purple-600 text-white font-bold shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Link & Node Styles */}
            <div>
              <label className="font-semibold text-zinc-800 dark:text-zinc-200 block mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
                <span>连线动力学与节点</span>
              </label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "bezier", label: "贝塞尔平滑" },
                    { id: "orthogonal", label: "正交折线" },
                    { id: "pulse_stream", label: "脉冲光流" },
                    { id: "arc", label: "圆弧拱线" },
                    { id: "direct", label: "极简直连" }
                  ].map((link) => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() =>
                        setCurrentConfig((prev) => ({
                          ...prev,
                          linkStyle: link.id as MindMapLinkStyle
                        }))
                      }
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        currentConfig.linkStyle === link.id
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">外轮廓形态：</span>
                  <div className="flex gap-1">
                    {(["pill", "rounded-xl", "rounded-2xl", "square"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCurrentConfig((prev) => ({ ...prev, nodeRoundness: r }))}
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                          currentConfig.nodeRoundness === r
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TOOLBAR: VIEW TOGGLE, SEARCH, ZOOM & ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-[#1c1c1e] p-2.5 sm:p-3 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setViewMode("canvas")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === "canvas"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              交互式画布
            </button>
            <button
              onClick={() => setViewMode("outline")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === "outline"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              文本大纲视图
            </button>
          </div>

          {/* Node Search Filter */}
          {viewMode === "canvas" && (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="搜索导图节点..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 outline-hidden w-28 sm:w-36 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 transition-all"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2 text-zinc-400 hover:text-zinc-600 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <span className="hidden sm:inline-block text-[11px] text-zinc-400 dark:text-zinc-500">
            共 {nodes.length} 个知识节点
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {viewMode === "canvas" ? (
            <>
              {/* Expand / Collapse All */}
              <button
                type="button"
                onClick={handleExpandAll}
                className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs"
                title="展开全部节点"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs"
                title="折叠下级节点"
              >
                <FolderMinus className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStepZoom(0.15)}
                title="放大 (支持鼠标滚轮或双指缩放)"
                className="h-8 w-8 rounded-xl"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleStepZoom(-0.15)}
                title="缩小 (支持鼠标滚轮或双指缩放)"
                className="h-8 w-8 rounded-xl"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetZoom()}
                className="h-8 text-xs gap-1 rounded-xl"
              >
                <RotateCcw className="w-3 h-3" />
                <span>复位</span>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyOutline}
              className="h-8 text-xs gap-1.5 rounded-xl"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "已复制大纲" : "复制导图大纲"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4. MAIN CANVAS STAGE */}
      {viewMode === "canvas" ? (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative w-full ${canvasHeightClass} rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-[#fbfbfd] dark:bg-[#0c0d0e] overflow-hidden select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          } shadow-inner transition-colors`}
          style={{
            backgroundImage:
              currentConfig.theme === "cyber_neon"
                ? "linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px)"
                : currentConfig.theme === "cosmic_galaxy"
                ? "radial-gradient(circle at center, rgba(139, 92, 246, 0.08) 0%, transparent 70%), radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)"
                : "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: currentConfig.theme === "cyber_neon" ? "32px 32px" : "24px 24px",
            color: "rgba(120, 120, 120, 0.08)"
          }}
        >
          {/* Zoom Level Badge */}
          <div className="absolute bottom-3.5 left-3.5 z-10 px-2.5 py-1 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-500 shadow-xs flex items-center gap-1.5 pointer-events-none">
            <span>{Math.round(zoom * 100)}%</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-[10px] font-sans text-zinc-400 capitalize">{currentConfig.topology}</span>
          </div>

          {/* Interactive Guide Hint */}
          <div className="absolute top-3.5 left-3.5 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-[11px] text-zinc-500 shadow-xs pointer-events-none">
            <Compass className="w-3.5 h-3.5 text-zinc-400" />
            <span>平滑拖动画布 · 滚轮/触控板缩放平移 · 点击节点展开或查阅</span>
          </div>

          {/* Canvas Transform Viewport (Hardware accelerated GPU layer) */}
          <div
            ref={viewportRef}
            className="absolute inset-0 origin-top-left"
            style={{
              transform: `translate3d(${Math.round(pan.x)}px, ${Math.round(pan.y)}px, 0) scale(${zoom})`,
              transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d"
            }}
          >
            {/* SVG Connecting Links Layer */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              style={{ width: bounds.width + 400, height: bounds.height + 400 }}
            >
              <defs>
                {/* Neon Glow Filters */}
                <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {links.map((link, idx) => {
                const isPulse = currentConfig.linkStyle === "pulse_stream";
                return (
                  <g key={idx}>
                    {/* Shadow/Glow outline if active */}
                    {currentConfig.showGlow && (
                      <path
                        d={link.pathString}
                        fill="none"
                        stroke={link.color}
                        strokeWidth="3"
                        strokeOpacity="0.2"
                      />
                    )}
                    {/* Main stroke line */}
                    <path
                      d={link.pathString}
                      fill="none"
                      stroke={link.color}
                      strokeWidth={isPulse ? "2" : "1.8"}
                      strokeDasharray={isPulse ? "5 4" : undefined}
                      className={isPulse ? "animate-pulse" : ""}
                      strokeOpacity={currentConfig.theme === "cyber_neon" ? "0.85" : "0.55"}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes Layer */}
            {nodes.map((node) => {
              const isRoot = node.depth === 0;
              const isCategory = node.depth === 1;
              const isSelected = selectedNode?.id === node.id;
              const isHighlighted = highlightedNodeIds.has(node.id);

              // Determine border radius class based on style config
              const roundClass =
                currentConfig.nodeRoundness === "pill"
                  ? "rounded-3xl"
                  : currentConfig.nodeRoundness === "rounded-2xl"
                  ? "rounded-2xl"
                  : currentConfig.nodeRoundness === "square"
                  ? "rounded-md"
                  : "rounded-xl";

              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    if (hasMovedRef.current) return;
                    e.stopPropagation();
                    setSelectedNode(node.original);
                  }}
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px)`,
                    width: `${node.width}px`,
                    backgroundColor: node.colorScheme.bg,
                    borderColor: isHighlighted
                      ? "#ec4899"
                      : isSelected
                      ? "#3b82f6"
                      : node.colorScheme.border,
                    boxShadow: isHighlighted
                      ? "0 0 20px rgba(236, 72, 153, 0.6)"
                      : node.colorScheme.glow || "none"
                  }}
                  className={`absolute p-3 border transition-all cursor-pointer backdrop-blur-sm ${roundClass} ${
                    isRoot ? "font-bold shadow-md z-20" : isCategory ? "font-semibold z-10" : "text-xs z-0"
                  } ${
                    isSelected
                      ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-950 scale-105"
                      : "hover:scale-[1.03] active:scale-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isRoot && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                        )}
                        <span
                          className={`truncate block ${
                            isRoot ? "text-sm text-zinc-900 dark:text-zinc-50" : "text-xs font-medium"
                          }`}
                          style={{ color: isRoot ? undefined : node.colorScheme.text }}
                        >
                          {node.label}
                        </span>
                      </div>
                      {node.description && (
                        <p
                          className={`text-[11px] line-clamp-2 mt-0.5 leading-tight ${
                            isRoot ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {node.description}
                        </p>
                      )}
                    </div>

                    {/* Expand / Collapse Button if node has children */}
                    {node.hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => toggleCollapse(node.id, e)}
                        className="p-1 rounded-full text-xs shrink-0 transition-all bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                        title={node.isCollapsed ? "展开子节点" : "折叠子节点"}
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            node.isCollapsed ? "" : "rotate-90"
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 5. TEXT OUTLINE VIEW */
        <Card className="p-5 bg-white dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <div className="space-y-4 font-mono text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                📌 主题架构：{rootNode.label}
              </span>
              {rootNode.description && (
                <p className="text-xs text-zinc-500 mt-1">{rootNode.description}</p>
              )}
            </div>

            <div className="pl-4 space-y-4 border-l-2 border-zinc-200 dark:border-zinc-800">
              {rootNode.children?.map((cat) => (
                <div key={cat.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{cat.label}</span>
                    {cat.description && (
                      <span className="text-zinc-400 text-xs font-normal">({cat.description})</span>
                    )}
                  </div>

                  {cat.children && (
                    <div className="pl-5 space-y-1.5">
                      {cat.children.map((sub) => (
                        <div
                          key={sub.id}
                          className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80"
                        >
                          <span className="font-medium text-zinc-900 dark:text-zinc-200">• {sub.label}</span>
                          {sub.description && (
                            <p className="text-[11px] text-zinc-500 mt-0.5">{sub.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* 6. SELECTED NODE DETAILS INSPECTOR */}
      {selectedNode && (
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e] p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                节点详情
              </Badge>
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {selectedNode.label}
              </span>
            </div>
            {selectedNode.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                {selectedNode.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedNode(null)}
            className="text-xs text-zinc-500 self-end sm:self-auto rounded-xl"
          >
            关闭详情
          </Button>
        </div>
      )}
    </div>
  );
};
