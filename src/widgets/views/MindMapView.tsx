import React, { useState, useRef, useMemo, useEffect } from "react";
import { MindMapNode } from "../../types.js";
import { Card } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Badge } from "../../components/ui/badge.js";
import { Input } from "../../components/ui/input.js";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
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
} from "../../lib/mindMapLayouts.js";

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
      <div className="p-3 sm:p-3.5 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="w-7 h-7 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">
                Agent 架构排版：{currentConfig.agentLabel}
              </span>
              {styleGenerationCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-xs">
                  迭代 #{styleGenerationCount}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {currentConfig.agentReasoning}
            </p>
          </div>
        </div>

        {/* Quick Style Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={handleRandomizeStyle}
            title="让 Agent 从无限拓扑与视觉组合中随机排列换一种新风格"
          >
            <Dices className="animate-spin-slow" />
            <span>Agent 灵感重排 🎲</span>
          </Button>

          <Button
            type="button"
            variant={showStylePicker ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowStylePicker(!showStylePicker)}
          >
            <Palette />
            <span>样式微调</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToAgentRecommended}
            className="hidden sm:inline-flex text-muted-foreground"
            title="恢复 Agent 初始根据语义推断的最佳样式"
          >
            <RotateCcw />
            <span>推荐复位</span>
          </Button>
        </div>
      </div>

      {/* 2. STYLE PICKER EXPANDABLE DRAWER */}
      {showStylePicker && (
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Topology Picker */}
            <div>
              <label className="font-semibold text-foreground block mb-2 flex items-center gap-1.5">
                <Workflow className="text-muted-foreground" />
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
                  <Button
                    key={item.id}
                    type="button"
                    variant={currentConfig.topology === item.id ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        topology: item.id as MindMapTopology,
                        agentLabel: `${item.label} · 自定义模式`
                      }))
                    }
                    className="justify-start text-xs font-medium"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Visual Theme Picker */}
            <div>
              <label className="font-semibold text-foreground block mb-2 flex items-center gap-1.5">
                <Palette className="text-muted-foreground" />
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
                  <Button
                    key={item.id}
                    type="button"
                    variant={currentConfig.theme === item.id ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        theme: item.id as MindMapVisualTheme
                      }))
                    }
                    className="justify-start text-xs font-medium"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Link & Node Styles */}
            <div>
              <label className="font-semibold text-foreground block mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="text-muted-foreground" />
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
                    <Button
                      key={link.id}
                      type="button"
                      variant={currentConfig.linkStyle === link.id ? "default" : "outline"}
                      size="xs"
                      onClick={() =>
                        setCurrentConfig((prev) => ({
                          ...prev,
                          linkStyle: link.id as MindMapLinkStyle
                        }))
                      }
                    >
                      {link.label}
                    </Button>
                  ))}
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">外轮廓形态：</span>
                  <div className="flex gap-1">
                    {(["pill", "round", "soft", "square"] as const).map((r) => (
                      <Button
                        key={r}
                        type="button"
                        variant={currentConfig.nodeRoundness === r ? "default" : "outline"}
                        size="xs"
                        onClick={() => setCurrentConfig((prev) => ({ ...prev, nodeRoundness: r }))}
                        className="font-mono uppercase text-xs"
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TOOLBAR: VIEW TOGGLE, SEARCH, ZOOM & ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-card p-2.5 sm:p-3 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "canvas" | "outline")}>
            <TabsList>
              <TabsTrigger value="canvas">交互式画布</TabsTrigger>
              <TabsTrigger value="outline">文本大纲视图</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Node Search Filter */}
          {viewMode === "canvas" && (
            <div className="relative flex items-center">
              <Search className="size-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
              <Input
                type="text"
                placeholder="搜索导图节点..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-8 pr-6 h-8 w-28 sm:w-36 text-xs bg-muted/60 border-transparent"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <span className="hidden sm:inline-block text-xs text-muted-foreground">
            共 {nodes.length} 个知识节点
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {viewMode === "canvas" ? (
            <>
              {/* Expand / Collapse All */}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handleExpandAll}
                title="展开全部节点"
              >
                <FolderOpen />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handleCollapseAll}
                title="折叠下级节点"
              >
                <FolderMinus />
              </Button>

              <div className="w-px h-4 bg-border mx-1" />

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => handleStepZoom(0.15)}
                title="放大 (支持鼠标滚轮或双指缩放)"
              >
                <ZoomIn />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => handleStepZoom(-0.15)}
                title="缩小 (支持鼠标滚轮或双指缩放)"
              >
                <ZoomOut />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetZoom()}
              >
                <RotateCcw />
                <span>复位</span>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyOutline}
            >
              {copied ? <Check className="text-foreground" /> : <Copy />}
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
          className={`relative w-full ${canvasHeightClass} rounded-xl border border-border bg-background overflow-hidden select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          } shadow-inner transition-colors`}
          style={{
            backgroundImage:
              currentConfig.theme === "cyber_neon"
                ? "linear-gradient(rgba(200, 200, 200, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(200, 200, 200, 0.05) 1px, transparent 1px)"
                : currentConfig.theme === "cosmic_galaxy"
                ? "radial-gradient(circle at center, rgba(200, 200, 200, 0.08) 0%, transparent 70%), radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)"
                : "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: currentConfig.theme === "cyber_neon" ? "32px 32px" : "24px 24px",
            color: "rgba(120, 120, 120, 0.08)"
          }}
        >
          {/* Zoom Level Badge */}
          <div className="absolute bottom-3.5 left-3.5 z-10 px-2.5 py-1 bg-card/85 backdrop-blur-md border border-border rounded-lg text-xs font-mono text-muted-foreground shadow-sm flex items-center gap-1.5 pointer-events-none">
            <span>{Math.round(zoom * 100)}%</span>
            <span className="text-border">·</span>
            <span className="text-xs font-sans text-muted-foreground capitalize">{currentConfig.topology}</span>
          </div>

          {/* Interactive Guide Hint */}
          <div className="absolute top-3.5 left-3.5 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 bg-card/80 backdrop-blur-md border border-border rounded-lg text-xs text-muted-foreground shadow-sm pointer-events-none">
            <Compass className="text-muted-foreground" />
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
                  ? "rounded-full"
                  : currentConfig.nodeRoundness === "soft"
                  ? "rounded-xl"
                  : currentConfig.nodeRoundness === "square"
                  ? "rounded-md"
                  : "rounded-lg";

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
                      ? "hsl(var(--foreground))"
                      : isSelected
                      ? "hsl(var(--muted-foreground))"
                      : node.colorScheme.border,
                    boxShadow: isHighlighted
                      ? "0 0 20px hsl(var(--foreground) / 0.3)"
                      : node.colorScheme.glow || "none"
                  }}
                  className={`absolute p-3 border transition-all cursor-pointer backdrop-blur-sm ${roundClass} ${
                    isRoot ? "font-bold shadow-md z-20" : isCategory ? "font-semibold z-10" : "text-xs z-0"
                  } ${
                    isSelected
                      ? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-background scale-105"
                      : "hover:scale-[1.03] active:scale-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isRoot && (
                          <span className="w-2 h-2 rounded-full bg-foreground animate-pulse shrink-0" />
                        )}
                        <span
                          className={`truncate block ${
                            isRoot ? "text-sm text-foreground" : "text-xs font-medium"
                          }`}
                          style={{ color: isRoot ? undefined : node.colorScheme.text }}
                        >
                          {node.label}
                        </span>
                      </div>
                      {node.description && (
                        <p
                          className="text-xs line-clamp-2 mt-0.5 leading-tight text-muted-foreground"
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
                        className="p-1 rounded-full text-xs shrink-0 transition-all bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground cursor-pointer"
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
        <Card className="p-5 rounded-xl">
          <div className="space-y-4 font-mono text-xs sm:text-sm text-foreground leading-relaxed">
            <div className="p-3.5 bg-muted/40 rounded-lg border border-border">
              <span className="font-bold text-base text-foreground">
                📌 主题架构：{rootNode.label}
              </span>
              {rootNode.description && (
                <p className="text-xs text-muted-foreground mt-1">{rootNode.description}</p>
              )}
            </div>

            <div className="pl-4 space-y-4 border-l-2 border-border">
              {rootNode.children?.map((cat) => (
                <div key={cat.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-foreground/40"></span>
                    <span className="font-semibold text-foreground">{cat.label}</span>
                    {cat.description && (
                      <span className="text-muted-foreground text-xs font-normal">({cat.description})</span>
                    )}
                  </div>

                  {cat.children && (
                    <div className="pl-5 space-y-1.5">
                      {cat.children.map((sub) => (
                        <div
                          key={sub.id}
                          className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border"
                        >
                          <span className="font-medium text-foreground">• {sub.label}</span>
                          {sub.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{sub.description}</p>
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
        <div className="rounded-xl border border-border bg-card p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                节点详情
              </Badge>
              <span className="font-bold text-sm text-foreground">
                {selectedNode.label}
              </span>
            </div>
            {selectedNode.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {selectedNode.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedNode(null)}
            className="text-xs text-muted-foreground self-end sm:self-auto"
          >
            关闭详情
          </Button>
        </div>
      )}
    </div>
  );
};
