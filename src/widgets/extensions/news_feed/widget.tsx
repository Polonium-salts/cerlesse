import React from "react";
import type { NewsFeedData } from "./types.js";
import type { WidgetContext } from "../../sdk/types.js";
import { newsFeedAdapter } from "./adapter.js";
import {
  Newspaper,
  Flame,
  Clock,
  ExternalLink,
  Share2,
  TrendingUp,
  Sparkles,
  ArrowRight
} from "lucide-react";

export interface NewsFeedWidgetProps {
  data?: NewsFeedData;
  context?: WidgetContext;
  isCompact?: boolean;
  activeResult?: any;
}

export const NewsFeedWidget: React.FC<NewsFeedWidgetProps> = (props) => {
  const isCompact = props.isCompact ?? props.context?.isCompact ?? false;

  const data: NewsFeedData =
    props.data ??
    newsFeedAdapter.transform(
      props.context?.activeResult?.query || props.activeResult?.query || "",
      props.context?.activeResult || props.activeResult
    );

  if (isCompact) {
    return (
      <div className="p-4 flex flex-col justify-between h-full bg-gradient-to-br from-orange-500/10 via-card to-amber-500/5 rounded-2xl border border-orange-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Newspaper className="w-4 h-4 text-orange-500" />
            <span className="truncate max-w-[120px]">{data.topic} 资讯</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold">
            实时
          </span>
        </div>
        <div className="my-2 text-xs font-semibold text-foreground line-clamp-2">
          {data.articles[0]?.title}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
          <span>{data.articles[0]?.source}</span>
          <span>{data.articles[0]?.publishedAt}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-orange-500/10 via-card to-amber-600/5 rounded-3xl border border-orange-500/20 shadow-xs">
      {/* 头部标题 */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 text-xs font-bold tracking-wide flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                时事资讯流
              </span>
              <span className="text-xs text-muted-foreground">更新于 {data.lastUpdated}</span>
            </div>
            <h2 className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
              {data.topic} 最新要闻与动态
            </h2>
          </div>
        </div>

        {/* 资讯文章列表 */}
        <div className="space-y-2.5 my-2">
          {data.articles.map((item, idx) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-background/80 hover:bg-background border border-border/60 transition-all flex items-start justify-between gap-3 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {item.category && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold">
                      {item.category}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">{item.source}</span>
                  <span className="text-[11px] text-muted-foreground">· {item.publishedAt}</span>
                </div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-muted/60 hover:bg-orange-500 hover:text-white text-muted-foreground transition-all shrink-0 self-center"
                  title="查看新闻原文"
                >
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 底部信息 */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>全网权威新闻源聚合过滤</span>
        <span className="text-orange-600 dark:text-orange-400 font-medium">即时抓取更新</span>
      </div>
    </div>
  );
};
