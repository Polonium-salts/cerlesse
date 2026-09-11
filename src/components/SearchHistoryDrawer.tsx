import React from "react";
import { SearchSynthesisResult } from "../types.js";
import { X, History, Trash2, ArrowUpRight, Clock } from "lucide-react";

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
        className="w-full max-w-sm h-full bg-white dark:bg-[#1c1c1e] border-l border-zinc-200/90 dark:border-zinc-800 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              检索与研报历史
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
          {history.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 text-xs">
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
                className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-100/90 dark:hover:bg-zinc-800 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1">
                    {item.query}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors shrink-0 ml-1" />
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  <span>·</span>
                  <span>{item.result.filteredResults.length} 条信源</span>
                </div>
              </div>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClear}
              className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空历史记录</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
