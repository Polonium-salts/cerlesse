import React from "react";
import type { TileWidth } from "../../lib/tileLayoutEngine.js";
import {
  WidgetContainer,
  withWidgetContainer,
  type WidgetPaddingMode,
  type WidgetSkeletonType,
  type WidgetContainerProps
} from "../../widgets/core/WidgetContainer.js";

export interface IOSWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
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
  padding?: WidgetPaddingMode;
  isLoading?: boolean;
  skeletonType?: WidgetSkeletonType;
  error?: Error | string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  border?: boolean;
  onClick?: () => void;
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
  padding,
  isLoading,
  skeletonType,
  error,
  isEmpty,
  emptyMessage,
  border = true,
  onClick,
  ...rest
}) => {
  return (
    <WidgetContainer
      id={id}
      title={title}
      subtitle={subtitle}
      icon={icon}
      badge={badge}
      actions={actions}
      size={size}
      isCompact={size === 25}
      noPadding={noPadding}
      padding={padding}
      className={className}
      headerClassName={headerClassName}
      contentClassName={contentClassName}
      isLoading={isLoading}
      skeletonType={skeletonType}
      error={error}
      isEmpty={isEmpty}
      emptyMessage={emptyMessage}
      border={border}
      onClick={onClick}
      {...rest}
    >
      {children}
    </WidgetContainer>
  );
};

export { WidgetContainer, withWidgetContainer };
