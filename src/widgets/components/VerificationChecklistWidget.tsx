import React from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { ShieldCheck, Check, AlertTriangle } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";

interface VerificationChecklistWidgetProps {
  result: SearchSynthesisResult;
}

/**
 * 事实核查 (verification_checklist)
 *
 * shadcn/ui 重做要点：
 *   · 勾选方块改为 shadcn Checkbox 语汇 —— size-4 + rounded-[4px]，
 *     达成态用 bg-primary text-primary-foreground，未达成态用 border-border + muted 图标；
 *   · 标题 text-sm font-medium，说明 text-xs text-muted-foreground；
 *   · 内容仍为**可从本次结果回溯的真实事实**：信源数、独立域名数、
 *     官方站点命中数、参与合并的引擎数、是否引入跨语言语料。只读、无进度条。
 */
export const VerificationChecklistWidget: React.FC<VerificationChecklistWidgetProps> = ({ result }) => {
  const sources = result.filteredResults || [];

  const domains = new Set(
    sources.map((s) => {
      try {
        return new URL(s.url).hostname;
      } catch {
        return s.url;
      }
    })
  );
  const engines = new Set(sources.map((s) => s.engine).filter(Boolean) as string[]);
  const officialCount = sources.filter((s) => s.isOfficial).length;
  const crossLingual = Boolean(result.detectedLanguage?.crossLingualEnabled);

  const checks: Array<{ ok: boolean; label: string; detail: string }> = [
    {
      ok: sources.length > 0,
      label: "信源可溯源",
      detail: `${sources.length} 篇入选自 ${domains.size} 个独立域名`
    },
    {
      ok: officialCount > 0,
      label: "官方站点命中",
      detail:
        officialCount > 0
          ? `${officialCount} 条结果来自官网 / 权威域名`
          : "本轮未命中官网，关键结论建议交叉复核"
    },
    {
      ok: engines.size > 1,
      label: "多引擎交叉",
      detail:
        engines.size > 1
          ? `${engines.size} 路引擎结果合并去重`
          : "仅单路引擎结果，覆盖面有限"
    },
    {
      ok: crossLingual,
      label: "跨语言语料",
      detail: crossLingual ? "已引入非母语权威源" : "仅单一语言语料"
    }
  ];

  return (
    <IOSWidget
      id="widget-verification-checklist"
      title="事实核查"
      icon={<ShieldCheck className="size-4" />}
      badge={
        <span className="text-xs text-muted-foreground">
          {checks.filter((c) => c.ok).length}/{checks.length} 项达成
        </span>
      }
      className="w-full h-full"
    >
      <div className="flex flex-col gap-3">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] ${
                check.ok
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {check.ok ? (
                <Check className="size-3" />
              ) : (
                <AlertTriangle className="size-3" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <span
                className={`block text-sm font-medium ${
                  check.ok ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {check.label}
              </span>
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {check.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </IOSWidget>
  );
};
