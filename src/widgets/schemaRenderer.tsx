import React, { useState } from "react";
import { 
  WidgetSchema, 
  WidgetSchemaNode, 
  WidgetContext 
} from "./sdk/types.js";
import { IOSWidget } from "../components/ui/IOSWidget.js";
import { 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Circle, 
  Sparkles,
  Zap,
  Tag,
  Code
} from "lucide-react";

interface SchemaRendererProps {
  schema: WidgetSchema;
  context: WidgetContext;
}

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
            <h4 key={idx} className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {node.text}
            </h4>
          );
        }
        if (variant === "subtitle") {
          return (
            <h5 key={idx} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {node.text}
            </h5>
          );
        }
        if (variant === "caption") {
          return (
            <p key={idx} className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {node.text}
            </p>
          );
        }
        if (variant === "code") {
          return (
            <code key={idx} className="text-[11px] font-mono px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              {node.text}
            </code>
          );
        }
        return (
          <p key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {node.text}
          </p>
        );
      }

      case "metric": {
        return (
          <div key={idx} className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                {node.label}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                  {node.value}
                </span>
                {node.unit && (
                  <span className="text-xs text-zinc-500 font-medium">
                    {node.unit}
                  </span>
                )}
              </div>
            </div>
            {node.trend && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="w-3 h-3" />
                <span>{node.trend}</span>
              </span>
            )}
          </div>
        );
      }

      case "badge": {
        const variant = node.variant || "blue";
        const colorClasses: Record<string, string> = {
          blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          violet: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
        };
        return (
          <span 
            key={idx}
            className={`inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full text-xs font-semibold border ${colorClasses[variant] || colorClasses.blue}`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{node.label}</span>
          </span>
        );
      }

      case "button": {
        const variant = node.variant || "primary";
        const btnClass = variant === "primary"
          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs font-semibold"
          : variant === "outline"
          ? "border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200";

        return (
          <button
            key={idx}
            onClick={() => {
              const handler = context.actions[node.action];
              if (handler) {
                handler(node.payload);
              }
            }}
            className={`w-full py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 ${btnClass}`}
          >
            <span>{node.label}</span>
          </button>
        );
      }

      case "kv_list": {
        return (
          <div key={idx} className="space-y-1.5 p-2 rounded-xl bg-zinc-50/80 dark:bg-zinc-850/50 border border-zinc-200/50 dark:border-zinc-800/60 text-xs">
            {node.items.map((item, itemIdx) => {
              const copyId = `kv-${idx}-${itemIdx}`;
              const isCopied = copiedKey === copyId;

              return (
                <div key={itemIdx} className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors group">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                    {item.key}
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate font-mono">
                      {item.val}
                    </span>
                    {item.copyable !== false && (
                      <button
                        onClick={() => handleCopy(item.val, copyId)}
                        title="复制内容"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
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
                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all cursor-pointer ${
                    isDone
                      ? "bg-emerald-500/5 border-emerald-500/20 text-zinc-400 line-through"
                      : "bg-white dark:bg-zinc-800/80 border-zinc-200/70 dark:border-zinc-700/70 text-zinc-800 dark:text-zinc-200 hover:border-blue-400"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
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
          <div key={idx} className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
            {node.events.map((event, evIdx) => (
              <div key={evIdx} className="relative group">
                <div className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-white dark:ring-zinc-900" />
                {event.time && (
                  <span className="text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {event.time}
                  </span>
                )}
                <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {event.title}
                </h5>
                {event.desc && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
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
          <div key={idx} className="overflow-x-auto rounded-xl border border-zinc-200/70 dark:border-zinc-800/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200/70 dark:border-zinc-700/70 text-zinc-600 dark:text-zinc-400 font-semibold">
                <tr>
                  {node.headers.map((h, hIdx) => (
                    <th key={hIdx} className="py-2 px-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/60">
                {node.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-2.5 text-zinc-700 dark:text-zinc-300">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "code": {
        const copyId = `code-${idx}`;
        const isCopied = copiedKey === copyId;

        return (
          <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-100 text-xs font-mono p-3">
            <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-zinc-800 text-[10px] text-zinc-400">
              <span>{node.language || "code"}</span>
              {node.copyable !== false && (
                <button
                  onClick={() => handleCopy(node.code, copyId)}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? "已复制" : "复制"}</span>
                </button>
              )}
            </div>
            <pre className="overflow-x-auto custom-scrollbar leading-relaxed">
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
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline py-1"
          >
            <span>{node.label}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      }

      case "progress": {
        const pct = Math.min(100, Math.round((node.value / (node.max || 100)) * 100));
        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              <span>{node.label || "进度"}</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }

      case "tags": {
        return (
          <div key={idx} className="flex flex-wrap gap-1.5">
            {node.items.map((tag, tIdx) => (
              <span 
                key={tIdx}
                className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium"
              >
                #{tag}
              </span>
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
      badge={{
        text: "AI 动态模组",
        variant: schema.themeColor || "blue"
      }}
      size={context.size}
      onResize={context.onResize}
      themeColor={schema.themeColor || "blue"}
    >
      <div className="space-y-3.5 p-1">
        {schema.components.map((c, i) => renderNode(c, i))}
      </div>
    </IOSWidget>
  );
};
