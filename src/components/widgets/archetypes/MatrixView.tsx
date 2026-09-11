import React, { useState, useMemo } from "react";
import { ParameterMatrixData, ParameterMatrixRow } from "../../../types.js";
import { Search, Sparkles, ExternalLink, Filter, ChevronRight, Check } from "lucide-react";

interface MatrixViewProps {
  data: ParameterMatrixData;
  themeColor?: string;
  onUpdateData?: (updated: ParameterMatrixData) => void;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData: _onUpdateData
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const columns = data.columns || ["指标参数", "基准配置", "进阶配置", "应用考量"];
  const rows = data.rows || [];

  // Derive categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return ["全部", ...Array.from(set)];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (selectedCategory !== "全部" && r.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inParam = r.parameter.toLowerCase().includes(q);
        const inVals = r.values.some(v => v.toLowerCase().includes(q));
        const inNote = r.differenceNote?.toLowerCase().includes(q);
        return inParam || inVals || inNote;
      }
      return true;
    });
  }, [rows, selectedCategory, searchQuery]);

  return (
    <div className="space-y-3.5">
      {/* Search & Category Filter Toolbar */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-800/80 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索参数、指标或对比配置..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
            />
          </div>

          <span className="text-[11px] font-mono text-zinc-400 shrink-0">
            {filteredRows.length}/{rows.length} 项
          </span>
        </div>

        {/* Category Pill Selector */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-zinc-400 flex items-center gap-1 text-[11px] shrink-0">
              <Filter className="w-3 h-3" />
              分类:
            </span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white dark:bg-blue-500 shadow-2xs"
                    : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300/80 dark:hover:bg-zinc-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comparison Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-850/80 border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
              <th className="p-2.5 min-w-[130px]">{columns[0] || "参数规格"}</th>
              <th className="p-2.5 min-w-[130px]">{columns[1] || "主流配置"}</th>
              <th className="p-2.5 min-w-[130px]">{columns[2] || "进阶高配"}</th>
              {columns[3] && <th className="p-2.5 min-w-[130px]">{columns[3]}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filteredRows.map((row: ParameterMatrixRow) => {
              const isSelected = selectedRowId === row.id;

              return (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => setSelectedRowId(isSelected ? null : row.id)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected
                        ? "bg-blue-50/50 dark:bg-blue-950/30"
                        : "hover:bg-zinc-50/80 dark:hover:bg-zinc-850/50"
                    }`}
                  >
                    {/* Parameter name */}
                    <td className="p-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-1.5">
                        {row.isHighlight && (
                          <span title="核心规格">
                            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                          </span>
                        )}
                        <span>{row.parameter}</span>
                      </div>
                      {row.category && (
                        <span className="text-[10px] font-normal text-zinc-400 block mt-0.5">
                          {row.category}
                        </span>
                      )}
                    </td>

                    {/* Value col 1 */}
                    <td className="p-2.5 text-zinc-700 dark:text-zinc-300">
                      {row.values[0] || "—"}
                    </td>

                    {/* Value col 2 */}
                    <td className="p-2.5 text-zinc-700 dark:text-zinc-300 font-medium">
                      {row.values[1] || "—"}
                    </td>

                    {/* Value col 3 (if exists) */}
                    {columns[3] && (
                      <td className="p-2.5 text-zinc-500 dark:text-zinc-400">
                        {row.values[2] || "—"}
                      </td>
                    )}
                  </tr>

                  {/* Detail Accordion when row selected */}
                  {isSelected && (
                    <tr className="bg-blue-50/30 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/50">
                      <td colSpan={columns.length} className="p-3">
                        <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                          {row.differenceNote && (
                            <div className="flex items-start gap-1.5">
                              <span className="font-semibold text-blue-700 dark:text-blue-300 shrink-0">差异分析：</span>
                              <span>{row.differenceNote}</span>
                            </div>
                          )}

                          {row.sourceUrl && (
                            <div className="flex items-center gap-1 pt-1">
                              <a
                                href={row.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono"
                              >
                                <span>信源溯源: {row.sourceTitle || new URL(row.sourceUrl).hostname}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="text-center py-6 text-xs text-zinc-400">
            未检索到匹配的参数规格条目
          </div>
        )}
      </div>

      <div className="text-[11px] text-zinc-400 px-1 flex items-center gap-1">
        <ChevronRight className="w-3 h-3 text-zinc-400" />
        <span>提示：点击任意行可展开查看该指标的底层差异解析与信源链接</span>
      </div>
    </div>
  );
};
