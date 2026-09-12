import React, { useState } from "react";
import { TravelItineraryData, TravelDayPlan } from "../../../types.js";
import {
  MapPin,
  Calendar,
  Clock,
  Navigation,
  ExternalLink,
  DollarSign,
  Compass,
  Sparkles,
  Ticket,
  Luggage
} from "lucide-react";

interface TravelItineraryViewProps {
  data: TravelItineraryData;
  themeColor?: string;
  onExecuteAction?: (action: any) => void;
}

export const TravelItineraryView: React.FC<TravelItineraryViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onExecuteAction
}) => {
  const [activeDay, setActiveDay] = useState<number>(1);

  const days = data.days || [];
  const currentDayPlan = days.find(d => d.day === activeDay) || days[0];

  return (
    <div className="space-y-4">
      {/* Overview Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-medium">目的路线</div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {data.destination}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-medium">建议游玩周期</div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {data.suggestedDuration || `${days.length} 天深度游`}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-2.5 col-span-2 sm:col-span-1">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-medium">预估人均预算</div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {data.estimatedBudget || "¥2000-4500 / 人"}
            </div>
          </div>
        </div>
      </div>

      {/* Days Tabs */}
      {days.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {days.map(d => (
            <button
              key={d.day}
              onClick={() => setActiveDay(d.day)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeDay === d.day
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <span>第 {d.day} 天</span>
              <span className="text-[10px] opacity-80 truncate max-w-[80px]">
                {d.title}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected Day Timeline Details */}
      {currentDayPlan && (
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3.5">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700/60 pb-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[11px]">
                Day {currentDayPlan.day}
              </span>
              <span>{currentDayPlan.title}</span>
            </h4>
            {currentDayPlan.transportation && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-blue-500" />
                交通：{currentDayPlan.transportation}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {currentDayPlan.spots.map((spot, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {spot.name}
                    </span>
                    {spot.suggestedDuration && (
                      <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {spot.suggestedDuration}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                    {spot.description}
                  </p>
                  {spot.tips && (
                    <div className="pl-7 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>避坑贴士：{spot.tips}</span>
                    </div>
                  )}
                </div>

                {spot.ticketUrl && (
                  <a
                    href={spot.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Ticket className="w-3 h-3" />
                    <span>购票/预约</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking Resources & Travel Essentials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.essentialTips && data.essentialTips.length > 0 && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Luggage className="w-3.5 h-3.5 text-blue-500" />
              <span>行前必备与避坑清单</span>
            </div>
            <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 pl-1">
              {data.essentialTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-blue-500 shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.bookingLinks && data.bookingLinks.length > 0 && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-emerald-500" />
              <span>正版票务与交通平台</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {data.bookingLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-xs text-zinc-800 dark:text-zinc-200 font-semibold hover:border-blue-500 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
