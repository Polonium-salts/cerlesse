import React from "react";
import { SearchResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Database } from "lucide-react";

/**
 * 相关度归一化。
 *
 * 检索重排内核下发的 `score` 是 0~100 的相关性总分
 * （见 server/retrievalRanker.ts 的 relevanceScore，同时写入 score 字段），
 * 部分引擎原始分则是 0~1，故按量级判断后统一到 0~100。
 */
function toRelevancePercent(score?: number): number {
  if (!score || !Number.isFinite(score) || score <= 0) return 0;
  return Math.round(score <= 1 ? score * 100 : score);
}

/** 单屏最多渲染的信源条数（紧凑档减半） */
const MAX_VISIBLE_SOURCES = 6;
const MAX_VISIBLE_SOURCES_COMPACT = 4;

interface SourcesListWidgetProps {
  results: SearchResult[];
  rawResultCount: number;
  isCompact?: boolean;
  onOpenForgeModal?: () => void;
}

/**
 * 核验信源库 (sources)
 *
 * shadcn/ui 重做要点：
 *   · 从"卡片套卡片"改为 shadcn 经典的**通栏分隔列表**：
 *     负边距 -mx-4 抵消卡片内边距 + divide-y divide-border，
 *     分隔线直接贯穿整卡宽度（shadcn 文档推荐的边缘对齐做法）；
 *   · 相关度由自制小圆角标签改为 Badge（outline / 等宽数字）；
 *     「官网」标记改为 Badge（secondary），语义层级更清晰；
 *   · 域名与摘要统一 text-xs text-muted-foreground，标题 text-sm font-medium。
 */
export const SourcesListWidget: React.FC<SourcesListWidgetProps> = ({
  results,
  isCompact = false
}) => {
  // 条数上限只表达"一屏最多列多少条"，不再迁就磁贴当前高度：
  // 磁贴会由桌面视图实测内容后让高，因此这里渲染几条就能完整显示几条。
  const visibleSources = results.slice(
    0,
    isCompact ? MAX_VISIBLE_SOURCES_COMPACT : MAX_VISIBLE_SOURCES
  );
  const hiddenCount = results.length - visibleSources.length;

  return (
    <IOSWidget
      id="widget-sources-list"
      title="核验信源库"
      icon={<Database className="size-4" />}
      badge={
        <span className="text-xs text-muted-foreground">
          {hiddenCount > 0
            ? `${visibleSources.length} / ${results.length} 条`
            : `${results.length} 条`}
        </span>
      }
      className="w-full"
    >
      <ul className="-mx-4 divide-y divide-border">
        {visibleSources.map((item, idx) => {
          let host = "";
          try {
            host = new URL(item.url).hostname;
          } catch {
            host = item.url;
          }

          return (
            <li key={item.id || idx} className="px-4 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-2 text-sm font-medium leading-5 text-foreground hover:underline"
                >
                  {item.title}
                </a>
                <Badge variant="outline" className="shrink-0 font-mono tabular-nums">
                  {toRelevancePercent(item.score)}%
                </Badge>
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate font-mono">{host}</span>
                {item.isOfficial && (
                  <Badge variant="secondary" className="px-1.5 py-0">
                    官网
                  </Badge>
                )}
              </div>

              {item.snippet && (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.snippet}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </IOSWidget>
  );
};
