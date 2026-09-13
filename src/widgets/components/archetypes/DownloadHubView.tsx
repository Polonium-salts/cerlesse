import React, { useState } from "react";
import { DownloadHubData, DownloadReleaseItem } from "../../../types.js";
import { Boxes, Check, Copy, Cpu, Download, ExternalLink, Laptop, Server, ShieldCheck, Terminal } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import { cn } from "../../../lib/utils.js";

interface DownloadHubViewProps {
  data: DownloadHubData;
  themeColor?: string;
  onExecuteAction?: (action: any) => void;
}

/**
 * 下载中心视图 (download_hub)
 *
 * shadcn/ui 重做要点：
 *   · 一键安装块由「近黑底 + 翠绿命令文字」改为 shadcn 代码块语汇：
 *     bg-muted/50 容器 + bg-background 命令行 + font-mono ——
 *     单色主题下彩色终端配色既无必要也无法成立；
 *   · 平台过滤由三色药丸改为 Tabs 分段控件，平台图标统一为 muted-foreground：
 *     图标承担「哪个平台」的识别，颜色不承担额外语义；
 *   · 推荐版本由「翠绿底 + 实心绿标签」改为 border-foreground/30 + Badge，
 *     靠描边明度而非色相区分；
 *   · 版本号、SHA256 校验值一律 font-mono：这两处要逐字符核对，
 *     等宽是功能而非风格；
 *   · 下载动作收敛为 Button / buttonVariants。
 *
 * 布局保留 h-full + min-h-0 + 内部 overflow-hidden：
 * 发行版本一次全量呈现，不引入内部滚动区（磁贴高度由桌面实测回路决定）。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
export const DownloadHubView: React.FC<DownloadHubViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onExecuteAction
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const releases = data.releases || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /** 平台图标：只做识别，不携带颜色 */
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "linux":
        return <Server className="size-4" />;
      case "macos":
      case "windows":
        return <Laptop className="size-4" />;
      case "docker":
        return <Boxes className="size-4" />;
      default:
        return <Cpu className="size-4" />;
    }
  };

  const platforms = Array.from(new Set(releases.map(r => r.platform)));

  const filteredReleases = releases.filter(r => {
    if (selectedPlatform === "all") return true;
    return r.platform === selectedPlatform;
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* 一键部署 */}
      {data.quickCopyCommand && (
        <div className="shrink-0 space-y-1.5 rounded-lg border bg-muted/40 p-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-mono font-medium text-foreground">
              <Terminal className="size-3.5" />
              推荐一键部署 / 安装脚本
            </span>
            <span className="text-xs text-muted-foreground">已核验官方签名源</span>
          </div>

          <div className="flex items-center justify-between gap-3 overflow-x-auto rounded-md border bg-background p-2">
            <code className="select-all truncate font-mono text-xs text-foreground">
              {data.quickCopyCommand}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(data.quickCopyCommand!, "quick-cmd")}
              className="h-6 shrink-0 gap-1 px-2 text-xs"
            >
              {copiedId === "quick-cmd" ? (
                <>
                  <Check />
                  <span>已复制</span>
                </>
              ) : (
                <>
                  <Copy />
                  <span>复制命令</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 平台过滤 */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        {platforms.length > 1 ? (
          <Tabs value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <TabsList>
              <TabsTrigger value="all">全平台架构 {releases.length}</TabsTrigger>
              {platforms.map(plat => (
                <TabsTrigger key={plat} value={plat}>
                  {getPlatformIcon(plat)}
                  <span className="capitalize">{plat}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <span className="text-xs text-muted-foreground">共 {releases.length} 个发行版本</span>
        )}

        <a
          href={data.officialSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          <span>官方 Release 发布页</span>
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* 发行版本清单：固定比例下一次全量呈现，不做内部滚动 */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {filteredReleases.map(rel => (
          <div
            key={rel.id}
            className={cn(
              "rounded-lg border p-2 transition-colors",
              rel.isRecommended
                ? "border-foreground/30 bg-muted/40"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <div className="mt-0.5 shrink-0 rounded-md bg-muted p-1.5 text-muted-foreground">
                  {getPlatformIcon(rel.platform)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {rel.platformLabel}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      v{rel.version || data.latestVersion}
                    </span>
                    {rel.isRecommended && <Badge>官方推荐</Badge>}
                  </div>

                  {rel.installCommand && (
                    <div className="mt-1.5 flex items-center justify-between gap-2 overflow-x-auto rounded-md border bg-muted/50 px-2 py-1.5">
                      <code className="select-all truncate font-mono text-xs text-foreground">
                        {rel.installCommand}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopy(rel.installCommand!, rel.id)}
                        title="复制命令"
                        aria-label="复制命令"
                        className="shrink-0"
                      >
                        {copiedId === rel.id ? <Check /> : <Copy />}
                      </Button>
                    </div>
                  )}

                  {rel.checksum && (
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      SHA256: {rel.checksum}
                    </div>
                  )}
                </div>
              </div>

              {rel.downloadUrl && (
                <a
                  href={rel.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "sm", className: "shrink-0" })}
                >
                  <Download />
                  <span>下载安装包</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 前置环境要求 */}
      {data.systemRequirements && (
        <div className="flex shrink-0 items-center gap-1.5 border-t border-border pt-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          <span>前置环境要求: {data.systemRequirements}</span>
        </div>
      )}
    </div>
  );
};
