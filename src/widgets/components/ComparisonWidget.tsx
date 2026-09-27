import React from "react";
import { ArrowRightLeft, Check, Sparkles } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { Badge } from "../../components/ui/badge.js";

interface ComparisonWidgetProps {
  activeResult?: SearchSynthesisResult;
  query?: string;
  isCompact?: boolean;
}

export const ComparisonWidget: React.FC<ComparisonWidgetProps> = ({
  activeResult,
  query = "",
  isCompact = false
}) => {
  const table = activeResult?.comparisonTable || [];

  if (!table || table.length === 0) {
    return (
      <div className="p-5 flex flex-col items-center justify-center text-center h-full min-h-[160px] text-muted-foreground">
        <ArrowRightLeft className="w-8 h-8 mb-2 opacity-40 text-primary" />
        <p className="text-sm font-medium">当前查询未生成实体对比矩阵</p>
        <p className="text-xs text-muted-foreground/70 mt-1">可在搜索词中输入“A 和 B 的区别 / 对比”触发专项评测</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 flex flex-col h-full overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">多维对比评测矩阵</h3>
            <p className="text-xs text-muted-foreground">针对核心实体与维度的横向深度参数剖析</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-500">
          {table.length} 个对比维度
        </Badge>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-border/50">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground font-medium">
              <th className="py-2.5 px-3 w-1/4">对比维度</th>
              <th className="py-2.5 px-3">参数特性与表现对比</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {table.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3 font-medium text-foreground align-top bg-muted/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>{row.dimension}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-foreground/90 leading-relaxed">
                  <div className="space-y-1.5">
                    {Array.isArray(row.details) ? (
                      row.details.map((d, dIdx) => (
                        <div key={dIdx} className="text-xs flex items-start gap-1.5">
                          <span className="text-muted-foreground">•</span>
                          <span>{d}</span>
                        </div>
                      ))
                    ) : (
                      <span>{String(row.summary || row.details || "")}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
