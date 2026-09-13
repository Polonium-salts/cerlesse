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
    md: "w-9 h-9 rounded-lg",
    lg: "w-12 h-12 rounded-xl",
    xl: "w-16 h-16 sm:w-20 sm:h-20 rounded-xl"
  };

  const textClasses = {
    sm: "text-lg font-medium tracking-tight",
    md: "text-xl sm:text-2xl font-medium tracking-tight",
    lg: "text-3xl sm:text-4xl font-medium tracking-tight",
    xl: "text-4xl sm:text-5xl font-medium tracking-tight"
  };

  const badgeTextClasses = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-xs",
    xl: "text-sm"
  };

  const defaultBadge = badgeText || "Agent";

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div
        className={`flex items-center justify-center overflow-hidden border border-border bg-card shrink-0 shadow-2xs ${iconSizeClasses[size]}`}
      >
        <img
          src="/favicon.png"
          alt="Cerlesse"
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/logo.png";
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-foreground tracking-tight font-medium ${textClasses[size]}`}>
          Cerlesse
        </span>

        {showBadge && (
          <Badge variant="secondary" className={`self-center ${badgeTextClasses[size]}`}>
            {defaultBadge}
          </Badge>
        )}
      </div>
    </div>
  );
};
