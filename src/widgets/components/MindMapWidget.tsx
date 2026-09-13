import React, { useState } from "react";
import { MindMapNode } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Button } from "../../components/ui/button.js";
import { MindMapView } from "../views/MindMapView.js";
import { GitFork, Maximize2, Minimize2 } from "lucide-react";

interface MindMapWidgetProps {
  rootNode: MindMapNode;
  query: string;
  isCompact?: boolean;
  colSpan?: number;
  isDark?: boolean;
}

/**
 * 知识架构导图 (mind_map)
 *
 * shadcn/ui 重做要点：
 *   · 头部「全屏」入口由药丸按钮改为 shadcn Button（outline / sm）；
 *   · 全屏浮层从 iOS 拟物的 rounded-[20px] + 自绘描边，改为 shadcn Dialog 语汇：
 *     rounded-xl + bg-card + ring-1 ring-foreground/10 + shadow-lg，
 *     标题区用 border-b border-border 分隔，与卡片内分隔线保持同一套语言；
 *   · 图表本体（MindMapView）保持既有交互不变。
 */
export const MindMapWidget: React.FC<MindMapWidgetProps> = ({
  rootNode,
  query,
  isCompact,
  colSpan,
  isDark
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <IOSWidget
        id="widget-mindmap"
        title="知识架构导图"
        icon={<GitFork className="size-4" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(true)}
            title="全屏浏览思维导图"
          >
            <Maximize2 />
            <span>全屏</span>
          </Button>
        }
        noPadding={true}
        className="w-full"
      >
        <div className="p-4">
          <MindMapView
            rootNode={rootNode}
            query={query}
            isCompact={isCompact}
            colSpan={colSpan}
            isDark={isDark}
          />
        </div>
      </IOSWidget>

      {/* 全屏浮层：shadcn Dialog 语汇 */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex h-[92vh] w-full max-w-[94vw] flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="truncate text-sm font-semibold">{query}</h3>
              <Button variant="outline" size="sm" onClick={() => setIsFullscreen(false)}>
                <Minimize2 />
                <span>退出全屏</span>
              </Button>
            </div>

            <div className="flex-1 overflow-hidden p-4">
              <MindMapView rootNode={rootNode} query={query} isDark={isDark} isFullscreen={true} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
