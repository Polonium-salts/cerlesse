import React, { useState, useMemo } from "react";
import { ParameterMatrixData, ParameterMatrixRow } from "../../../types.js";
import { ChevronRight, ExternalLink, Search, Sparkles } from "lucide-react";
import { Input } from "../../../components/ui/input.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table.js";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import { WuEmpty } from "../../../components/ui/widget-composites.js";
import { cn } from "../../../lib/utils.js";

interface MatrixViewProps {
  data: ParameterMatrixData;
  themeColor?: string;
  onUpdateData?: (updated: ParameterMatrixData) => void;
}

/**
 * 参数矩阵视图 (parameter_matrix)
 *
 * shadcn/ui 重做要点：
 *   · 工具栏收起为一张 muted 信息条：Input（左侧内嵌搜索图标）+ Tabs 分类分段控件，
 *     取代原先「白底输入框 + 蓝底药丸 chip」两套互不相干的控件；
 *   · 表格改由 Table 原语族渲染（border-b 行分隔 / 表头 muted / 单元格 p-2），
 *     外层只保留一层 rounded-lg border 容器，不再重复描边与投影；
 *   · 行选中态由蓝色高亮改为 bg-muted/60（语义令牌，明暗自适应），
 *     展开区同为 muted，层级靠明度差建立；
 *   · 高亮规格的 Sparkles 由琥珀色改为 text-foreground/70：图标仍承担「核心规格」语义，
 *     但不再用色相表达（单色契约）；
 *   · 计数 / 信源一律 font-mono + tabular-nums。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
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
    <div className="flex flex-col gap-3">
      {/* 搜索与分类过滤 */}
      <div className="flex flex-col gap-2.5 rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索参数、指标或对比配置..."
              className="pl-8 text-xs"
            />
          </div>

          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {filteredRows.length}/{rows.length} 项
          </span>
        </div>

        {categories.length > 1 && (
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat}>
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* 对比矩阵 */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="min-w-[130px]">{columns[0] || "参数规格"}</TableHead>
              <TableHead className="min-w-[130px]">{columns[1] || "主流配置"}</TableHead>
              <TableHead className="min-w-[130px]">{columns[2] || "进阶高配"}</TableHead>
              {columns[3] && <TableHead className="min-w-[130px]">{columns[3]}</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRows.map((row: ParameterMatrixRow) => {
              const isSelected = selectedRowId === row.id;

              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    onClick={() => setSelectedRowId(isSelected ? null : row.id)}
                    className={cn("cursor-pointer", isSelected && "bg-muted/60 hover:bg-muted/60")}
                  >
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        {row.isHighlight && (
                          <span title="核心规格">
                            <Sparkles className="size-3 shrink-0 text-foreground/70" />
                          </span>
                        )}
                        <span>{row.parameter}</span>
                      </div>
                      {row.category && (
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {row.category}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {row.values[0] || "—"}
                    </TableCell>

                    <TableCell className="font-medium text-foreground">
                      {row.values[1] || "—"}
                    </TableCell>

                    {columns[3] && (
                      <TableCell className="text-muted-foreground">
                        {row.values[2] || "—"}
                      </TableCell>
                    )}
                  </TableRow>

                  {isSelected && (
                    <TableRow className="hover:bg-muted/30">
                      <TableCell colSpan={columns.length} className="bg-muted/30">
                        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          {row.differenceNote && (
                            <div className="flex items-start gap-1.5">
                              <span className="shrink-0 font-medium text-foreground">差异分析：</span>
                              <span>{row.differenceNote}</span>
                            </div>
                          )}

                          {row.sourceUrl && (
                            <a
                              href={row.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                            >
                              <span>信源溯源: {row.sourceTitle || new URL(row.sourceUrl).hostname}</span>
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>

        {filteredRows.length === 0 && (
          <WuEmpty className="m-3 min-h-16">未检索到匹配的参数规格条目</WuEmpty>
        )}
      </div>

      <div className="flex items-center gap-1 px-0.5 text-xs text-muted-foreground">
        <ChevronRight className="size-3" />
        <span>提示：点击任意行可展开查看该指标的底层差异解析与信源链接</span>
      </div>
    </div>
  );
};
