import React, { useState } from "react";
import { ShieldCheck, CheckSquare, Square } from "lucide-react";
import type { SearchSynthesisResult } from "../../../types.js";
import { Badge } from "../../../components/ui/badge.js";
import type { WidgetContext } from "../../sdk/types.js";
import type { VerificationChecklistData, ChecklistItem } from "./types.js";
import { verificationChecklistAdapter, deriveChecklistItems } from "./adapter.js";

export interface VerificationChecklistWidgetProps {
  data?: VerificationChecklistData;
  context?: WidgetContext;
  activeResult?: SearchSynthesisResult;
  query?: string;
  isCompact?: boolean;
}

export const VerificationChecklistWidget: React.FC<VerificationChecklistWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;
  const activeResult = props.context?.activeResult ?? props.activeResult;
  const query = props.query || props.context?.activeResult?.query || props.activeResult?.query || "";

  const checklistData: VerificationChecklistData = React.useMemo(() => {
    if (props.data) {
      return props.data;
    }
    return verificationChecklistAdapter.transform(query, activeResult);
  }, [props.data, query, activeResult]);

  const items: ChecklistItem[] = checklistData.items || [];
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => {
    const init = new Set<string>();
    items.forEach((it) => {
      if (it.checked) init.add(it.id);
    });
    return init;
  });

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const progress = items.length > 0 ? Math.round((checkedIds.size / items.length) * 100) : 0;

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-card rounded-2xl border border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>核验自检清单</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
            {progress}% 完成
          </span>
        </div>
        <div className="my-2 space-y-1 overflow-hidden">
          {items.slice(0, 3).map((it) => {
            const isDone = checkedIds.has(it.id);
            return (
              <div key={it.id} className="text-xs truncate flex items-center gap-1.5 text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${isDone ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                <span className={isDone ? "line-through opacity-70" : ""}>{it.title}</span>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
          共 {items.length} 个基线核验项
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 flex flex-col h-full overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              {checklistData.title || "故障排查与核验清单"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {checklistData.description || "交互式步骤自检与避坑保障"}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">
          已完成 {progress}%
        </Badge>
      </div>

      <div className="flex-1 overflow-auto space-y-2">
        {items.map((item) => {
          const isDone = checkedIds.has(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                isDone
                  ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                  : "bg-muted/20 border-border/40 hover:bg-muted/40 hover:border-emerald-500/30 text-foreground"
              }`}
            >
              <div className="mt-0.5 text-emerald-500 shrink-0">
                {isDone ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4 text-muted-foreground/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-tight ${isDone ? "line-through opacity-70" : ""}`}>
                  {item.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
