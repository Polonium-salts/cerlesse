import React, { useMemo } from "react";
import { Badge } from "./ui/badge.js";
import { MidAutumnTextTemplateLogo } from "./MidAutumnLogo.js";
import { isMidAutumnFestival } from "../utils/festivalTheme.js";

interface GoogleLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
  badgeText?: string;
  /**
   * 追加到 “Agent” 徽标上的类名（例如顶栏在窄屏下传 `hidden sm:inline-flex`）。
   * 徽标在组件内部，外部无法用选择器定位，所以从属性透出。
   */
  badgeClassName?: string;
  /**
   * 允许强制指定主题模式：
   * - "auto": 默认行为，仅在中秋节期间自动加载中秋主题 Logo，平时加载标准 Logo
   * - "midautumn": 强制加载中秋节主题 Logo
   * - "standard": 强制加载日常标准 Logo
   */
  themeMode?: "auto" | "midautumn" | "standard";
}

export const GoogleLogo: React.FC<GoogleLogoProps> = ({
  size = "md",
  className = "",
  showBadge = true,
  badgeText,
  badgeClassName = "",
  themeMode = "auto"
}) => {
  // 判定是否应当激活中秋节特色 Logo
  const isMidAutumnActive = useMemo(() => {
    if (themeMode === "midautumn") return true;
    if (themeMode === "standard") return false;
    return isMidAutumnFestival();
  }, [themeMode]);

  // 1. 中秋节期间：展示中秋专属主题 Logo
  if (isMidAutumnActive) {
    return (
      <MidAutumnTextTemplateLogo
        size={size}
        className={className}
        showSubtitle={showBadge}
      />
    );
  }

  // 2. 非中秋节日常期间：加载标准 Cerlesse 品牌 Logo
  const iconSizeClasses = {
    sm: "w-7 h-7 rounded-lg",
    md: "w-8 h-8 sm:w-9 sm:h-9 rounded-lg",
    lg: "w-10 h-10 sm:w-12 sm:h-12 rounded-xl",
    xl: "w-14 h-14 sm:w-20 sm:h-20 rounded-xl"
  };

  const textClasses = {
    sm: "text-base sm:text-lg font-medium tracking-tight",
    md: "text-lg sm:text-2xl font-medium tracking-tight",
    lg: "text-2xl sm:text-4xl font-medium tracking-tight",
    xl: "text-3xl sm:text-5xl font-medium tracking-tight"
  };

  const badgeTextClasses = {
    sm: "text-[10px] sm:text-xs",
    md: "text-xs",
    lg: "text-xs",
    xl: "text-xs sm:text-sm"
  };

  const defaultBadge = badgeText || "Agent";

  return (
    <div
      className={`select-none ${
        size === "xl"
          ? "inline-flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 text-center sm:text-left"
          : "inline-flex items-center gap-2 sm:gap-3"
      } ${className}`}
    >
      <div
        className={`flex items-center justify-center overflow-hidden border border-border bg-card shrink-0 shadow-2xs ${iconSizeClasses[size]}`}
      >
        <img
          src="/favicon.png"
          alt="Cerlesse"
          className="w-full h-full object-contain p-0.5 shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/logo.png";
          }}
        />
      </div>

      <div className={`flex items-center gap-2 ${size === "xl" ? "justify-center sm:justify-start" : ""}`}>
        <span className={`text-foreground tracking-tight font-medium ${textClasses[size]}`}>
          Cerlesse
        </span>

        {showBadge && (
          <Badge
            variant="secondary"
            className={`self-center shrink-0 whitespace-nowrap ${badgeTextClasses[size]} ${badgeClassName}`}
          >
            {defaultBadge}
          </Badge>
        )}
      </div>
    </div>
  );
};
