import React, { useState } from "react";
import { SearchResult } from "../../types.js";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Button, buttonVariants } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { ShieldCheck, ExternalLink, Sparkles, Copy, Check } from "lucide-react";

interface OfficialPortalWidgetProps {
  query: string;
  officialWebsite?: SearchResult;
  rawResultCount: number;
  filteredCount: number;
  isCompact?: boolean;
}

/**
 * 官方认证门户 / 检索概览 (official_portal)
 *
 * ===== 这一次重做解决的是什么 =====
 * 上一版是「域名行 → 标题 → 摘要 → 通栏按钮」的线性堆叠，问题是**主次颠倒**：
 * 这个组件存在的唯一理由是回答"在这么多结果里，点哪个才不是钓鱼站或镜像站"，
 * 而它把标题当成了主角、把域名压成了一行小字，用户扫一眼根本拿不到判断依据。
 *
 * 本版把信息层级按"用户真正要判断的事"重排：
 *
 *   · 站点身份区置于最高层级 —— 域名 + 「已认证」徽章 + 站点标记三者同行。
 *     域名用 font-mono 等宽呈现：山寨站惯用形近字母（rn/m、0/O、1/l）骗人，
 *     等宽字体让逐字符比对这件事真的做得成 —— 这是安全性，不是排版偏好。
 *   · 标题与摘要退居其次，且都被 line-clamp 收敛，不再让长标题挤走判断依据。
 *   · 动作条钉在卡片底部（mt-auto），只留两个真实动作：主跳转 + 复制链接。
 *     磁贴高度由清单比例给出下限、按内容让高，弹性留白因此落在中间而非底部，
 *     不会出现"按钮悬在半空"的松散感。
 *
 * 未匹配到官方站点时不再只丢两个数字，而是显式交代这是**回退态**
 * （"未匹配到明确的官方站点"）并给出本次检索的抓取 / 精选 / 过滤三项概览 ——
 * 沉默的空白会让人以为是加载失败，说明性的回退才让人知道发生了什么。
 *
 * 视觉上一律走 shadcn 语义令牌（bg-muted / text-muted-foreground / ring-foreground/10），
 * 无任何色相（项目为纯单色主题），不引入药丸圆角、不引入外部图标请求。
 */
export const OfficialPortalWidget: React.FC<OfficialPortalWidgetProps> = ({
  query,
  officialWebsite,
  rawResultCount,
  filteredCount,
  isCompact = false
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (url: string) => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (officialWebsite) {
    const url = officialWebsite.url;
    const domain = domainOf(officialWebsite);

    return (
      <IOSWidget
        id="widget-official-portal"
        title="官方认证门户"
        icon={<ShieldCheck className="size-4" />}
        className="w-full"
      >
        <div className="flex flex-1 flex-col gap-3">
          {/* 站点身份区：本组件的判断依据，位置和字号都为它让路 */}
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-foreground ring-1 ring-foreground/10",
                isCompact ? "size-9 text-sm" : "size-10 text-base"
              )}
            >
              {monogramOf(domain)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-medium text-foreground">
                  {domain}
                </span>
                <Badge variant="outline" className="shrink-0">
                  <ShieldCheck />
                  已认证
                </Badge>
              </div>
              {!isCompact && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">官方主站入口</p>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <h4 className="line-clamp-2 text-sm font-semibold leading-5 tracking-tight text-foreground">
              {officialWebsite.title}
            </h4>
            {officialWebsite.snippet && (
              <p
                className={cn(
                  "text-xs leading-5 text-muted-foreground",
                  isCompact ? "line-clamp-2" : "line-clamp-3"
                )}
              >
                {officialWebsite.snippet}
              </p>
            )}
          </div>

          {/* mt-auto：把动作条钉在卡片底部，弹性留白全部落在内容与动作之间 */}
          <div className="mt-auto flex flex-col gap-2">
            {!isCompact && rawResultCount > 0 && (
              <p className="truncate text-xs text-muted-foreground">
                已从 {rawResultCount} 条检索结果中甄别出该官方入口
              </p>
            )}
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={url}
                className={buttonVariants({ className: "flex-1 shrink min-w-0" })}
              >
                <span className="truncate">直达官方网站</span>
                <ExternalLink />
              </a>
              <Button
                variant="outline"
                onClick={() => handleCopy(url)}
                className="shrink-0"
                aria-label="复制官方网站链接"
              >
                {copied ? <Check /> : <Copy />}
                <span>{copied ? "已复制" : "复制"}</span>
              </Button>
            </div>
          </div>
        </div>
      </IOSWidget>
    );
  }

  return (
    <IOSWidget
      id="widget-entity-overview"
      title="检索概览"
      icon={<Sparkles className="size-4" />}
      className="w-full"
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">检索主题</span>
          <h4 className="line-clamp-2 text-sm font-semibold leading-5 tracking-tight text-foreground">
            {query}
          </h4>
          <p className="text-xs leading-5 text-muted-foreground">
            本次检索未匹配到明确的官方站点
          </p>
        </div>

        <div
          className={cn(
            "mt-auto grid gap-3",
            isCompact ? "grid-cols-2" : "grid-cols-3"
          )}
        >
          <StatCell label="原始抓取" value={rawResultCount} />
          <StatCell label="精选信源" value={filteredCount} />
          {!isCompact && (
            <StatCell label="已过滤" value={Math.max(0, rawResultCount - filteredCount)} />
          )}
        </div>
      </div>
    </IOSWidget>
  );
};

/** 展示用域名：优先用后端归一化过的 displayDomain，回退到 URL 主机名，再回退到原始串 */
function domainOf(result: SearchResult): string {
  if (result.displayDomain) return result.displayDomain;
  try {
    return new URL(result.url).hostname;
  } catch {
    return result.url;
  }
}

/** 站点标记字母：去掉 www. 取首字符，比再放一个通用图标更有辨识度 */
function monogramOf(domain: string): string {
  const bare = domain.replace(/^www\./i, "");
  return (bare[0] || "?").toUpperCase();
}

/** 概览数值单元：muted 标签 + tabular-nums 数值 */
const StatCell: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="truncate text-xs text-muted-foreground">{label}</span>
    <span className="flex items-baseline gap-0.5">
      <span className="font-mono text-lg font-semibold leading-none tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">条</span>
    </span>
  </div>
);
