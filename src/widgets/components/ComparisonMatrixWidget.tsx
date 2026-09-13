import React, { useState } from "react";
import { ComparisonDimension } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { Scale, ExternalLink } from "lucide-react";

interface ComparisonMatrixWidgetProps {
  comparisonTable: ComparisonDimension[];
  query: string;
}

/**
 * 多源交叉对比矩阵 (comparison)
 *
 * shadcn/ui 重做要点：
 *   · 维度筛选由自制"药丸组塞进卡片头部"改为 shadcn Tabs（位于内容区顶部），
 *     头部只保留标题、维度计数与真值徽标，避免头部拥挤；
 *   · 每个维度改为 section 结构：h4 维度名 + Badge 计数 + 摘要 + 观点网格，
 *     观点卡用 rounded-lg border border-border（shadcn 嵌套容器的标准做法），
 *     取代原先"卡片中的卡片再套一层底色的灰块"；
 *   · 域名外链降为 text-xs font-mono text-muted-foreground，弱化但不消失。
 */
export const ComparisonMatrixWidget: React.FC<ComparisonMatrixWidgetProps> = ({
  comparisonTable
}) => {
  const [selected, setSelected] = useState<string>("all");

  if (!comparisonTable || comparisonTable.length === 0) {
    return null;
  }

  const selectedIndex = selected === "all" ? null : Number(selected);
  const displayedDimensions =
    selectedIndex !== null ? [comparisonTable[selectedIndex]] : comparisonTable;

  return (
    <IOSWidget
      id="widget-comparison-matrix"
      title="多源交叉对比矩阵"
      icon={<Scale className="size-4" />}
      badge={<span className="text-xs text-muted-foreground">{comparisonTable.length} 个维度</span>}
      className="w-full"
    >
      <div className="flex flex-col gap-3">
        {comparisonTable.length > 1 && (
          <Tabs value={selected} onValueChange={setSelected}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              {comparisonTable.slice(0, 3).map((dim, idx) => (
                <TabsTrigger key={idx} value={String(idx)}>
                  <span className="max-w-[6rem] truncate">{dim.dimension}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="flex flex-col gap-4">
          {displayedDimensions.map((item, dIdx) => (
            <section key={dIdx} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold tracking-tight text-foreground">
                  {item.dimension}
                </h4>
                {item.sourcesBreakdown && item.sourcesBreakdown.length > 0 && (
                  <Badge variant="outline" className="font-mono tabular-nums">
                    {item.sourcesBreakdown.length} 源
                  </Badge>
                )}
              </div>

              {item.summary && (
                <p className="text-xs leading-5 text-muted-foreground">{item.summary}</p>
              )}

              {item.sourcesBreakdown && item.sourcesBreakdown.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {item.sourcesBreakdown.map((p, pIdx) => {
                    let domain = "";
                    try {
                      domain = new URL(p.sourceUrl).hostname;
                    } catch {
                      domain = p.sourceTitle;
                    }

                    return (
                      <div key={pIdx} className="flex flex-col rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-foreground">
                            {p.sourceTitle}
                          </span>
                          <Badge variant="secondary" className="shrink-0 px-1.5 py-0">
                            {p.sourceType}
                          </Badge>
                        </div>

                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                          {p.pointOfView}
                        </p>

                        {p.sourceUrl && (
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex max-w-full items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <span className="truncate">{domain}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </IOSWidget>
  );
};
