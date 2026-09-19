import React, { useState, useMemo, useCallback } from "react";
import { 
  WidgetModule, 
  WidgetContext,
  TileSchemaDescriptor
} from "./sdk/types.js";
import { WidgetExtension, createModuleFromExtension } from "./sdk/extension.js";
import type { TileWidth } from "../lib/tileLayoutEngine.js";
import { WidgetSchemaRenderer } from "./schemaRenderer.js";
import { TileAtomRenderer } from "./tileRenderer.js";
import { WidgetBoundary } from "./core/WidgetBoundary.js";
import { SearchSynthesisResult } from "../types.js";
import { Alert, AlertDescription } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * 安全解析小组件数据适配器，防御并捕获适配器内部抛出的未捕获异常
 */
export function resolveWidgetData<T = any>(
  module: WidgetModule<T>,
  activeResult?: SearchSynthesisResult,
  fallback?: T
): { data?: T; error?: Error } {
  try {
    if (typeof module.data === "function") {
      return { data: module.data(activeResult) };
    }
    return {
      data: fallback !== undefined ? fallback : (activeResult as unknown as T)
    };
  } catch (error) {
    console.error(
      `[WidgetRuntime] Data adapter failed for [${module.id}]:`,
      error
    );
    return {
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

interface WidgetRuntimeProps {
  module?: WidgetModule;
  extension?: WidgetExtension;
  data?: any;
  activeResult?: SearchSynthesisResult;
  size?: TileWidth;
  isCompact?: boolean;
  onResize?: (nextSize: TileWidth) => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

export const WidgetRuntime: React.FC<WidgetRuntimeProps> = ({
  module: propModule,
  extension,
  data,
  activeResult,
  size,
  isCompact = false,
  onResize,
  onExecuteSearch,
  openUrl,
  copyText
}) => {
  const module = useMemo(() => {
    if (propModule) return propModule;
    if (extension) return createModuleFromExtension(extension);
    return undefined;
  }, [propModule, extension]);

  if (!module) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        未找到有效的小组件模块或扩展
      </div>
    );
  }

  return (
    <WidgetBoundary widgetId={String(module.id)}>
      <WidgetRuntimeInner
        module={module}
        data={data}
        activeResult={activeResult}
        size={size}
        isCompact={isCompact}
        onResize={onResize}
        onExecuteSearch={onExecuteSearch}
        openUrl={openUrl}
        copyText={copyText}
      />
    </WidgetBoundary>
  );
};

interface WidgetRuntimeInnerProps {
  module: WidgetModule;
  data?: any;
  activeResult?: SearchSynthesisResult;
  size?: TileWidth;
  isCompact?: boolean;
  onResize?: (nextSize: TileWidth) => void;
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

const WidgetRuntimeInner: React.FC<WidgetRuntimeInnerProps> = ({
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

  const effectiveSize: TileWidth = size || module.width || 50;

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

  // 安全解析数据适配器，防御异常
  const { data: resolvedData, error: dataError } = useMemo(
    () => resolveWidgetData(module, activeResult, data),
    [module, activeResult, data]
  );

  // 构造受控安全运行时 Context
  const context: WidgetContext = useMemo(() => {
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
    resolvedData,
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

  if (dataError) {
    return (
      <div 
        data-widget-id={String(module.id)} 
        className="w-full h-full min-h-[140px] p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center text-center gap-2"
      >
        <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-foreground">
            小组件加载失败
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            组件: {String(module.id)} | 阶段: data
          </div>
          <div className="text-[11px] text-destructive/90 line-clamp-2 max-w-[280px]">
            数据适配阶段异常 (adapter_error): {dataError.message}
          </div>
        </div>
      </div>
    );
  }


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
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-xs text-muted-foreground">
          小组件 [{module.name || module.id}] 缺少可渲染的视图
        </div>
      );
    }

    // 若具备背面视图，开启 Windows Phone 经典 3D Live Tile 翻转容器
    if (hasBackView) {
      return (
        <div className="relative w-full h-full group/livetile" style={{ perspective: 1200 }}>
          {/* 磁贴右上角 Live Tile 快捷翻转把手 */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              flipTile();
            }}
            title={isFlipped ? "翻转回正面速览" : "翻转至磁贴背面"}
            className="absolute top-3 right-3 z-30 bg-card border border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`transition-transform duration-500 ${isFlipped ? "rotate-180" : ""}`} />
          </Button>

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
              className="w-full h-full absolute inset-0 rounded-xl overflow-hidden border border-border bg-card/95 backdrop-blur-xl shadow-sm"
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
      <Alert variant="destructive" className="items-center">
        <AlertCircle />
        <AlertDescription>组件渲染异常: {err?.message || "未知错误"}</AlertDescription>
      </Alert>
    );
  }
};
