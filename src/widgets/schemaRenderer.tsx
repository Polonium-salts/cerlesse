import React, { useState } from "react";
import {
  WidgetSchema,
  WidgetSchemaNode,
  WidgetContext
} from "./sdk/types.js";
import { IOSWidget } from "../components/ui/IOSWidget.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { Progress } from "../components/ui/progress.js";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "../components/ui/table.js";
import { cn } from "../lib/utils.js";
import {
  Copy,
  Check,
  ExternalLink,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Sparkles
} from "lucide-react";

interface SchemaRendererProps {
  schema: WidgetSchema;
  context: WidgetContext;
}

/** 徽标/按钮的旧彩色语义（blue/emerald/…）收敛为 shadcn Badge 变体 —— 无色相，只保留层级差异 */
const badgeVariantFor = (variant?: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (variant) {
    case "rose":
      return "destructive";
    case "amber":
    case "zinc":
      return "outline";
    case "blue":
      return "default";
    default:
      return "secondary";
  }
};

export const WidgetSchemaRenderer: React.FC<SchemaRendererProps> = ({ schema, context }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    if (context.copyText) {
      context.copyText(text);
    } else {
      navigator.clipboard?.writeText(text);
    }
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleToggleChecklist = (itemId: string, currentDone: boolean) => {
    const checklistState = context.state.checklist || {};
    const nextDone = !Boolean(checklistState[itemId] !== undefined ? checklistState[itemId] : currentDone);
    context.setState((prev: any) => ({
      ...prev,
      checklist: {
        ...(prev.checklist || {}),
        [itemId]: nextDone
      }
    }));
  };

  const renderNode = (node: WidgetSchemaNode, idx: number): React.ReactNode => {
    switch (node.type) {
      case "text": {
        const variant = node.variant || "body";
        if (variant === "title") {
          return (
            <h4 key={idx} className="text-sm font-semibold tracking-tight text-foreground">
              {node.text}
            </h4>
          );
        }
        if (variant === "subtitle") {
          return (
            <h5 key={idx} className="text-xs font-medium text-foreground">
              {node.text}
            </h5>
          );
        }
        if (variant === "caption") {
          return (
            <p key={idx} className="text-xs text-muted-foreground">
              {node.text}
            </p>
          );
        }
        if (variant === "code") {
          return (
            <code key={idx} className="rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
              {node.text}
            </code>
          );
        }
        return (
          <p key={idx} className="text-xs leading-relaxed text-muted-foreground">
            {node.text}
          </p>
        );
      }

      case "metric": {
        return (
          <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
            <div>
              <span className="block text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {node.label}
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground">
                  {node.value}
                </span>
                {node.unit && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {node.unit}
                  </span>
                )}
              </div>
            </div>
            {node.trend && (
              <Badge variant="secondary" className="gap-0.5">
                <ArrowUpRight />
                <span>{node.trend}</span>
              </Badge>
            )}
          </div>
        );
      }

      case "badge": {
        return (
          <Badge key={idx} variant={badgeVariantFor(node.variant)} className="gap-1">
            <Sparkles />
            <span>{node.label}</span>
          </Badge>
        );
      }

      case "button": {
        const variant = node.variant || "primary";
        return (
          <Button
            key={idx}
            variant={variant === "primary" ? "default" : variant === "outline" ? "outline" : "secondary"}
            onClick={() => {
              const handler = context.actions[node.action];
              if (handler) {
                handler(node.payload);
              }
            }}
            className="w-full"
          >
            <span>{node.label}</span>
          </Button>
        );
      }

      case "kv_list": {
        return (
          <div key={idx} className="space-y-1 rounded-lg border border-border bg-muted/40 p-2 text-xs">
            {node.items.map((item, itemIdx) => {
              const copyId = `kv-${idx}-${itemIdx}`;
              const isCopied = copiedKey === copyId;

              return (
                <div key={itemIdx} className="group flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
                  <span className="font-medium text-muted-foreground">
                    {item.key}
                  </span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono font-semibold text-foreground">
                      {item.val}
                    </span>
                    {item.copyable !== false && (
                      <button
                        onClick={() => handleCopy(item.val, copyId)}
                        title="复制内容"
                        className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                      >
                        {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      case "checklist": {
        const checklistState = context.state.checklist || {};

        return (
          <div key={idx} className="space-y-1.5">
            {node.items.map((item, itemIdx) => {
              const isDone = checklistState[item.id] !== undefined
                ? Boolean(checklistState[item.id])
                : Boolean(item.done);

              return (
                <div
                  key={item.id || itemIdx}
                  onClick={() => handleToggleChecklist(item.id, isDone)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                    isDone
                      ? "border-border bg-muted/40 text-muted-foreground line-through"
                      : "border-border text-foreground hover:border-foreground/30"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="size-4 text-foreground" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-xs leading-relaxed font-medium">
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }

      case "timeline": {
        return (
          <div key={idx} className="relative space-y-3 pl-4 before:absolute before:top-2 before:bottom-2 before:left-1.5 before:w-0.5 before:bg-border">
            {node.events.map((event, evIdx) => (
              <div key={evIdx} className="group relative">
                <div className="absolute top-1.5 -left-4 size-2 rounded-full bg-foreground/40 ring-4 ring-card" />
                {event.time && (
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {event.time}
                  </span>
                )}
                <h5 className="text-xs font-semibold text-foreground">
                  {event.title}
                </h5>
                {event.desc && (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {event.desc}
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      }

      case "table": {
        return (
          <div key={idx} className="overflow-hidden rounded-lg border border-border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {node.headers.map((h, hIdx) => (
                    <TableHead key={hIdx} className="text-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {node.rows.map((row, rIdx) => (
                  <TableRow key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <TableCell key={cIdx} className="text-muted-foreground">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      }

      case "code": {
        const copyId = `code-${idx}`;
        const isCopied = copiedKey === copyId;

        return (
          <div key={idx} className="relative overflow-hidden rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground">
            <div className="mb-1.5 flex items-center justify-between border-b border-border pb-1.5 text-xs text-muted-foreground">
              <span>{node.language || "code"}</span>
              {node.copyable !== false && (
                <button
                  onClick={() => handleCopy(node.code, copyId)}
                  className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
                >
                  {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  <span>{isCopied ? "已复制" : "复制"}</span>
                </button>
              )}
            </div>
            <pre className="overflow-x-auto leading-relaxed">
              <code>{node.code}</code>
            </pre>
          </div>
        );
      }

      case "link": {
        return (
          <a
            key={idx}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 py-1 text-xs font-medium text-foreground underline underline-offset-4"
          >
            <span>{node.label}</span>
            <ExternalLink className="size-3" />
          </a>
        );
      }

      case "progress": {
        const pct = Math.min(100, Math.round((node.value / (node.max || 100)) * 100));
        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{node.label || "进度"}</span>
              <span className="font-mono tabular-nums">{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        );
      }

      case "tags": {
        return (
          <div key={idx} className="flex flex-wrap gap-1.5">
            {node.items.map((tag, tIdx) => (
              <Badge key={tIdx} variant="secondary">
                #{tag}
              </Badge>
            ))}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <IOSWidget
      title={schema.name}
      subtitle={schema.description}
      size={context.size}
      onResize={context.onResize}
    >
      <div className="space-y-3.5 p-1">
        {schema.components.map((c, i) => renderNode(c, i))}
      </div>
    </IOSWidget>
  );
};
