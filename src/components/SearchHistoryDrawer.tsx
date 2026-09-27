import React from "react";
import { SearchSynthesisResult } from "../types.js";
import { X, History, Trash2, ArrowUpRight, Clock } from "lucide-react";
import { Button } from "./ui/button.js";

interface SearchHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: { query: string; timestamp: number; result: SearchSynthesisResult }[];
  onSelect: (result: SearchSynthesisResult) => void;
  onClear: () => void;
}

export const SearchHistoryDrawer: React.FC<SearchHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm h-full bg-card border-l border-border p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="size-4 text-muted-foreground" />
            检索与研报历史
          </h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="关闭">
            <X />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-16 text-xs text-muted-foreground">
              暂无搜索历史记录
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelect(item.result);
                  onClose();
                }}
                className="p-3 rounded-lg border border-border bg-card hover:bg-accent cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs text-foreground line-clamp-1">
                    {item.query}
                  </span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-1" />
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  <span>·</span>
                  <span>{item.result.filteredResults.length} 条信源</span>
                </div>
              </div>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="w-full"
            >
              <Trash2 />
              清空历史记录
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
