import React from "react";
import { SearchSynthesisResult, ResultWidgetKey } from "../../types.js";
import type { TileWidth } from "../../lib/tileLayoutEngine.js";

// ResultWidgetKey 是注册中心对外契约的一部分（registry.get / has / unregister 的入参类型），
// 必须一并转发导出，否则 registry.tsx 的具名导入无法解析（TS2459）。
export type { ResultWidgetKey };

export type WidgetCategoryType = "synthesis" | "analysis" | "action" | "portal" | "custom" | "official" | "remote";

/**
 * Agent 提示词与实用性配置契约 (Widget Agent Prompt Hint & Practicality Profile)
 * 供 LLM Agent 结合用户搜索词、意图与信源数据特征，智能研判并选取实用性最高的组件
 */
export interface WidgetAgentPromptHint {
  /** 核心功能与呈现形式概述 */
  functionality: string;
  /** 最适用的检索意图与场景描述 */
  bestFor: string[];
  /** 要求检索结果或底层数据具备的特征（例如包含版本号、官方网址、步骤列表、对比维度等） */
  dataRequirements?: string[];
  /** Agent 选取该组件的实用性启发式准则 (Practicality Heuristics) */
  selectionHeuristics: string;
  /** 推荐的触发关键词或意图标签 */
  triggerKeywords?: string[];
  /** 不推荐选取的反模式或互斥场景 */
  antiPatterns?: string[];
  /** 是否允许 Agent 自主选取此组件 */
  selectable?: boolean;
}

/**
 * 结构化声明式组件树节点 (Declarative Component Tree Nodes)
 * Agent 输出纯 JSON，杜绝 AI 输出不可控 HTML/JSX 带来的 XSS 隐患与样式污染
 */
export type WidgetSchemaNode =
  | {
      type: "text";
      text: string;
      variant?: "title" | "subtitle" | "body" | "caption" | "code";
      color?: string;
    }
  | {
      type: "metric";
      label: string;
      value: string | number;
      trend?: string;
      unit?: string;
      icon?: string;
    }
  | {
      type: "badge";
      label: string;
      variant?: "blue" | "emerald" | "amber" | "rose" | "zinc" | "violet";
      icon?: string;
    }
  | {
      type: "button";
      label: string;
      action: string;
      payload?: any;
      variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
      icon?: string;
    }
  | {
      type: "kv_list";
      items: Array<{ key: string; val: string; copyable?: boolean }>;
    }
  | {
      type: "checklist";
      items: Array<{ id: string; text: string; done?: boolean }>;
    }
  | {
      type: "timeline";
      events: Array<{ time?: string; title: string; desc?: string; status?: "completed" | "current" | "pending" }>;
    }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    }
  | {
      type: "code";
      code: string;
      language?: string;
      copyable?: boolean;
    }
  | {
      type: "link";
      label: string;
      url: string;
      isExternal?: boolean;
    }
  | {
      type: "progress";
      value: number;
      max?: number;
      label?: string;
    }
  | {
      type: "tags";
      items: string[];
    };

/**
 * 声明式 Widget 结构描述 (Widget Schema)
 * Agent Planner 和 CardForge 直接生成的标准组件描述
 */
export interface WidgetSchema {
  type: "widget";
  id: string;
  name: string;
  version?: string;
  size: TileWidth;
  layout: "card" | "dashboard" | "split" | "list" | "matrix";
  themeColor?: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
  iconName?: string;
  description?: string;
  components: WidgetSchemaNode[];
}

/**
 * 隔离受限的组件运行时上下文环境 (Sandboxed Context & API Bridge)
 * 仅暴露安全的、受控的沙箱操作，杜绝直连 window / document / eval
 */
export interface WidgetContext<TData = any> {
  // 注入的数据输入源
  data: TData;
  activeResult?: SearchSynthesisResult;
  
  // 空间规格信息
  size: TileWidth;
  isCompact: boolean;
  
  // 局域响应式 State 管理
  state: Record<string, any>;
  setState: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  
  // 动作调度总线
  actions: Record<string, (payload?: any) => void>;
  
  // 宿主程序桥接能力
  onResize?: (nextSize: TileWidth) => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
  
  // Windows Phone Live Tile 3D 双面翻转支持
  isFlipped?: boolean;
  flipTile?: () => void;

  // 隔离命名空间的存储服务
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
}

/**
 * 纯声明式磁贴原子描述符 (Declarative Tile Schema Descriptor)
 * 供 Agent 纯 JSON 输出或外部 JS 模块返回
 */
export type TileAtomNode =
  | {
      type: "text";
      value: string | number;
      variant?: "metric" | "title" | "subtitle" | "body" | "caption" | "code" | "badge";
      color?: string;
    }
  | {
      type: "icon";
      value: string;
      size?: number;
      color?: string;
    }
  | {
      type: "metric";
      label: string;
      value: string | number;
      trend?: string;
      unit?: string;
      icon?: string;
    }
  | {
      type: "progress";
      value: number;
      max?: number;
      label?: string;
      color?: string;
    }
  | {
      type: "chart";
      chartType?: "sparkline" | "bar";
      data: number[];
      labels?: string[];
      color?: string;
    }
  | {
      type: "button";
      label: string;
      action: string;
      payload?: any;
      variant?: "primary" | "secondary" | "outline" | "ghost";
      icon?: string;
    }
  | {
      type: "list";
      items: Array<{
        title: string;
        subtitle?: string;
        badge?: string;
        action?: string;
        payload?: any;
        url?: string;
      }>;
    }
  | {
      type: "image";
      url: string;
      alt?: string;
      aspectRatio?: string;
      overlay?: boolean;
    };

export interface TileSchemaDescriptor {
  type: "tile";
  title?: string;
  subtitle?: string;
  background?: string;
  accentColor?: string;
  liveBadge?: string | number;
  children: TileAtomNode[];
}

/**
 * 磁贴主题配置 (Windows Phone Accent + iOS Glassmorphism)
 */
export interface TileThemeConfig {
  accentColor?: string; // 磁贴点缀色 (HEX / Tailwind)
  gradient?: string;    // 背景渐变
  accentBg?: string;    // 强调浅色底
  liveBadge?: string | number; // 动态徽标/数字
  flipAnimation?: "3d-flip" | "slide" | "fade";
}

/**
 * 标准化 JS Widget 插件模块 (Widget Plugin Module)
 * 每个官方组件或 AI 动态生成的组件均遵从本接口标准
 */
export interface WidgetModule<TData = any> {
  id: string | ResultWidgetKey;
  name: string;
  version: string;
  description?: string;
  category?: WidgetCategoryType;
  /** 语义与功能标签列表 (Tags)，如 ["AI回答", "全网总结", "深度要点"]，供 Agent 结合检索内容智能选取 */
  tags?: string[];
  /** Agent 实用性提示词与底层属性定义 */
  agentHint?: WidgetAgentPromptHint;
  icon?: React.ComponentType<{ className?: string }> | string;
  
  // 尺寸契约：一律使用「磁贴宽度 TileWidth」口径 —— 25 / 50 / 75 / 100 (%)
  // 对应 12 栅格中的 3 / 6 / 9 / 12 列。全链路仅此一套宽度词汇表，
  // 历史清单里的 small/medium/large/wide/tall/full 名称会自动映射到最近的档位。
  width: TileWidth;
  supportedWidths?: TileWidth[];
  
  // 磁贴主题与动效规范
  tileTheme?: TileThemeConfig;

  // 声明式组件树 (若为纯 Schema 组件)
  schema?: WidgetSchema;
  
  // 原生或沙箱渲染入口函数 (可返回 React 节点或 TileSchemaDescriptor)
  render?: (ctx: WidgetContext<TData>) => React.ReactNode | TileSchemaDescriptor;
  
  // Windows Phone Live Tile 背面渲染入口函数 (支持 3D 翻转展示设置或详细数据)
  renderBack?: (ctx: WidgetContext<TData>) => React.ReactNode | TileSchemaDescriptor;

  // 数据映射与清洗注入函数
  data?: (activeResult?: SearchSynthesisResult) => TData;

  // 组件支持的操作动作表
  actions?: Record<string, (ctx: WidgetContext<TData>, payload?: any) => void | Promise<void>>;
}

