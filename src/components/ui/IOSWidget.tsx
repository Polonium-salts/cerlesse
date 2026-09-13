import React from "react";
import { cn } from "../../lib/utils.js";
import { WidgetPlannedSize } from "../../types.js";

interface IOSWidgetProps {
  id?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  size?: WidgetPlannedSize | "wide";
  onResize?: (size: WidgetPlannedSize | "wide") => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
  noPadding?: boolean;
  onClick?: () => void;
}

/**
 * 测量内容宿主是否溢出。
 *
 * ===== 为什么不再做「等比缩放」 =====
 * 此前内容一旦高于可用高度，整块内容就 transform: scale() 缩小（下限 0.62）。
 * 后果是**同一个组件的字号会随内容多寡浮动**：信源少时正文 14px，
 * 信源多时被压到 8.7px —— 用户看到的就是"有的磁贴字大、有的字小"。
 * 磁贴尺寸本已由插件清单的 grid.ratio 固定，字号若再由内容量二次决定，
 * 等于把排版权交给数据，视觉必然失控。
 *
 * 现在改为：**字号恒定 100%**。内容装不下时不再缩小字号，而是由桌面视图
 * 实测超出量并给磁贴让高（见 TileDesktopView 的实测回路）—— 因此这里测出的
 * 同一个"超出量"既是渐隐层的开关，也是磁贴增高的依据。
 *
 * 测量的前提是内容根不参与 flex 收缩（见下方刻意不写 min-h-0），
 * 因此 host 的 scrollHeight 能如实反映内容总高度 —— 此前正是因为
 * 内容根带 min-h-0 被压扁，scrollHeight 恒等于容器高度，才不得不
 * 用"临时摘掉高度约束再量一次"的迂回办法。
 */
function useContentBox() {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = React.useState(false);

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      // host 带 overflow: hidden，scrollHeight 即内容总高度（含溢出部分）
      const next = host.scrollHeight > host.clientHeight + 1;
      setOverflowing(prev => (prev === next ? prev : next));
    };

    // 探测含强制回流，而流式输出期间 mutation 极其密集 —— 合并到下一帧执行
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(host);
    const mo = new MutationObserver(schedule);
    mo.observe(host, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return { hostRef, overflowing };
}

export const IOSWidget: React.FC<IOSWidgetProps> = ({
  id,
  title,
  subtitle,
  icon,
  badge,
  actions,
  size,
  onResize,
  className,
  headerClassName,
  contentClassName,
  children,
  noPadding = false,
  onClick
}) => {
  const hasHeader = Boolean(title || icon || badge || actions || onResize);
  const isSmall = size === "small";
  const { hostRef, overflowing } = useContentBox();

  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        // shadcn/ui Card 语汇：rounded-xl + bg-card + ring-1 ring-foreground/10，无色相、无重投影
        "group/card relative flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-sm ring-1 ring-foreground/10 transition-shadow",
        onClick && "cursor-pointer hover:ring-foreground/20",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 pt-4 pb-3",
            isSmall && "px-3 pt-3 pb-2",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span className={cn(
                // shadcn 卡片标题不带图标底盒：裸图标、弱化为 muted-foreground
                "flex items-center justify-center shrink-0 text-muted-foreground",
                isSmall ? "w-3.5 h-3.5" : "w-4 h-4"
              )}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {title && (
                  <h3 className={cn(
                    "font-semibold leading-none tracking-tight truncate",
                    isSmall ? "text-xs" : "text-sm"
                  )}>
                    {title}
                  </h3>
                )}
                {badge}
              </div>
              {subtitle && !isSmall && (
                <p className="text-muted-foreground truncate mt-1 text-xs">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pl-1">
            {/* 比例与宽度由组件固有属性固定，组件内部不再提供任何调节入口 */}
            {actions}
          </div>
        </div>
      )}

      <div
        ref={hostRef}
        data-ios-content-host=""
        className={cn(
          // 内容宿主：overflow:hidden 让它成为一个可测量容器 ——
          // scrollHeight 如实反映内容的自然高度，桌面视图据此量出"还差多少像素装不下"
          // 并回灌求解器给磁贴让高（见 TileDesktopView 的实测回路）。
          // 底部渐隐只是最后兜底：正常路径下磁贴会先被撑到刚好容纳。
          // 内容区一律禁止滚动，装不下的部分宁可增高磁贴，也不缩小字号。
          "relative flex flex-1 min-h-0 flex-col overflow-hidden",
          !noPadding && (isSmall ? "px-3 pb-3" : "px-4 pb-4"),
          hasHeader && !noPadding && (isSmall ? "pt-0.5" : "pt-0"),
          contentClassName
        )}
      >
        {/* 刻意不写 min-h-0 / overflow：让内容根在空间不足时「溢出」而非被压扁，
            这样超出部分才会落到 host 的 overflow: hidden 之外被裁掉，
            同时也让 host 的 scrollHeight 得以如实反映内容总高度 */}
        <div className="flex flex-1 flex-col">{children}</div>

        {overflowing && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent"
          />
        )}
      </div>
    </div>
  );
};
