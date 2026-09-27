import React, { useCallback, useMemo, useState } from "react";
import { FileText, CircleCheck, Circle, Copy, Check, RotateCcw } from "lucide-react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Progress } from "../../components/ui/progress.js";
import type { SearchSynthesisResult } from "../../types.js";
import { splitSentences } from "./summaryText.js";

export interface TakeawaysData {
  query: string;
  items: string[];
}

export interface TakeawaysWidgetProps {
  data: TakeawaysData;
  /** 命名空间隔离的持久化读取（由 ctx.storage 注入） */
  storageGet: (key: string) => string | null;
  storageSet: (key: string, value: string) => void;
  copyText?: (text: string) => void;
}

const STORAGE_KEY = "checked_items";

/** 从综合研报中提炼要点条目；无 keyTakeaways 时回落按句切分 summary */
export function buildTakeawaysData(result?: SearchSynthesisResult): TakeawaysData {
  const raw = result?.keyTakeaways || [];
  const items = raw.length > 0 ? raw : splitSentences(result?.summary || "", 6);
  return { query: result?.query || "", items };
}

/**
 * 核心要点小组件 (正面)
 * 条目式提炼核心结论，支持逐条勾选并将掌握进度写入隔离命名空间存储
 */
export const TakeawaysWidget: React.FC<TakeawaysWidgetProps> = ({
  data,
  storageGet,
  storageSet,
  copyText
}) => {
  const { query, items } = data;

  // 勾选状态懒加载自隔离存储，跨会话保留掌握进度
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      const parsed = JSON.parse(storageGet(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [copied, setCopied] = useState(false);

  const persist = useCallback(
    (next: Record<string, boolean>) => {
      setChecked(next);
      storageSet(STORAGE_KEY, JSON.stringify(next));
    },
    [storageSet]
  );

  const toggle = (id: string) => {
    persist({ ...checked, [id]: !checked[id] });
  };

  const reset = () => persist({});

  const doneCount = useMemo(
    () => items.reduce((sum, _item, idx) => sum + (checked[String(idx)] ? 1 : 0), 0),
    [items, checked]
  );
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const handleCopy = () => {
    const text = [
      query ? `# ${query}` : "",
      ...items.map((item, idx) => `${checked[String(idx)] ? "[x]" : "[ ]"} ${item}`)
    ]
      .filter(Boolean)
      .join("\n");
    if (copyText) {
      copyText(text);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IOSWidget
      title="核心要点"
      icon={<FileText className="size-4 text-primary" />}
      badge={
        <Badge
          variant="outline"
          className="text-[11px] h-5 font-normal text-muted-foreground whitespace-nowrap"
        >
          共 {items.length} 条
        </Badge>
      }
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={items.length === 0}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            title="复制全部要点"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-primary" />
                <span className="text-primary font-medium">已复制</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>复制</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={reset}
            disabled={doneCount === 0}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            title="清空勾选进度"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      }
      className="w-full h-full border-border/80 bg-card"
      contentClassName="flex flex-col gap-3"
    >
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-border rounded-xl">
          <FileText className="size-7 text-muted-foreground/50 mb-1.5" />
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            暂无提炼要点
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 掌握进度 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>已掌握进度</span>
              <span className="tabular-nums">
                {doneCount} / {items.length} · {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {/* 要点清单 */}
          <ul className="flex-1 space-y-1.5">
            {items.map((item, idx) => {
              const id = String(idx);
              const isDone = Boolean(checked[id]);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="group w-full flex items-start gap-2 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 hover:border-primary/30 p-2.5 text-xs text-left transition-colors cursor-pointer"
                    title={isDone ? "标记为未掌握" : "标记为已掌握"}
                  >
                    {isDone ? (
                      <CircleCheck className="size-4 shrink-0 mt-0.5 text-primary" />
                    ) : (
                      <Circle className="size-4 shrink-0 mt-0.5 text-muted-foreground/50 group-hover:text-primary/60" />
                    )}
                    <span
                      className={
                        isDone
                          ? "leading-snug text-muted-foreground line-through"
                          : "leading-snug text-foreground/90"
                      }
                    >
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            点击条目勾选掌握状态，进度已自动保存在本机
          </div>
        </div>
      )}
    </IOSWidget>
  );
};
