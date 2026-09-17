import React from "react";
import { cn } from "../../lib/utils.js";
import type { TileWidth } from "../../lib/tileLayoutEngine.js";

interface IOSWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  size?: TileWidth;
  onResize?: (size: TileWidth) => void;
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
  onClick,
  ...rest
}) => {
  const hasHeader = Boolean(title || icon || badge || actions || onResize);
  const isSmall = size === 25;
  const { hostRef, overflowing } = useContentBox();

  return (
    <div
      id={id}
      onClick={onClick}
      {...rest}
      className={cn(
        // shadcn/ui Card 语汇：加大圆角 rounded-2xl md:rounded-3xl + bg-card + border border-border/80 + shadow-xs 纯单色现代感
        "group/card relative flex flex-col overflow-hidden rounded-2xl md:rounded-3xl border border-border/80 bg-card text-card-foreground text-sm shadow-xs transition-all duration-200",
        onClick && "cursor-pointer hover:border-foreground/20 hover:shadow-sm",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5 border-b border-border/40 sm:px-5 sm:pt-4 sm:pb-3",
            isSmall && "px-3 pt-2.5 pb-2",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className={cn(
                // shadcn 小组件预设图标盒：微圆角 bg-muted + 细微边框 + text-muted-foreground
                "flex items-center justify-center shrink-0 rounded-xl bg-muted/70 text-muted-foreground border border-border/40 transition-colors group-hover/card:text-foreground",
                isSmall ? "size-6 [&_svg]:size-3.5" : "size-7 [&_svg]:size-4"
              )}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {title && (
                  <h3 className={cn(
                    "font-semibold leading-none tracking-tight text-foreground truncate",
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
          // 规则：一次性显示所有内容无需手动向下滑动查看隐藏内容
          // 移除 overflow-hidden 与 min-h-0，支持由内向外完整撑开显示全部内容
          "relative flex flex-1 flex-col",
          !noPadding && (isSmall ? "px-3 pb-3" : "px-4 pb-4 sm:px-5 sm:pb-5"),
          hasHeader && !noPadding && (isSmall ? "pt-2" : "pt-3.5"),
          contentClassName
        )}
      >
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
};
