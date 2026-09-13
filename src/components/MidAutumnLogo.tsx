import React from "react";

interface MidAutumnLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSubtitle?: boolean;
  imageSrc?: string;
}

/**
 * 中秋节专属大型高精矢量插画 Logo 组件
 * 包含极其鲜明突出的中秋传统图形元素：
 * 1. 皓月当空（高光满月与月影浮动）
 * 2. 灵动白玉兔（长耳仰月、绒毛微光）
 * 3. 金桂枝桠与飘落桂花（玉兔折桂、暗香浮动）
 * 4. 喜庆中秋宫灯与如意流苏（红金相映、节日暖光）
 * 5. 广式经典雕花金黄月饼（香烤纹路）
 * 6. 飘渺层叠祥云（仙气缭绕）
 * 7. 品牌 Logo (favicon.png) 熔铸为明月核心的流光灵宝
 */
export const MidAutumnTextTemplateLogo: React.FC<MidAutumnLogoProps> = ({
  size = "md",
  className = "",
  showSubtitle = true,
  imageSrc = "/favicon.png"
}) => {
  const isLarge = size === "lg" || size === "xl";
  const isXLarge = size === "xl";

  // 尺寸与排版参数配置
  const config = {
    sm: {
      height: "h-10",
      graphicWidth: 64,
      graphicHeight: 40,
      textSize: "text-xl",
      tagText: "text-[10px] px-1.5 py-0.5",
      sealSize: 15,
      brandOffset: "gap-2"
    },
    md: {
      height: "h-14",
      graphicWidth: 90,
      graphicHeight: 56,
      textSize: "text-2xl sm:text-3xl",
      tagText: "text-xs px-2 py-0.5",
      sealSize: 18,
      brandOffset: "gap-3"
    },
    lg: {
      height: "h-20",
      graphicWidth: 130,
      graphicHeight: 80,
      textSize: "text-3xl sm:text-4xl",
      tagText: "text-xs px-2.5 py-1",
      sealSize: 22,
      brandOffset: "gap-4"
    },
    xl: {
      height: "h-28 sm:h-36",
      graphicWidth: 190,
      graphicHeight: 120,
      textSize: "text-4xl sm:text-6xl",
      tagText: "text-xs sm:text-sm px-3 py-1",
      sealSize: 28,
      brandOffset: "gap-5"
    }
  }[size];

  return (
    <div
      className={`relative inline-flex items-center select-none group transition-all duration-300 ${config.height} ${className}`}
    >
      {/* 
        ==================================================================
        核心中秋图形区：皓月 + 玉兔 + 桂树金枝 + 宫灯 + 月饼 + 祥云
        ==================================================================
      */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-105"
        style={{ width: config.graphicWidth, height: config.graphicHeight }}
      >
        <svg
          viewBox="0 0 200 130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible filter drop-shadow-[0_4px_12px_rgba(217,119,6,0.3)]"
        >
          <defs>
            {/* 1. 金满月渐变 */}
            <radialGradient id="midMoonGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#FFFBEB" />
              <stop offset="55%" stopColor="#FEF08A" />
              <stop offset="85%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </radialGradient>

            {/* 2. 月晕暖金弥散发光 */}
            <radialGradient id="midHaloGrad" cx="50%" cy="50%" r="50%">
              <stop offset="30%" stopColor="#FEF08A" stopOpacity="0.8" />
              <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
            </radialGradient>

            {/* 3. 灵动白玉兔渐变（白玉光泽与粉耳柔和渐变） */}
            <linearGradient id="midRabbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>

            {/* 4. 宫灯金红渐变 */}
            <linearGradient id="midLanternGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>

            {/* 5. 祥云流金渐变 */}
            <linearGradient id="midCloudGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#FEF08A" stopOpacity="0.9" />
              <stop offset="80%" stopColor="#FCA5A5" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.3" />
            </linearGradient>

            {/* 6. 月饼焦香渐变 */}
            <radialGradient id="midCakeGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="80%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#78350F" />
            </radialGradient>

            {/* 7. 桂花金黄渐变 */}
            <linearGradient id="midOsmanthusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="60%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
          </defs>

          {/* ================= 1. 金满月与月晕 ================= */}
          {/* 外圈弥散大光晕 */}
          <circle cx="95" cy="65" r="62" fill="url(#midHaloGrad)" />

          {/* 实体金黄色满月 */}
          <circle cx="95" cy="65" r="48" fill="url(#midMoonGrad)" />

          {/* 月球表面唯美阴影纹理 */}
          <path
            d="M80 35 C70 42, 68 55, 74 65 C78 72, 70 82, 60 85 C65 92, 76 96, 85 96 C110 96, 130 78, 130 55 C130 45, 124 38, 116 35 C108 32, 90 30, 80 35 Z"
            fill="#D97706"
            opacity="0.14"
          />
          <ellipse cx="118" cy="72" rx="14" ry="10" fill="#B45309" opacity="0.1" />

          {/* ================= 2. 金桂树枝桠与桂花 (左上角拂过明月) ================= */}
          {/* 桂树枝干 */}
          <path
            d="M 25 15 Q 55 22, 75 38 Q 95 44, 115 32"
            stroke="#92400E"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 55 22 Q 68 12, 82 14"
            stroke="#92400E"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 85 41 Q 98 48, 108 45"
            stroke="#92400E"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {/* 桂树叶片（翡翠碧玉色） */}
          <path d="M 45 18 Q 50 12, 56 16 Q 52 22, 45 18 Z" fill="#15803D" opacity="0.85" />
          <path d="M 68 25 Q 74 18, 80 23 Q 76 29, 68 25 Z" fill="#16A34A" opacity="0.9" />
          <path d="M 92 36 Q 98 30, 104 35 Q 100 41, 92 36 Z" fill="#15803D" opacity="0.85" />
          <path d="M 75 13 Q 80 8, 86 12 Q 82 17, 75 13 Z" fill="#22C55E" opacity="0.9" />

          {/* 盛开的金桂花簇（四瓣金桂） */}
          {/* 桂花簇 1 */}
          <g transform="translate(58, 16) scale(0.9)">
            <circle cx="4" cy="1" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="1" cy="4" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="7" cy="4" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="4" cy="7" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="4" cy="4" r="1.2" fill="#EA580C" />
          </g>
          {/* 桂花簇 2 */}
          <g transform="translate(80, 28) scale(1.1)">
            <circle cx="4" cy="1" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="1" cy="4" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="7" cy="4" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="4" cy="7" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="4" cy="4" r="1.2" fill="#EA580C" />
          </g>
          {/* 桂花簇 3 */}
          <g transform="translate(106, 32) scale(0.85)">
            <circle cx="4" cy="1" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="1" cy="4" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="7" cy="4" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="4" cy="7" r="2.2" fill="url(#midOsmanthusGrad)" />
            <circle cx="4" cy="4" r="1.2" fill="#EA580C" />
          </g>

          {/* 飘落随风轻舞的单朵金桂 */}
          <g transform="translate(42, 45) rotate(25) scale(0.75)">
            <circle cx="4" cy="1" r="2.2" fill="#FEF08A" />
            <circle cx="1" cy="4" r="2.2" fill="#FEF08A" />
            <circle cx="7" cy="4" r="2.2" fill="#FEF08A" />
            <circle cx="4" cy="7" r="2.2" fill="#FEF08A" />
            <circle cx="4" cy="4" r="1" fill="#EA580C" />
          </g>
          <g transform="translate(125, 52) rotate(-15) scale(0.7)">
            <circle cx="4" cy="1" r="2.2" fill="#FDE047" />
            <circle cx="1" cy="4" r="2.2" fill="#FDE047" />
            <circle cx="7" cy="4" r="2.2" fill="#FDE047" />
            <circle cx="4" cy="7" r="2.2" fill="#FDE047" />
            <circle cx="4" cy="4" r="1" fill="#EA580C" />
          </g>

          {/* ================= 3. 悬挂中秋古典宫灯 (右侧优雅垂落) ================= */}
          <g transform="translate(142, 10)">
            {/* 悬挂金丝 */}
            <line x1="16" y1="0" x2="16" y2="18" stroke="#F59E0B" strokeWidth="1.2" />

            {/* 宫灯顶盖金顶 */}
            <path d="M 8 18 Q 16 13, 24 18 L 26 21 L 6 21 Z" fill="#B45309" stroke="#FEF08A" strokeWidth="0.8" />
            <circle cx="16" cy="14" r="2" fill="#FEF08A" />

            {/* 宫灯红六角灯体 */}
            <path
              d="M 7 21 C 4 28, 4 36, 8 42 L 24 42 C 28 36, 28 28, 25 21 Z"
              fill="url(#midLanternGrad)"
              stroke="#FDE047"
              strokeWidth="1.2"
            />
            {/* 灯面金丝花格 */}
            <line x1="16" y1="21" x2="16" y2="42" stroke="#FEF08A" strokeWidth="1" opacity="0.85" />
            <path d="M 10 31 Q 16 34, 22 31" stroke="#FEF08A" strokeWidth="0.9" fill="none" opacity="0.85" />

            {/* 灯底金托与红色流苏 */}
            <rect x="10" y="42" width="12" height="3" rx="1" fill="#B45309" stroke="#FEF08A" strokeWidth="0.8" />
            {/* 摇曳流苏 */}
            <line x1="16" y1="45" x2="16" y2="60" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
            <line x1="13" y1="45" x2="14" y2="56" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="19" y1="45" x2="18" y2="56" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="16" cy="50" r="1.5" fill="#FEF08A" />
          </g>

          {/* ================= 4. 底层中秋流云祥云（层叠仙境） ================= */}
          {/* 后层祥云 */}
          <path
            d="M 20 102 C 35 90, 60 92, 75 98 C 90 92, 120 92, 135 100 C 150 96, 175 100, 185 108 L 185 125 L 20 125 Z"
            fill="url(#midCloudGrad)"
            opacity="0.7"
          />
          {/* 前层翻卷如意祥云 */}
          <path
            d="M 10 110 C 20 98, 40 96, 52 102 C 60 94, 80 94, 90 100 C 105 95, 125 98, 135 106 C 145 102, 165 104, 175 115 C 175 125, 20 125, 10 125 Z"
            fill="url(#midCloudGrad)"
            opacity="0.95"
          />
          {/* 祥云如意卷纹金线 */}
          <path
            d="M 25 112 Q 38 104, 50 110 M 70 106 Q 85 98, 100 105 M 120 108 Q 135 102, 148 110"
            stroke="#FDE68A"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />

          {/* ================= 5. 左下角：立体雕花传统金黄月饼 ================= */}
          <g transform="translate(32, 84) scale(0.38)">
            {/* 12 花瓣月饼外齿轮 */}
            <path
              d="M 50 4 C 54 4, 57 8, 61 7 C 65 6, 69 11, 72 13 C 76 15, 81 18, 83 22 C 86 26, 88 32, 91 36 C 93 40, 96 46, 96 50 C 96 54, 93 60, 91 64 C 88 68, 86 74, 83 78 C 81 82, 76 85, 72 87 C 69 89, 65 94, 61 93 C 57 92, 54 96, 50 96 C 46 96, 43 92, 39 93 C 35 94, 31 89, 28 87 C 24 85, 19 82, 17 78 C 14 74, 12 68, 9 64 C 7 60, 4 54, 4 50 C 4 46, 7 40, 9 36 C 12 32, 14 26, 17 22 C 19 18, 24 15, 28 13 C 31 11, 35 6, 39 7 C 43 8, 46 4, 50 4 Z"
              fill="url(#midCakeGrad)"
              stroke="#FDE68A"
              strokeWidth="4"
            />
            {/* 月饼内圈回纹与花瓣吉祥印 */}
            <circle cx="50" cy="50" r="32" stroke="#FEF08A" strokeWidth="2.5" fill="none" opacity="0.9" />
            <circle cx="50" cy="50" r="18" fill="url(#midCakeGrad)" stroke="#78350F" strokeWidth="2" />
            <path
              d="M 50 36 L 50 64 M 36 50 L 64 50 M 40 40 L 60 60 M 60 40 L 40 60"
              stroke="#78350F"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="5" fill="#FEF08A" />
          </g>

          {/* ================= 6. 核心主角：栩栩如生的白玉兔（仰望明月） ================= */}
          <g transform="translate(82, 54)">
            {/* 玉兔微光外发光 */}
            <path
              d="M 28 42 C 22 34, 16 38, 14 46 C 12 54, 18 64, 28 66 C 38 68, 48 64, 52 56 C 54 48, 46 40, 36 38 Z"
              fill="#FFFFFF"
              opacity="0.3"
              filter="blur(3px)"
            />

            {/* 玉兔身体 (丰满软萌坐姿) */}
            <path
              d="M 28 42 C 20 35, 14 40, 12 48 C 10 56, 16 66, 26 67 C 38 68, 48 64, 52 56 C 55 46, 46 38, 36 37 Z"
              fill="url(#midRabbitGrad)"
            />

            {/* 玉兔小绒球尾巴 */}
            <circle cx="9" cy="52" r="5" fill="#FFFFFF" />

            {/* 玉兔头部 (微昂首仰望右上明月与星空) */}
            <ellipse cx="38" cy="30" rx="10" ry="9" transform="rotate(-15 38 30)" fill="url(#midRabbitGrad)" />

            {/* 玉兔前爪 (微曲收拢) */}
            <ellipse cx="44" cy="46" rx="4" ry="7" transform="rotate(-30 44 46)" fill="#FFFFFF" />

            {/* 玉兔长耳朵 1 (前耳灵动直立) */}
            <path
              d="M 36 24 C 33 10, 32 0, 37 0 C 42 0, 43 10, 40 22 Z"
              fill="#FFFFFF"
            />
            {/* 耳窝粉嫩渐变 */}
            <path
              d="M 36.5 20 C 34.5 9, 34 2, 37 2 C 40 2, 40.5 9, 39 18 Z"
              fill="#FECDD3"
            />

            {/* 玉兔长耳朵 2 (后耳微斜) */}
            <path
              d="M 31 26 C 26 14, 24 5, 29 4 C 33 3, 36 12, 35 24 Z"
              fill="#F1F5F9"
            />
            <path
              d="M 31.5 22 C 28 13, 26 7, 29.5 6 C 32 5, 33.5 12, 33 20 Z"
              fill="#FDA4AF"
            />

            {/* 玉兔红宝石眼睛 */}
            <ellipse cx="42" cy="28" rx="1.6" ry="2" fill="#E11D48" />
            <circle cx="42.5" cy="27.5" r="0.6" fill="#FFFFFF" />

            {/* 玉兔小粉鼻 */}
            <circle cx="47" cy="31" r="1.2" fill="#FDA4AF" />
          </g>

          {/* ================= 7. 闪烁中秋星芒 (四角星芒散落) ================= */}
          <path d="M 30 35 L 32 39 L 36 41 L 32 43 L 30 47 L 28 43 L 24 41 L 28 39 Z" fill="#FEF08A" opacity="0.9" />
          <path d="M 160 70 L 161.5 73 L 165 74.5 L 161.5 76 L 160 79 L 158.5 76 L 155 74.5 L 158.5 73 Z" fill="#FEF08A" opacity="0.85" />
          <path d="M 125 15 L 126 17 L 128 18 L 126 19 L 125 21 L 124 19 L 122 18 L 124 17 Z" fill="#FFF" opacity="0.9" />
        </svg>

        {/* 
          品牌核心 Logo 徽章：化身为月亮光芒中心的流光玉璧印记 (无棱角完美融合)
        */}
        <div
          className="absolute rounded-full overflow-hidden p-[1.5px] bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.5)] border border-amber-300/80 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
          style={{
            width: isLarge ? 26 : 18,
            height: isLarge ? 26 : 18,
            top: "18%",
            left: "40%"
          }}
          title="Cerlesse 品牌灵宝"
        >
          <img
            src={imageSrc}
            alt="Cerlesse"
            className="w-full h-full object-cover rounded-full select-none"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.png";
            }}
          />
        </div>
      </div>

      {/* 
        ==================================================================
        品牌文本与中秋节日排版区
        ==================================================================
      */}
      <div className={`relative z-10 flex flex-col justify-center text-left ${config.brandOffset}`}>
        <div className="flex items-center gap-2">
          {/* 烫金书法风格品牌主标题 */}
          <span
            className={`font-serif font-extrabold tracking-tight bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 dark:from-amber-300 dark:via-yellow-100 dark:to-amber-400 bg-clip-text text-transparent drop-shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${config.textSize}`}
          >
            Cerlesse
          </span>

          {/* 右侧：中秋朱红古风印章 + 节日特供胶囊标 */}
          <div className="flex items-center gap-1.5">
            {/* 古风朱红中秋雕刻印章 */}
            <div
              className="inline-flex items-center justify-center rounded-[3px] bg-gradient-to-br from-red-600 to-red-800 text-amber-100 border border-amber-300/60 shadow-xs font-serif font-bold transition-transform group-hover:scale-105"
              style={{
                width: config.sealSize,
                height: config.sealSize,
                fontSize: size === "sm" ? 9 : size === "md" ? 11 : size === "lg" ? 13 : 15
              }}
              title="中秋节传统印章"
            >
              秋
            </div>

            {/* 节日特供微型徽标 */}
            <div
              className={`inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 text-amber-800 dark:text-amber-200 font-medium shadow-2xs font-serif ${config.tagText}`}
            >
              <span>🥮</span>
              <span>中秋</span>
            </div>
          </div>
        </div>

        {/* 首页大 Banner 专属：中秋诗意排版副标 */}
        {showSubtitle && isLarge && (
          <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-amber-700/90 dark:text-amber-300/90 font-serif tracking-widest pl-0.5">
            <span className="text-amber-500 text-[10px]">✦</span>
            <span>月满中秋 · 智搜千里</span>
            {isXLarge && <span className="hidden sm:inline">· 阖家团圆</span>}
            <span className="text-amber-500 text-[10px]">✦</span>
          </div>
        )}
      </div>
    </div>
  );
};
