import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button.js";

export type WidgetFailureReason =
  | "module_not_found"
  | "adapter_error"
  | "render_error"
  | "unknown";

interface WidgetBoundaryProps {
  widgetId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  reason?: WidgetFailureReason;
  stage?: string;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface WidgetBoundaryState {
  hasError: boolean;
  error?: Error;
  reason?: WidgetFailureReason;
  stage?: string;
}

export class WidgetBoundary extends React.Component<WidgetBoundaryProps, WidgetBoundaryState> {
  override state: WidgetBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(error: Error): WidgetBoundaryState {
    return {
      hasError: true,
      error,
      reason: "render_error",
      stage: "render"
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[WidgetBoundary] Error caught in widget [${this.props.widgetId}]:`, error, info);
    this.props.onError?.(error, info);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: undefined,
      reason: undefined,
      stage: undefined
    });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const activeStage = this.state.stage || this.props.stage || "render";
      const activeReason = this.state.reason || this.props.reason || "render_error";

      return (
        <div 
          data-widget-id={this.props.widgetId} 
          className="w-full h-full min-h-[140px] p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center text-center gap-2"
        >
          <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-foreground">
              小组件加载失败
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              组件: {this.props.widgetId} | 阶段: {activeStage}
            </div>
            <div className="text-[11px] text-destructive/90 line-clamp-2 max-w-[280px]">
              {this.state.error?.message || `组件在 ${activeStage} 阶段发生未捕获异常 (${activeReason})`}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleRetry}
            className="h-7 text-xs px-2.5 mt-1 border-border bg-card hover:bg-muted"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

