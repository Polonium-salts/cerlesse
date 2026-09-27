import React from "react";
import { Workflow } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { MindMapView } from "../views/MindMapView.js";

interface MindMapWidgetProps {
  activeResult?: SearchSynthesisResult;
  query?: string;
  isCompact?: boolean;
}

export const MindMapWidget: React.FC<MindMapWidgetProps> = ({
  activeResult,
  query = "",
  isCompact = false
}) => {
  const mindMap = activeResult?.mindMap;

  if (!mindMap || !mindMap.children || mindMap.children.length === 0) {
    return (
      <div className="p-5 flex flex-col items-center justify-center text-center h-full min-h-[160px] text-muted-foreground">
        <Workflow className="w-8 h-8 mb-2 opacity-40 text-purple-500" />
        <p className="text-sm font-medium">当前查询未生成知识架构导图</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      <div className="p-3 sm:px-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">知识架构拓扑</h3>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden min-h-[300px]">
        <MindMapView
          rootNode={mindMap}
          query={query || activeResult?.query || ""}
          isCompact={isCompact}
        />
      </div>
    </div>
  );
};
