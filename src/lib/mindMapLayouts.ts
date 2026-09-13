import { MindMapNode } from "../types.js";

export type MindMapTopology =
  | "radial"          // 中心环形 360° 放射
  | "bilateral"       // 双向平衡发散树 (左右双翼)
  | "horizontal"      // 经典横向右发散树
  | "org_chart"       // 自顶向下分层组织架构树
  | "galaxy_force"    // 知识星系网状轨道
  | "timeline_flow"   // 演进波浪流线
  | "fishbone";       // 因果鱼骨架构

export type MindMapVisualTheme =
  | "cyber_neon"      // 赛博全息霓虹
  | "aurora_glass"    // 极光毛玻璃微光
  | "cosmic_galaxy"   // 深空天体星盘
  | "obsidian_slate"  // 黑曜石黑白金极简
  | "spectral_vibrant"// 多光谱多彩渐变
  | "nordic_clean";   // 北欧极客无衬线

export type MindMapLinkStyle =
  | "bezier"          // 柔顺平滑贝塞尔曲线
  | "orthogonal"      // 高精正交直角走线
  | "pulse_stream"    // 脉冲能量光流 (虚线流动)
  | "arc"             // 优美圆弧拱线
  | "direct";         // 极简平直线

export interface CalculatedMindMapNode {
  id: string;
  label: string;
  description?: string;
  type?: string;
  depth: number;
  branchIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  colorScheme: {
    bg: string;
    border: string;
    text: string;
    accent: string;
    glow?: string;
  };
  original: MindMapNode;
}

export interface CalculatedMindMapLink {
  source: { x: number; y: number };
  target: { x: number; y: number };
  color: string;
  style: MindMapLinkStyle;
  pathString: string;
}

export interface MindMapStyleConfig {
  topology: MindMapTopology;
  theme: MindMapVisualTheme;
  linkStyle: MindMapLinkStyle;
  agentLabel: string;
  agentReasoning: string;
  nodeRoundness: "pill" | "round" | "soft" | "square";
  showGlow: boolean;
}

/**
 * 多分支调色板 —— 单色版。
 *
 * 原设计用 6 种色相（蓝/绿/紫/琥珀/粉/青）区分同级分支。
 * 单色约束下不再有可用色相，于是改用**明度分级**承担同样的"区分兄弟分支"职责：
 * 6 档从最亮的 #fafafa 递进到 #6e6e6e，相邻档位亮度差 ≈ 12%，肉眼可辨，
 * 且最暗档在浅色底、最亮档在深色底上都仍然可见。
 */
const BRANCH_PALETTES = [
  { accent: "#fafafa", border: "#fafafa", bg: "rgba(250, 250, 250, 0.10)", text: "#fafafa", glow: "rgba(250, 250, 250, 0.35)" }, // 灰阶 1（最亮）
  { accent: "#dedede", border: "#e5e5e5", bg: "rgba(222, 222, 222, 0.10)", text: "#ebebeb", glow: "rgba(222, 222, 222, 0.35)" }, // 灰阶 2
  { accent: "#c2c2c2", border: "#d0d0d0", bg: "rgba(194, 194, 194, 0.10)", text: "#d6d6d6", glow: "rgba(194, 194, 194, 0.35)" }, // 灰阶 3
  { accent: "#a6a6a6", border: "#b5b5b5", bg: "rgba(166, 166, 166, 0.10)", text: "#bfbfbf", glow: "rgba(166, 166, 166, 0.35)" }, // 灰阶 4
  { accent: "#8a8a8a", border: "#9a9a9a", bg: "rgba(138, 138, 138, 0.10)", text: "#a8a8a8", glow: "rgba(138, 138, 138, 0.35)" }, // 灰阶 5
  { accent: "#6e6e6e", border: "#7d7d7d", bg: "rgba(110, 110, 110, 0.10)", text: "#909090", glow: "rgba(110, 110, 110, 0.35)" }, // 灰阶 6（最暗）
];

// Determine node colors based on theme & branch
export function resolveNodeColor(
  theme: MindMapVisualTheme,
  depth: number,
  branchIndex: number,
  isDark = true
) {
  if (depth === 0) {
    if (theme === "cyber_neon") {
      return {
        bg: isDark ? "rgba(222, 222, 222, 0.2)" : "#f0f0f0",
        border: isDark ? "#dedede" : "#8a8a8a",
        text: isDark ? "#ffffff" : "#4d4d4d",
        accent: isDark ? "#dedede" : "#8a8a8a",
        glow: isDark ? "0 0 24px rgba(255, 255, 255, 0.5)" : "0 2px 12px rgba(0, 0, 0, 0.15)"
      };
    }
    if (theme === "cosmic_galaxy") {
      return {
        bg: isDark ? "rgba(194, 194, 194, 0.25)" : "#f0f0f0",
        border: isDark ? "#c2c2c2" : "#8a8a8a",
        text: isDark ? "#ffffff" : "#3d3d3d",
        accent: isDark ? "#c2c2c2" : "#8a8a8a",
        glow: isDark ? "0 0 28px rgba(255, 255, 255, 0.6)" : "0 2px 12px rgba(0, 0, 0, 0.15)"
      };
    }
    if (theme === "obsidian_slate") {
      return {
        bg: isDark ? "#27272a" : "#ffffff",
        border: isDark ? "#e4e4e7" : "#27272a",
        text: isDark ? "#ffffff" : "#18181b",
        accent: "#a3a3a3",
        glow: isDark ? "0 4px 16px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.06)"
      };
    }
    return {
      bg: "#ffffff",
      border: isDark ? "#ffffff" : "#8a8a8a",
      text: isDark ? "#09090b" : "#3d3d3d",
      accent: "#d4d4d4",
      glow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.15)" : "0 2px 12px rgba(0, 0, 0, 0.12)"
    };
  }

  const palette = BRANCH_PALETTES[branchIndex % BRANCH_PALETTES.length];

  switch (theme) {
    case "cyber_neon":
      return {
        bg: isDark ? "rgba(18, 18, 18, 0.85)" : "rgba(245, 245, 245, 0.95)",
        border: palette.border,
        text: isDark ? "#f5f5f5" : "#1a1a1a",
        accent: palette.accent,
        glow: `0 0 14px ${palette.glow}`
      };
    case "cosmic_galaxy":
      return {
        bg: isDark ? "rgba(18, 18, 18, 0.85)" : "rgba(245, 245, 245, 0.95)",
        border: palette.border,
        text: isDark ? "#f5f5f5" : "#1f1f1f",
        accent: palette.accent,
        glow: `0 0 16px ${palette.glow}`
      };
    case "aurora_glass":
      return {
        bg: isDark ? "rgba(30, 30, 34, 0.75)" : "rgba(255, 255, 255, 0.85)",
        border: palette.accent,
        text: isDark ? "#f4f4f5" : "#18181b",
        accent: palette.accent,
        glow: "0 8px 24px rgba(0,0,0,0.06)"
      };
    case "obsidian_slate":
      return {
        bg: isDark ? "rgba(24, 24, 24, 0.9)" : "rgba(250, 250, 250, 0.95)",
        border: isDark ? "#404040" : "#d4d4d4",
        text: isDark ? "#e5e5e5" : "#262626",
        accent: "#737373",
        glow: "none"
      };
    case "nordic_clean":
      return {
        bg: isDark ? "rgba(20, 20, 20, 0.9)" : "#ffffff",
        border: isDark ? "#262626" : "#e5e5e5",
        text: isDark ? "#f5f5f5" : "#171717",
        accent: "#a3a3a3",
        glow: "none"
      };
    case "spectral_vibrant":
    default:
      return {
        bg: isDark ? "rgba(24, 24, 28, 0.85)" : "rgba(255, 255, 255, 0.9)",
        border: palette.accent,
        text: isDark ? "#f4f4f5" : "#18181b",
        accent: palette.accent,
        glow: `0 2px 10px ${palette.glow}`
      };
  }
}

// Generate SVG connection path string based on linkStyle
export function buildPathString(
  source: { x: number; y: number },
  target: { x: number; y: number },
  style: MindMapLinkStyle,
  topology: MindMapTopology
): string {
  const { x: x1, y: y1 } = source;
  const { x: x2, y: y2 } = target;

  if (style === "direct") {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (style === "orthogonal") {
    if (topology === "org_chart") {
      const midY = (y1 + y2) / 2;
      return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
    }
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
  }

  if (style === "arc") {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dr = Math.sqrt(dx * dx + dy * dy) * 1.15;
    return `M ${x1} ${y1} A ${dr} ${dr} 0 0 1 ${x2} ${y2}`;
  }

  // Default: Smooth Bezier
  if (topology === "org_chart") {
    const dy = y2 - y1;
    return `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`;
  }

  if (topology === "radial" || topology === "galaxy_force") {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const cx = midX + (y2 - y1) * 0.15;
    const cy = midY - (x2 - x1) * 0.15;
    return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
  }

  const dx = x2 - x1;
  return `M ${x1} ${y1} C ${x1 + dx * 0.5} ${y1}, ${x2 - dx * 0.5} ${y2}, ${x2} ${y2}`;
}

// Intelligent agent inference for mindmap style based on query semantics
export function inferAgentMindMapStyle(
  query: string,
  rootNode: MindMapNode
): MindMapStyleConfig {
  const q = (query + " " + rootNode.label).toLowerCase();
  const childrenCount = rootNode.children?.length || 0;

  // Comparison query -> Bilateral Balanced Tree
  if (q.includes("vs") || q.includes("对比") || q.includes("差异") || q.includes("区别") || q.includes("优缺点")) {
    return {
      topology: "bilateral",
      theme: "spectral_vibrant",
      linkStyle: "bezier",
      agentLabel: "双翼对等分析树 (Bilateral Tree)",
      agentReasoning: "检测到对比型实体分析，采用左右对称平衡双翼展开，使两方维度的比对一目了然。",
      nodeRoundness: "round",
      showGlow: true
    };
  }

  // Timeline / Evolution / Process -> Timeline flow
  if (q.includes("历史") || q.includes("演进") || q.includes("历程") || q.includes("发展史") || q.includes("流程") || q.includes("路线图")) {
    return {
      topology: "timeline_flow",
      theme: "obsidian_slate",
      linkStyle: "orthogonal",
      agentLabel: "时间演进波浪图 (Evolution Flow)",
      agentReasoning: "语义识别为阶段与演进脉络，以时序流线架构呈现里程碑式知识递进。",
      nodeRoundness: "soft",
      showGlow: false
    };
  }

  // System architecture / Framework / Platform -> Radial or Org-chart
  if (q.includes("架构") || q.includes("体系") || q.includes("原理") || q.includes("组织") || q.includes("层级")) {
    return {
      topology: "org_chart",
      theme: "aurora_glass",
      linkStyle: "orthogonal",
      agentLabel: "层级金字塔架构 (Hierarchy Chart)",
      agentReasoning: "识别为顶层架构与系统分层，按严密父子继承关系自顶向下分级排布。",
      nodeRoundness: "round",
      showGlow: true
    };
  }

  // Tech brands, platforms, entertainment, gaming, multi-faceted -> Radial 360° or Galaxy
  if (childrenCount >= 4 || q.includes("bilibili") || q.includes("ai") || q.includes("开源") || q.includes("生态")) {
    return {
      topology: "radial",
      theme: "cyber_neon",
      linkStyle: "pulse_stream",
      agentLabel: "360° 中心全景星盘 (Radial Galaxy)",
      agentReasoning: `针对「${rootNode.label}」的多维度生态知识点（包含 ${childrenCount} 个核心分类），Agent 编排为中心辐射全景星盘，最大限度利用空间并凸显主从关联。`,
      nodeRoundness: "pill",
      showGlow: true
    };
  }

  // Fallback balanced standard
  return {
    topology: "horizontal",
    theme: "aurora_glass",
    linkStyle: "bezier",
    agentLabel: "逻辑渐进流线树 (Logic Tree)",
    agentReasoning: "采用经典高清晰度层次树展开，从左到右递进阐释知识脉络。",
    nodeRoundness: "round",
    showGlow: true
  };
}

// Procedural generator to provide endless variations
const ALL_TOPOLOGIES: MindMapTopology[] = ["radial", "bilateral", "horizontal", "org_chart", "galaxy_force", "timeline_flow", "fishbone"];
const ALL_THEMES: MindMapVisualTheme[] = ["cyber_neon", "aurora_glass", "cosmic_galaxy", "spectral_vibrant", "obsidian_slate", "nordic_clean"];
const ALL_LINKS: MindMapLinkStyle[] = ["bezier", "orthogonal", "pulse_stream", "arc", "direct"];
const ALL_SHAPES: ("pill" | "round" | "soft" | "square")[] = ["pill", "round", "soft", "square"];

export function generateNextMindMapStyle(currentConfig?: MindMapStyleConfig): MindMapStyleConfig {
  const topIndex = Math.floor(Math.random() * ALL_TOPOLOGIES.length);
  const themeIndex = Math.floor(Math.random() * ALL_THEMES.length);
  const linkIndex = Math.floor(Math.random() * ALL_LINKS.length);
  const shapeIndex = Math.floor(Math.random() * ALL_SHAPES.length);

  const topology = ALL_TOPOLOGIES[topIndex];
  const theme = ALL_THEMES[themeIndex];
  const linkStyle = ALL_LINKS[linkIndex];
  const nodeRoundness = ALL_SHAPES[shapeIndex];

  const topologyNames: Record<MindMapTopology, string> = {
    radial: "360° 中心多环辐射图",
    bilateral: "双翼对等平衡发散树",
    horizontal: "逻辑渐进横向树",
    org_chart: "自顶向下金字塔分层树",
    galaxy_force: "引力知识星系图谱",
    timeline_flow: "时序演进波浪流线",
    fishbone: "因果逻辑鱼骨架构"
  };

  const themeNames: Record<MindMapVisualTheme, string> = {
    cyber_neon: "赛博全息霓虹",
    aurora_glass: "极光微绒毛玻璃",
    cosmic_galaxy: "深空天体星轨",
    spectral_vibrant: "多光谱多彩渐变",
    obsidian_slate: "黑曜石高对比黑金",
    nordic_clean: "北欧极简灰度"
  };

  return {
    topology,
    theme,
    linkStyle,
    nodeRoundness,
    showGlow: Math.random() > 0.2,
    agentLabel: `${topologyNames[topology]} · ${themeNames[theme]}`,
    agentReasoning: `Agent 动态重新排列拓扑参数：应用 ${topologyNames[topology]} 空间算法，搭载 ${themeNames[theme]} 渲染引擎与 ${linkStyle} 动力学连线。`
  };
}

// Master Layout Computation Function
export function computeMindMapLayout(
  rootNode: MindMapNode,
  config: MindMapStyleConfig,
  collapsedNodeIds: Set<string>,
  isDark = true
): {
  nodes: CalculatedMindMapNode[];
  links: CalculatedMindMapLink[];
  bounds: { width: number; height: number };
  centerPoint: { x: number; y: number };
} {
  const calculatedNodes: CalculatedMindMapNode[] = [];
  const calculatedLinks: CalculatedMindMapLink[] = [];

  const topology = config.topology;
  const NODE_W = 210;
  const NODE_H = 68;

  // 1. TOPOLOGY: HORIZONTAL TREE (Left to Right)
  if (topology === "horizontal") {
    const HORIZONTAL_GAP = 90;
    const VERTICAL_GAP = 24;
    let currentY = 60;

    function layoutSubtree(node: MindMapNode, depth: number, branchIdx: number, parent?: CalculatedMindMapNode): CalculatedMindMapNode {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isCollapsed = collapsedNodeIds.has(node.id);

      const x = depth * (NODE_W + HORIZONTAL_GAP) + 80;
      let y = currentY;

      const childrenNodes: CalculatedMindMapNode[] = [];

      if (hasChildren && !isCollapsed) {
        node.children!.forEach((child, idx) => {
          const childBranch = depth === 0 ? idx : branchIdx;
          const childLayout = layoutSubtree(child, depth + 1, childBranch);
          childrenNodes.push(childLayout);
        });

        if (childrenNodes.length > 0) {
          const firstY = childrenNodes[0].y;
          const lastY = childrenNodes[childrenNodes.length - 1].y;
          y = (firstY + lastY) / 2;
        }
      } else {
        currentY += NODE_H + VERTICAL_GAP;
      }

      const colorScheme = resolveNodeColor(config.theme, depth, branchIdx, isDark);
      const flatNode: CalculatedMindMapNode = {
        id: node.id,
        label: node.label,
        description: node.description,
        type: node.type,
        depth,
        branchIndex: branchIdx,
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        parentId: parent?.id,
        hasChildren,
        isCollapsed,
        colorScheme,
        original: node
      };

      calculatedNodes.push(flatNode);

      if (childrenNodes.length > 0) {
        childrenNodes.forEach((child) => {
          const source = { x: flatNode.x + flatNode.width, y: flatNode.y + flatNode.height / 2 };
          const target = { x: child.x, y: child.y + child.height / 2 };
          calculatedLinks.push({
            source,
            target,
            color: child.colorScheme.accent,
            style: config.linkStyle,
            pathString: buildPathString(source, target, config.linkStyle, topology)
          });
        });
      }

      return flatNode;
    }

    layoutSubtree(rootNode, 0, 0);

    let maxX = 800;
    let maxY = 600;
    calculatedNodes.forEach((n) => {
      maxX = Math.max(maxX, n.x + n.width + 120);
      maxY = Math.max(maxY, n.y + n.height + 120);
    });

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      bounds: { width: maxX, height: maxY },
      centerPoint: { x: 50, y: 150 }
    };
  }

  // 2. TOPOLOGY: BILATERAL TREE (Dual wings: left & right balanced)
  if (topology === "bilateral") {
    const H_GAP = 95;
    const V_GAP = 26;
    const centerX = 800;
    const centerY = 500;

    const rootColor = resolveNodeColor(config.theme, 0, 0, isDark);
    const rootCalculated: CalculatedMindMapNode = {
      id: rootNode.id,
      label: rootNode.label,
      description: rootNode.description,
      depth: 0,
      branchIndex: 0,
      x: centerX - NODE_W / 2,
      y: centerY - NODE_H / 2,
      width: NODE_W,
      height: NODE_H,
      hasChildren: Boolean(rootNode.children && rootNode.children.length > 0),
      isCollapsed: collapsedNodeIds.has(rootNode.id),
      colorScheme: rootColor,
      original: rootNode
    };
    calculatedNodes.push(rootCalculated);

    const children = rootNode.children || [];
    const rightChildren: MindMapNode[] = [];
    const leftChildren: MindMapNode[] = [];

    children.forEach((c, idx) => {
      if (idx % 2 === 0) rightChildren.push(c);
      else leftChildren.push(c);
    });

    // Layout right wing
    let rightY = centerY - (rightChildren.length * (NODE_H + V_GAP)) / 2;
    function layoutRightSubtree(node: MindMapNode, depth: number, branchIdx: number, parentX: number, parentY: number) {
      const isCollapsed = collapsedNodeIds.has(node.id);
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const x = parentX + NODE_W + H_GAP;
      let y = rightY;

      const subCalculated: CalculatedMindMapNode[] = [];
      if (hasChildren && !isCollapsed) {
        node.children!.forEach((child) => {
          layoutRightSubtree(child, depth + 1, branchIdx, x, y);
        });
      } else {
        rightY += NODE_H + V_GAP;
      }

      const color = resolveNodeColor(config.theme, depth, branchIdx, isDark);
      const flatNode: CalculatedMindMapNode = {
        id: node.id,
        label: node.label,
        description: node.description,
        depth,
        branchIndex: branchIdx,
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        hasChildren,
        isCollapsed,
        colorScheme: color,
        original: node
      };
      calculatedNodes.push(flatNode);

      const source = { x: parentX + NODE_W, y: parentY + NODE_H / 2 };
      const target = { x: flatNode.x, y: flatNode.y + flatNode.height / 2 };
      calculatedLinks.push({
        source,
        target,
        color: color.accent,
        style: config.linkStyle,
        pathString: buildPathString(source, target, config.linkStyle, "horizontal")
      });
    }

    rightChildren.forEach((child, idx) => {
      layoutRightSubtree(child, 1, idx * 2, rootCalculated.x, rootCalculated.y);
    });

    // Layout left wing
    let leftY = centerY - (leftChildren.length * (NODE_H + V_GAP)) / 2;
    function layoutLeftSubtree(node: MindMapNode, depth: number, branchIdx: number, parentX: number, parentY: number) {
      const isCollapsed = collapsedNodeIds.has(node.id);
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const x = parentX - NODE_W - H_GAP;
      let y = leftY;

      if (hasChildren && !isCollapsed) {
        node.children!.forEach((child) => {
          layoutLeftSubtree(child, depth + 1, branchIdx, x, y);
        });
      } else {
        leftY += NODE_H + V_GAP;
      }

      const color = resolveNodeColor(config.theme, depth, branchIdx, isDark);
      const flatNode: CalculatedMindMapNode = {
        id: node.id,
        label: node.label,
        description: node.description,
        depth,
        branchIndex: branchIdx,
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        hasChildren,
        isCollapsed,
        colorScheme: color,
        original: node
      };
      calculatedNodes.push(flatNode);

      const source = { x: parentX, y: parentY + NODE_H / 2 };
      const target = { x: flatNode.x + flatNode.width, y: flatNode.y + flatNode.height / 2 };
      calculatedLinks.push({
        source,
        target,
        color: color.accent,
        style: config.linkStyle,
        pathString: buildPathString(source, target, config.linkStyle, "horizontal")
      });
    }

    leftChildren.forEach((child, idx) => {
      layoutLeftSubtree(child, 1, idx * 2 + 1, rootCalculated.x, rootCalculated.y);
    });

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      bounds: { width: 1700, height: 1100 },
      centerPoint: { x: centerX - 300, y: centerY - 250 }
    };
  }

  // 3. TOPOLOGY: RADIAL (360° Circular panoramic layout)
  if (topology === "radial" || topology === "galaxy_force") {
    const centerX = 800;
    const centerY = 650;
    const RADIUS_L1 = 290;
    const RADIUS_L2 = 530;

    const rootColor = resolveNodeColor(config.theme, 0, 0, isDark);
    const rootCalculated: CalculatedMindMapNode = {
      id: rootNode.id,
      label: rootNode.label,
      description: rootNode.description,
      depth: 0,
      branchIndex: 0,
      x: centerX - NODE_W / 2,
      y: centerY - NODE_H / 2,
      width: NODE_W,
      height: NODE_H,
      hasChildren: Boolean(rootNode.children && rootNode.children.length > 0),
      isCollapsed: collapsedNodeIds.has(rootNode.id),
      colorScheme: rootColor,
      original: rootNode
    };
    calculatedNodes.push(rootCalculated);

    const categories = rootNode.children || [];
    const totalCategories = categories.length;

    categories.forEach((cat, catIdx) => {
      const angle = (catIdx / totalCategories) * 2 * Math.PI - Math.PI / 2;
      const catX = centerX + Math.cos(angle) * RADIUS_L1 - NODE_W / 2;
      const catY = centerY + Math.sin(angle) * RADIUS_L1 - NODE_H / 2;

      const isCatCollapsed = collapsedNodeIds.has(cat.id);
      const hasChildren = Boolean(cat.children && cat.children.length > 0);
      const catColor = resolveNodeColor(config.theme, 1, catIdx, isDark);

      const catCalculated: CalculatedMindMapNode = {
        id: cat.id,
        label: cat.label,
        description: cat.description,
        depth: 1,
        branchIndex: catIdx,
        x: catX,
        y: catY,
        width: NODE_W,
        height: NODE_H,
        hasChildren,
        isCollapsed: isCatCollapsed,
        colorScheme: catColor,
        original: cat
      };
      calculatedNodes.push(catCalculated);

      // Link from Root to Category
      const source = { x: centerX, y: centerY };
      const target = { x: catX + NODE_W / 2, y: catY + NODE_H / 2 };
      calculatedLinks.push({
        source,
        target,
        color: catColor.accent,
        style: config.linkStyle,
        pathString: buildPathString(source, target, config.linkStyle, "radial")
      });

      // L2 children radially arranged around their category arc
      if (hasChildren && !isCatCollapsed) {
        const subCount = cat.children!.length;
        const arcSpread = (2 * Math.PI / totalCategories) * 0.85;

        cat.children!.forEach((sub, subIdx) => {
          const subAngle = angle - arcSpread / 2 + (subIdx / Math.max(1, subCount - 1)) * arcSpread;
          const subX = centerX + Math.cos(subAngle) * RADIUS_L2 - NODE_W / 2;
          const subY = centerY + Math.sin(subAngle) * RADIUS_L2 - NODE_H / 2;

          const subColor = resolveNodeColor(config.theme, 2, catIdx, isDark);
          const subCalculated: CalculatedMindMapNode = {
            id: sub.id,
            label: sub.label,
            description: sub.description,
            depth: 2,
            branchIndex: catIdx,
            x: subX,
            y: subY,
            width: NODE_W,
            height: NODE_H,
            hasChildren: false,
            isCollapsed: false,
            colorScheme: subColor,
            original: sub
          };
          calculatedNodes.push(subCalculated);

          const subSource = { x: catX + NODE_W / 2, y: catY + NODE_H / 2 };
          const subTarget = { x: subX + NODE_W / 2, y: subY + NODE_H / 2 };
          calculatedLinks.push({
            source: subSource,
            target: subTarget,
            color: subColor.accent,
            style: config.linkStyle,
            pathString: buildPathString(subSource, subTarget, config.linkStyle, "radial")
          });
        });
      }
    });

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      bounds: { width: 1700, height: 1400 },
      centerPoint: { x: centerX - 250, y: centerY - 250 }
    };
  }

  // 4. TOPOLOGY: ORG CHART (Top-Down Hierarchical Pyramid)
  if (topology === "org_chart" || topology === "fishbone") {
    const H_GAP = 30;
    const V_GAP = 90;
    let currentX = 80;

    function layoutSubtree(node: MindMapNode, depth: number, branchIdx: number): CalculatedMindMapNode {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isCollapsed = collapsedNodeIds.has(node.id);
      const y = depth * (NODE_H + V_GAP) + 60;
      let x = currentX;

      const childrenNodes: CalculatedMindMapNode[] = [];

      if (hasChildren && !isCollapsed) {
        node.children!.forEach((child, idx) => {
          const childBranch = depth === 0 ? idx : branchIdx;
          const childLayout = layoutSubtree(child, depth + 1, childBranch);
          childrenNodes.push(childLayout);
        });

        if (childrenNodes.length > 0) {
          const firstX = childrenNodes[0].x;
          const lastX = childrenNodes[childrenNodes.length - 1].x;
          x = (firstX + lastX) / 2;
        }
      } else {
        currentX += NODE_W + H_GAP;
      }

      const color = resolveNodeColor(config.theme, depth, branchIdx, isDark);
      const flatNode: CalculatedMindMapNode = {
        id: node.id,
        label: node.label,
        description: node.description,
        depth,
        branchIndex: branchIdx,
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        hasChildren,
        isCollapsed,
        colorScheme: color,
        original: node
      };

      calculatedNodes.push(flatNode);

      if (childrenNodes.length > 0) {
        childrenNodes.forEach((child) => {
          const source = { x: flatNode.x + flatNode.width / 2, y: flatNode.y + flatNode.height };
          const target = { x: child.x + child.width / 2, y: child.y };
          calculatedLinks.push({
            source,
            target,
            color: child.colorScheme.accent,
            style: config.linkStyle,
            pathString: buildPathString(source, target, config.linkStyle, "org_chart")
          });
        });
      }

      return flatNode;
    }

    layoutSubtree(rootNode, 0, 0);

    let maxX = 900;
    let maxY = 700;
    calculatedNodes.forEach((n) => {
      maxX = Math.max(maxX, n.x + n.width + 100);
      maxY = Math.max(maxY, n.y + n.height + 100);
    });

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      bounds: { width: maxX, height: maxY },
      centerPoint: { x: 50, y: 50 }
    };
  }

  // 5. TOPOLOGY: TIMELINE FLOW (Alternating peaks & valleys along a central wave)
  if (topology === "timeline_flow") {
    const categories = rootNode.children || [];
    const stepX = 280;
    const baseY = 400;

    const rootColor = resolveNodeColor(config.theme, 0, 0, isDark);
    const rootCalculated: CalculatedMindMapNode = {
      id: rootNode.id,
      label: rootNode.label,
      description: rootNode.description,
      depth: 0,
      branchIndex: 0,
      x: 80,
      y: baseY - NODE_H / 2,
      width: NODE_W,
      height: NODE_H,
      hasChildren: categories.length > 0,
      isCollapsed: collapsedNodeIds.has(rootNode.id),
      colorScheme: rootColor,
      original: rootNode
    };
    calculatedNodes.push(rootCalculated);

    categories.forEach((cat, idx) => {
      const isAbove = idx % 2 === 0;
      const catX = 80 + (idx + 1) * stepX;
      const catY = isAbove ? baseY - 160 : baseY + 100;

      const catColor = resolveNodeColor(config.theme, 1, idx, isDark);
      const isCatCollapsed = collapsedNodeIds.has(cat.id);
      const hasChildren = Boolean(cat.children && cat.children.length > 0);

      const catCalculated: CalculatedMindMapNode = {
        id: cat.id,
        label: cat.label,
        description: cat.description,
        depth: 1,
        branchIndex: idx,
        x: catX,
        y: catY,
        width: NODE_W,
        height: NODE_H,
        hasChildren,
        isCollapsed: isCatCollapsed,
        colorScheme: catColor,
        original: cat
      };
      calculatedNodes.push(catCalculated);

      // Link from root / previous timeline milestone
      const source = idx === 0 
        ? { x: rootCalculated.x + rootCalculated.width, y: rootCalculated.y + NODE_H / 2 }
        : { x: catX - stepX + NODE_W, y: isAbove ? baseY + 100 + NODE_H / 2 : baseY - 160 + NODE_H / 2 };
      const target = { x: catX, y: catY + NODE_H / 2 };
      calculatedLinks.push({
        source,
        target,
        color: catColor.accent,
        style: config.linkStyle,
        pathString: buildPathString(source, target, config.linkStyle, "horizontal")
      });

      // Child details vertically extended
      if (hasChildren && !isCatCollapsed) {
        cat.children!.forEach((sub, subIdx) => {
          const subY = isAbove ? catY - (subIdx + 1) * (NODE_H + 20) : catY + (subIdx + 1) * (NODE_H + 20);
          const subColor = resolveNodeColor(config.theme, 2, idx, isDark);

          const subCalculated: CalculatedMindMapNode = {
            id: sub.id,
            label: sub.label,
            description: sub.description,
            depth: 2,
            branchIndex: idx,
            x: catX,
            y: subY,
            width: NODE_W,
            height: NODE_H,
            hasChildren: false,
            isCollapsed: false,
            colorScheme: subColor,
            original: sub
          };
          calculatedNodes.push(subCalculated);

          const subSource = { x: catX + NODE_W / 2, y: isAbove ? catY : catY + NODE_H };
          const subTarget = { x: catX + NODE_W / 2, y: isAbove ? subY + NODE_H : subY };
          calculatedLinks.push({
            source: subSource,
            target: subTarget,
            color: subColor.accent,
            style: config.linkStyle,
            pathString: buildPathString(subSource, subTarget, config.linkStyle, "org_chart")
          });
        });
      }
    });

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      bounds: { width: Math.max(1200, (categories.length + 2) * stepX), height: 1100 },
      centerPoint: { x: 50, y: 150 }
    };
  }

  // Default fallback
  return {
    nodes: calculatedNodes,
    links: calculatedLinks,
    bounds: { width: 1200, height: 800 },
    centerPoint: { x: 50, y: 50 }
  };
}
