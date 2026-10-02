import React, { useState } from "react";
import type { CompanyInfoData } from "./types.js";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import { companyInfoAdapter } from "./adapter.js";
import { WidgetContainer } from "../../core/WidgetContainer.js";
import {
  Building2,
  ExternalLink,
  MapPin,
  Calendar,
  User,
  TrendingUp,
  Globe,
  Share2,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export const CompanyInfoWidget: React.FC<ExtensionComponentProps<CompanyInfoData>> = ({
  data: customData,
  context
}) => {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [imgError, setImgError] = useState(false);

  const query = context.activeResult?.query || "";
  const info: CompanyInfoData =
    customData ??
    companyInfoAdapter.transform(query, context.activeResult);

  const isCompact = context.isCompact || context.size === 25 || !context.size;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${info.name} (${info.englishName || ""})\n${info.description}\n来源: ${info.sourceUrl || ""}`;
    if (context.copyText) {
      context.copyText(text);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSource = (e: React.MouseEvent) => {
    if (info.sourceUrl) {
      if (context.openUrl) {
        e.preventDefault();
        context.openUrl(info.sourceUrl);
      }
    }
  };

  // 1. 紧凑模式 (1/4 宽，25% 比例磁贴，与相关图片 75% 互补同行，精确贴合红框规格)
  if (isCompact) {
    return (
      <WidgetContainer
        widgetId="company_info"
        size={25}
        isCompact={true}
        title={info.name}
        subtitle={info.englishName && info.englishName !== info.name ? info.englishName : undefined}
        icon={<Building2 className="size-4 text-sky-400" />}
        badge={
          info.stockTicker ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
              {info.stockTicker}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              title="复制企业介绍"
              className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {copied ? <Check className="size-3 text-emerald-400" /> : <Share2 className="size-3" />}
            </button>
          </div>
        }
        className="w-full h-auto"
      >
        <div className="flex flex-col justify-between h-full gap-2.5">
          {/* 核心园区/大楼实景图 (Hero Image) */}
          {info.heroImage && !imgError && (
            <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-border/50 bg-muted/20 shrink-0">
              <img
                src={info.heroImage}
                alt={info.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </div>
          )}

          {/* 核心介绍段落 */}
          <p className="text-xs text-muted-foreground/90 leading-relaxed line-clamp-3 font-normal text-justify">
            {info.description}
          </p>

          {/* 核心关键事实属性徽标 */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] border-t border-border/40">
            {info.headquarters && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate" title={info.headquarters}>
                <MapPin className="size-3 text-sky-400 shrink-0" />
                <span className="truncate">{info.headquarters}</span>
              </div>
            )}
            {info.ceo && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate" title={info.ceo}>
                <User className="size-3 text-purple-400 shrink-0" />
                <span className="truncate">{info.ceo}</span>
              </div>
            )}
            {info.founded && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate" title={info.founded}>
                <Calendar className="size-3 text-emerald-400 shrink-0" />
                <span className="truncate">{info.founded}</span>
              </div>
            )}
            {info.industry && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate" title={info.industry}>
                <TrendingUp className="size-3 text-amber-400 shrink-0" />
                <span className="truncate">{info.industry}</span>
              </div>
            )}
          </div>

          {/* 溯源与官网直达链接 */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            {info.sourceUrl ? (
              <a
                href={info.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenSource}
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline font-medium cursor-pointer"
              >
                <span>• {info.sourceName || "维基百科"}</span>
                <ExternalLink className="size-2.5" />
              </a>
            ) : (
              <span>• 权威企业档案</span>
            )}
            {info.websiteUrl && (
              <a
                href={info.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground/80 hover:text-foreground inline-flex items-center gap-1"
              >
                <Globe className="size-2.5" />
                <span>官网</span>
              </a>
            )}
          </div>
        </div>
      </WidgetContainer>
    );
  }

  // 2. 标准展开模式 (50% 宽度以上)
  return (
    <WidgetContainer
      widgetId="company_info"
      size={context.size || 50}
      isCompact={false}
      title={info.name}
      subtitle={info.englishName && info.englishName !== info.name ? info.englishName : undefined}
      icon={<Building2 className="size-4 text-sky-400" />}
      badge={
        info.stockTicker ? (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40">
            {info.stockTicker}
          </span>
        ) : undefined
      }
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            title="复制企业介绍"
            className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Share2 className="size-3.5" />}
          </button>
        </div>
      }
      className="w-full h-auto"
    >
      <div className="flex flex-col gap-3.5">
        {/* 核心实景图 (Hero Image) */}
        {info.heroImage && !imgError && (
          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-border/50 shadow-xs bg-muted/20">
            <img
              src={info.heroImage}
              alt={info.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-center transition-transform duration-500 hover:scale-[1.02]"
              loading="lazy"
            />
          </div>
        )}

        {/* 核心详述段落 */}
        <p className="text-sm sm:text-[14.5px] text-foreground/90 leading-relaxed tracking-normal font-normal text-justify">
          {info.description}
        </p>

        {/* 溯源链接 */}
        <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-muted-foreground/60">•</span>
            {info.sourceUrl ? (
              <a
                href={info.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenSource}
                className="text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <span>{info.sourceName || "维基百科"}</span>
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span>权威档案</span>
            )}
          </div>

          {(info.headquarters || info.founded || info.ceo) && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] text-muted-foreground/70 hover:text-foreground inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{showDetails ? "收起核心属性" : "查看核心属性"}</span>
              {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}
        </div>

        {/* 展开的核心工商与业务事实属性 */}
        {showDetails && (
          <div className="mt-1 pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-in fade-in duration-200">
            {info.headquarters && (
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-center gap-2">
                <MapPin className="size-3.5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground">总部地点</div>
                  <div className="text-xs font-medium text-foreground truncate">{info.headquarters}</div>
                </div>
              </div>
            )}
            {info.founded && (
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-center gap-2">
                <Calendar className="size-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground">创立时间</div>
                  <div className="text-xs font-medium text-foreground truncate">{info.founded}</div>
                </div>
              </div>
            )}
            {info.ceo && (
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-center gap-2">
                <User className="size-3.5 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground">现任 CEO</div>
                  <div className="text-xs font-medium text-foreground truncate">{info.ceo}</div>
                </div>
              </div>
            )}
            {info.industry && (
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-center gap-2">
                <TrendingUp className="size-3.5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground">所属行业</div>
                  <div className="text-xs font-medium text-foreground truncate">{info.industry}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </WidgetContainer>
  );
};
