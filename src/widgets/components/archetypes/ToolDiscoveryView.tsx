import React, { useState } from "react";
import { ToolDiscoveryData, ToolDiscoveryItem } from "../../../types.js";
import { CheckCircle2, ExternalLink, Play, Sparkles, Star, Tag, Zap } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";

interface ToolDiscoveryViewProps {
  data: ToolDiscoveryData;
  themeColor?: string;
  onExecuteAction?: (tool: ToolDiscoveryItem) => void;
}

/**
 * 工具发现视图 (tool_discovery)
 *
 * shadcn/ui 重做要点：
 *   · 标签过滤由「黑底/蓝底/灰底三色药丸」改为 Tabs 分段控件，
 *     与清单、矩阵、场景等视图共用同一套控件语汇；
 *   · 定价标签从「emerald/blue/amber 半透明药丸」改为 Badge 两档：
 *     免费类走 secondary（实心弱化）、付费类走 outline —— 定价是分类不是告警，
 *     不需要四种色相各自编码；
 *   · 评分星标去掉 fill-amber，改为 outline 徽章 + font-mono 数值：
 *     分数是要横向比对的，等宽数字比金色星星更有用；
 *   · 亮点提示块、在线沙盒由「蓝/绿渐变底 + 彩色描边」收敛为 muted 底 + border，
 *     渐变是纯装饰，且在单色主题下无法成立；
 *   · 动作按钮统一走 Button / buttonVariants（<a> 复用按钮外观）。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
export const ToolDiscoveryView: React.FC<ToolDiscoveryViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onExecuteAction
}) => {
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [activeDemoTool, setActiveDemoTool] = useState<ToolDiscoveryItem | null>(null);

  const tools = data.tools || [];
  const filterTags = data.filterTags || [];

  const filteredTools = tools.filter(t => {
    if (selectedTag === "all") return true;
    return (t.tags || []).includes(selectedTag);
  });

  /** 定价档位：免费类实心弱化、其余描边，不用色相区分 */
  const getPricingBadge = (pricing: string) => {
    switch (pricing) {
      case "free":
        return <Badge variant="secondary">完全免费</Badge>;
      case "open_source":
        return <Badge variant="secondary">开源免费</Badge>;
      case "freemium":
        return <Badge variant="outline">免费试用/增值</Badge>;
      default:
        return <Badge variant="outline">商业版</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 标签过滤 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={selectedTag} onValueChange={setSelectedTag}>
          <TabsList>
            <TabsTrigger value="all">全部工具 {tools.length}</TabsTrigger>
            {filterTags.map(tag => (
              <TabsTrigger key={tag} value={tag}>
                <Tag />
                {tag}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">已交叉核验真实可用性</span>
      </div>

      {/* 工具网格 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filteredTools.map(tool => (
          <div
            key={tool.id}
            className="flex flex-col justify-between rounded-lg border bg-card p-3.5 transition-colors hover:border-foreground/20"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium text-foreground">{tool.name}</h4>
                    {getPricingBadge(tool.pricing)}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {tool.tagline}
                  </p>
                </div>

                <Badge variant="outline" className="shrink-0 font-mono tabular-nums">
                  <Star />
                  {tool.rating.toFixed(1)}
                </Badge>
              </div>

              {tool.highlight && (
                <div className="mt-2.5 flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                  <Sparkles className="size-3 shrink-0" />
                  <span className="truncate">{tool.highlight}</span>
                </div>
              )}

              {tool.tags && tool.tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                  {tool.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 动作区 */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              {tool.hasOnlineDemo ? (
                <Button size="sm" onClick={() => setActiveDemoTool(tool)}>
                  <Play />
                  在线免安装体验
                </Button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3" />
                  免注册/开箱即用
                </span>
              )}

              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <span>直达官网</span>
                <ExternalLink />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* 在线沙盒 */}
      {activeDemoTool && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Play className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs font-medium text-foreground">
                {activeDemoTool.name} · 在线功能沙盒体验
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveDemoTool(null)}
              className="shrink-0"
            >
              关闭沙盒
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            您可以在此直接调用该工具的核心能力，无需本地配置环境或预装依赖。
          </p>

          <div className="flex items-center gap-2">
            <a
              href={activeDemoTool.demoUrl || activeDemoTool.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm" })}
            >
              <span>立即在新标签页打开全屏体验</span>
              <ExternalLink />
            </a>
          </div>
        </div>
      )}

      {/* 选型建议 */}
      {data.recommendationVerdict && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <Zap className="mt-0.5 size-4 shrink-0" />
          <div>
            <span className="font-medium text-foreground">选型建议：</span>
            {data.recommendationVerdict}
          </div>
        </div>
      )}
    </div>
  );
};
