import React, { useState } from "react";
import { useModelProviderStore } from "../state/modelProviderStore.js";
import { Bot, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

export interface ModelStatusIndicatorProps {
  className?: string;
  showText?: boolean;
}

export const ModelStatusIndicator: React.FC<ModelStatusIndicatorProps> = ({
  className = "",
  showText = false
}) => {
  const { status, isReady, selectedModel, provider } = useModelProviderStore();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!status) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
        <span className="size-2 rounded-full bg-muted-foreground/40 animate-pulse" />
        {showText && <span className="text-[11px]">探测中...</span>}
      </div>
    );
  }

  const isModelDisabled = Boolean(status.isAiApiDisabled);
  const statusColor = isModelDisabled
    ? "bg-amber-500"
    : isReady
    ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
    : "bg-amber-400";

  const statusTitle = isModelDisabled
    ? "AI API 服务已暂时禁用"
    : isReady
    ? `模型就绪: ${selectedModel || status.defaultModel || provider}`
    : `未配置有效 API 密钥 (${status.reason || "请在设置页配置"})`;

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 cursor-pointer select-none ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip((v) => !v)}
    >
      <div className="relative flex items-center justify-center">
        <span className={`size-2 rounded-full ${statusColor}`} />
        {isReady && !isModelDisabled && (
          <span className="absolute size-3 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />
        )}
      </div>

      {showText && (
        <span className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]">
          {selectedModel || provider}
        </span>
      )}

      {/* 轻量无干扰 Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 z-50 min-w-[200px] max-w-[280px] p-2.5 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-lg text-popover-foreground text-xs animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
          <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
            {isReady && !isModelDisabled ? (
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
            )}
            <span>{isReady && !isModelDisabled ? "AI 供应商在线" : "AI 供应商提示"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {statusTitle}
          </p>
          {status.models && status.models.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground flex justify-between">
              <span>可用模型</span>
              <span className="font-mono text-foreground font-medium">{status.models.length} 个</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
