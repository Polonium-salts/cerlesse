import React, { useState } from "react";
import { MindMapNode } from "../types.js";
import { IOSWidget } from "./ui/IOSWidget.js";
import { MindMapView } from "./MindMapView.js";
import { GitFork, Maximize2, Minimize2, Sparkles } from "lucide-react";

interface MindMapWidgetProps {
  rootNode: MindMapNode;
  query: string;
  isCompact?: boolean;
  colSpan?: number;
  isDark?: boolean;
}

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
        title="交互式知识架构导图"
        subtitle="Agent 自主拓扑排版 · 360° 放射 / 双向平衡 / 层级金字塔等多维排列"
        icon={<GitFork className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
        actions={
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="全屏浏览思维导图"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>全屏</span>
          </button>
        }
        noPadding={true}
        className="w-full"
      >
        <div className="p-4 sm:p-5">
          <MindMapView
            rootNode={rootNode}
            query={query}
            isCompact={isCompact}
            colSpan={colSpan}
            isDark={isDark}
          />
        </div>
      </IOSWidget>

      {/* Fullscreen Modal View */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-[96vw] xl:max-w-[94vw] h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <GitFork className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {query} - 全屏知识架构导图
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Agent 智能编排 · 支持 360° 辐射、双翼发散、层级金字塔与无限拓扑重组
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
                <span>退出全屏</span>
              </button>
            </div>

            <div className="flex-1 p-6 overflow-hidden">
              <MindMapView rootNode={rootNode} query={query} isDark={isDark} isFullscreen={true} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
