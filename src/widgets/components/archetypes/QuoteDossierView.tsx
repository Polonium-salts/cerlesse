import React, { useState } from "react";
import { QuoteDossierData, QuoteDossierItem } from "../../../types.js";
import { ExternalLink, ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import { WuEmpty } from "../../../components/ui/widget-composites.js";

interface QuoteDossierViewProps {
  data: QuoteDossierData;
  themeColor?: string;
  onUpdateData?: (updated: QuoteDossierData) => void;
}

/**
 * 言论档案视图 (quote_dossier)
 *
 * shadcn/ui 重做要点：
 *   · 立场过滤由「一排描边药丸」改为 Tabs 分段控件，与清单视图共用同一控件语汇；
 *   · 言论主体不再套白底大圆角卡，改用**左侧竖线引注**（border-l-2 + pl-3）：
 *     引文在 shadcn 排版里靠缩进与竖线区隔，而不是再叠一层卡片边框；
 *   · 立场标签（正向肯定 / 谨慎提示 / 客观中立）在纯单色主题下**不能用色相区分**，
 *     因此统一收敛为 outline 徽章，语义交由文案承担 —— 靠颜色编码在同一灰度下必然失效；
 *   · 权威标记保留语义对照：已验证 = secondary 实心、资深代表 = outline 描边；
 *   · 背景透视改为 bg-muted/50 的弱化引用块，移除全部 zinc-* / emerald-* / blue-* / amber-* 硬编码色。
 *
 * themeColor 入参保留但不再参与渲染（锻造侧数据契约不动）。
 */
export const QuoteDossierView: React.FC<QuoteDossierViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData: _onUpdateData
}) => {
  const [stanceFilter, setStanceFilter] = useState<"all" | "support" | "caution" | "neutral">("all");

  const quotes = data.quotes || [];

  const filteredQuotes = quotes.filter(q => {
    if (stanceFilter === "all") return true;
    return q.stance === stanceFilter;
  });

  const stanceLabel = (stance?: string) =>
    stance === "support" ? "正向肯定" : stance === "caution" ? "谨慎提示" : "客观中立";

  return (
    <div className="flex flex-col gap-3">
      {/* 立场透视：与清单视图同款分段控件 */}
      <Tabs
        value={stanceFilter}
        onValueChange={value => setStanceFilter(value as "all" | "support" | "caution" | "neutral")}
        className="rounded-lg border bg-muted/40 p-3"
      >
        <span className="text-xs text-muted-foreground">立场透视</span>
        <TabsList className="w-full">
          <TabsTrigger value="all">全部 {quotes.length}</TabsTrigger>
          <TabsTrigger value="support">
            正向支持 {quotes.filter(q => q.stance === "support").length}
          </TabsTrigger>
          <TabsTrigger value="caution">
            谨慎提醒 {quotes.filter(q => q.stance === "caution").length}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 言论流 */}
      <div className="flex flex-col gap-3">
        {filteredQuotes.map((item: QuoteDossierItem) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {item.speaker}
                </span>
                {item.titleOrRole && (
                  <span className="truncate text-xs text-muted-foreground">
                    · {item.titleOrRole}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {item.authorityLevel === "verified" && (
                  <Badge variant="secondary">
                    <ShieldCheck />
                    权威认证
                  </Badge>
                )}
                {item.authorityLevel === "high" && (
                  <Badge variant="outline">
                    <UserCheck />
                    资深代表
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{stanceLabel(item.stance)}</span>
              </div>
            </div>

            {/* 引注：竖线 + 缩进，不再塞引号图标 */}
            <blockquote className="border-l-2 border-border pl-3 text-sm italic leading-relaxed text-foreground">
              “{item.quote}”
            </blockquote>

            <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="truncate">
                出处背景: {item.organizationOrSource || "行业评测档案"}
              </span>

              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  <span>查验证据</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            {item.contextSnippet && (
              <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground">
                背景透视: {item.contextSnippet}
              </p>
            )}
          </div>
        ))}

        {filteredQuotes.length === 0 && <WuEmpty>未检索到该立场下的言论档案</WuEmpty>}
      </div>
    </div>
  );
};
