import React from "react";
import { SearchSynthesisResult, ResultWidgetKey, WidgetPlannedSize } from "../../types.js";
import type { TileSize } from "../../lib/tileLayoutEngine.js";

// ResultWidgetKey 是注册中心对外契约的一部分（registry.get / has / unregister 的入参类型），
// 必须一并转发导出，否则 registry.tsx 的具名导入无法解析（TS2459）。
export type { WidgetPlannedSize, ResultWidgetKey };

export type WidgetCategoryType = "synthesis" | "analysis" | "action" | "portal" | "custom";

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
  size: WidgetPlannedSize;
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
  size: WidgetPlannedSize;
  isCompact: boolean;
  
  // 局域响应式 State 管理
  state: Record<string, any>;
  setState: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  
  // 动作调度总线
  actions: Record<string, (payload?: any) => void>;
  
  // 宿主程序桥接能力
  onResize?: (nextSize: WidgetPlannedSize | "wide") => void;
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
  icon?: React.ComponentType<{ className?: string }> | string;
  
  // 尺寸契约：一律使用「磁贴宽度档位 TileSize」口径 ——
  // small=2格 / medium=4格 / large=6格 / wide=8格 / tall=4格 / full=12格。
  // ⚠️ 切勿混入 WidgetPlannedSize 口径（其 small=4格 / medium=6格 / large=8格），
  //    两套词汇表同名不同义，混用会让组件整体缩水一档、内容被挤压裁切。
  defaultSize: TileSize;
  supportedSizes?: TileSize[];
  
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

