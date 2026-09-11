import React, { useState } from "react";
import { TimelineData, TimelineMilestone } from "../../../types.js";
import { CheckCircle2, Clock, Calendar, ExternalLink, ArrowRight, Flag } from "lucide-react";

interface TimelineViewProps {
  data: TimelineData;
  themeColor?: string;
  onUpdateData?: (updated: TimelineData) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onUpdateData: _onUpdateData
}) => {
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(() => {
    // Default to 'current' milestone if exists, or last one
    const current = data.milestones?.find(m => m.status === "current");
    return current ? current.id : (data.milestones?.[data.milestones.length - 1]?.id || null);
  });

  const milestones = data.milestones || [];

  return (
    <div className="space-y-4">
      {/* Horizontal Phase Tracker Overview */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-800/80">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 mb-2">
          <span>演进代际脉络</span>
          <span className="font-mono text-[11px] text-zinc-400">共 {milestones.length} 个关键节点</span>
        </div>

        {/* Mini Stepper Line */}
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {milestones.map((m, idx) => {
            const isActive = activeMilestoneId === m.id;
            return (
              <React.Fragment key={m.id}>
                <button
                  onClick={() => setActiveMilestoneId(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs font-bold"
                      : m.status === "completed"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                      : m.status === "current"
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                      : "bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300/60"
                  }`}
                >
                  {m.status === "completed" ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : m.status === "current" ? (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  ) : (
                    <Clock className="w-3 h-3 text-zinc-400" />
                  )}
                  <span>{m.dateOrPeriod || `阶段 0${idx + 1}`}</span>
                </button>

                {idx < milestones.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Vertical Timeline Stream */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
        {milestones.map((m: TimelineMilestone, idx: number) => {
          const isActive = activeMilestoneId === m.id;

          return (
            <div
              key={m.id}
              onClick={() => setActiveMilestoneId(m.id)}
              className={`relative cursor-pointer group transition-all`}
            >
              {/* Timeline Marker Node */}
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white dark:bg-zinc-900 transition-all ${
                  isActive
                    ? "border-blue-500 shadow-md ring-3 ring-blue-100 dark:ring-blue-950 scale-110"
                    : m.status === "completed"
                    ? "border-emerald-500 text-emerald-500"
                    : m.status === "current"
                    ? "border-blue-500 text-blue-500"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-400"
                }`}
              >
                {m.status === "completed" ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-current" />
                ) : m.status === "current" ? (
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                )}
              </div>

              {/* Milestone Content Card */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  isActive
                    ? "bg-blue-50/40 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-sm"
                    : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {m.dateOrPeriod}
                    </span>

                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {m.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {m.status === "current" && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
                        当前阶段
                      </span>
                    )}

                    {m.tag && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium">
                        {m.tag}
                      </span>
                    )}

                    {m.impactScore && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-mono">
                        影响力: {m.impactScore}
                      </span>
                    )}
                  </div>
                </div>

                {m.phase && (
                  <span className="text-[11px] text-zinc-400 font-medium block mb-1">
                    {m.phase}
                  </span>
                )}

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {m.description}
                </p>

                {m.sourceUrl && (
                  <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center">
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-600 font-mono transition-colors"
                    >
                      <span>信源: {m.sourceTitle || new URL(m.sourceUrl).hostname}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
