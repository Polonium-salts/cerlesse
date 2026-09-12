import React, { useState, useMemo, useCallback } from "react";
import { 
  WidgetModule, 
  WidgetContext, 
  WidgetPlannedSize,
  TileSchemaDescriptor
} from "./sdk/types.js";
import { WidgetSchemaRenderer } from "./schemaRenderer.js";
import { TileAtomRenderer } from "./tileRenderer.js";
import { SearchSynthesisResult } from "../types.js";
import { AlertCircle, RefreshCw } from "lucide-react";

interface WidgetRuntimeProps {
  module: WidgetModule;
  data?: any;
  activeResult?: SearchSynthesisResult;
  size?: WidgetPlannedSize | "wide";
  isCompact?: boolean;
  onResize?: (nextSize: WidgetPlannedSize | "wide") => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

export const WidgetRuntime: React.FC<WidgetRuntimeProps> = ({
  module,
  data,
  activeResult,
  size,
  isCompact = false,
  onResize,
  onExecuteSearch,
  openUrl,
  copyText
}) => {
  // 局域响应式 State
  const [state, setStateInternal] = useState<Record<string, any>>({});
  // Windows Phone Live Tile 3D 双面翻转状态
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  const flipTile = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const setState = useCallback((updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
    setStateInternal((prev) => {
      if (typeof updater === "function") {
        return updater(prev);
      }
      return { ...prev, ...updater };
    });
  }, []);

  const effectiveSize = (size || module.defaultSize || "medium") as WidgetPlannedSize;

  // 隔离的 Storage API（以组件 ID 隔离命名空间）
  const scopedStorage = useMemo(() => {
    const prefix = `widget_store_${module.id}_`;
    return {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(`${prefix}${key}`);
        } catch {
          return null;
        }
      },
      setItem: (key: string, val: string) => {
        try {
          localStorage.setItem(`${prefix}${key}`, val);
        } catch {
          // ignore quota
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(`${prefix}${key}`);
        } catch {
          // ignore
        }
      }
    };
  }, [module.id]);

  // 动作调度总线
  const boundActions = useMemo(() => {
    const actionMap: Record<string, (payload?: any) => void> = {};
    if (module.actions) {
      Object.entries(module.actions).forEach(([name, handler]) => {
        actionMap[name] = (payload?: any) => {
          try {
            handler(context, payload);
          } catch (err) {
            console.error(`Error in widget [${module.id}] action [${name}]:`, err);
          }
        };
      });
    }
    return actionMap;
  }, [module.actions, module.id]);

  // 构造受控安全运行时 Context
  const context: WidgetContext = useMemo(() => {
    // 允许模块自身提供数据映射清洗器
    const resolvedData = module.data
      ? module.data(activeResult)
      : data !== undefined
      ? data
      : activeResult;

    return {
      data: resolvedData,
      activeResult,
      size: effectiveSize,
      isCompact,
      isFlipped,
      flipTile,
      state,
      setState,
      actions: boundActions,
      onResize: onResize as any,
      onExecuteSearch,
      openUrl: openUrl || ((url: string) => window.open(url, "_blank", "noopener,noreferrer")),
      copyText: copyText || ((text: string) => navigator.clipboard?.writeText(text)),
      storage: scopedStorage
    };
  }, [
    module,
    data, 
    activeResult, 
    effectiveSize, 
    isCompact, 
    isFlipped,
    flipTile,
    state, 
    setState, 
    boundActions, 
    onResize, 
    onExecuteSearch, 
    openUrl, 
    copyText, 
    scopedStorage
  ]);

  // 渲染单一视图（处理声明式 TileSchemaDescriptor 或直接 ReactNode）
  const renderViewContent = (viewNode: React.ReactNode | TileSchemaDescriptor | undefined) => {
    if (!viewNode) return null;
    if (typeof viewNode === "object" && (viewNode as any)?.type === "tile") {
      return <TileAtomRenderer descriptor={viewNode as TileSchemaDescriptor} context={context} />;
    }
    return <>{viewNode as React.ReactNode}</>;
  };

  try {
    // 优先 1：声明式 Schema 视图
    if (module.schema) {
      return <WidgetSchemaRenderer schema={module.schema} context={context} />;
    }

    // 获取正面渲染内容
    const frontContent = typeof module.render === "function" ? module.render(context) : null;
    // 获取背面渲染内容（若存在）
    const hasBackView = typeof module.renderBack === "function";
    const backContent = hasBackView ? module.renderBack!(context) : null;

    if (!frontContent && !backContent) {
      return (
        <div className="p-4 rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500">
          小组件 [{module.name || module.id}] 缺少可渲染的视图
        </div>
      );
    }

    // 若具备背面视图，开启 Windows Phone 经典 3D Live Tile 翻转容器
    if (hasBackView) {
      return (
        <div className="relative w-full h-full group/livetile" style={{ perspective: 1200 }}>
          {/* 磁贴右上角 Live Tile 快捷翻转把手 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              flipTile();
            }}
            title={isFlipped ? "翻转回正面速览" : "翻转至磁贴背面"}
            className="absolute top-3 right-3 z-30 opacity-0 group-hover/livetile:opacity-100 p-1.5 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-700/60 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isFlipped ? "rotate-180 text-blue-600" : ""}`} />
          </button>

          <div
            className="w-full h-full transition-transform duration-500 ease-out"
            style={{
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
            }}
          >
            {/* 正面卡片 */}
            <div 
              className="w-full h-full"
              style={{ 
                backfaceVisibility: "hidden", 
                WebkitBackfaceVisibility: "hidden" 
              }}
            >
              {renderViewContent(frontContent)}
            </div>

            {/* 背面卡片 */}
            <div
              className="w-full h-full absolute inset-0 rounded-3xl overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-blue-500/20 shadow-lg"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)"
              }}
            >
              {renderViewContent(backContent)}
            </div>
          </div>
        </div>
      );
    }

    // 普通单面卡片
    return renderViewContent(frontContent);
  } catch (err: any) {
    console.error(`Crash in WidgetRuntime [${module.id}]:`, err);
    return (
      <div className="p-4 rounded-3xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>组件渲染异常: {err?.message || "未知错误"}</span>
      </div>
    );
  }
};
