import React, { useState } from "react";
import { ToolDiscoveryData, ToolDiscoveryItem } from "../../../types.js";
import {
  Wrench,
  ExternalLink,
  Play,
  Star,
  CheckCircle2,
  Sparkles,
  Search,
  Zap,
  Tag,
  Layers
} from "lucide-react";

interface ToolDiscoveryViewProps {
  data: ToolDiscoveryData;
  themeColor?: string;
  onExecuteAction?: (tool: ToolDiscoveryItem) => void;
}

export const ToolDiscoveryView: React.FC<ToolDiscoveryViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onExecuteAction
}) => {
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [activeDemoTool, setActiveDemoTool] = useState<ToolDiscoveryItem | null>(null);

  const tools = data.tools || [];
  const filterTags = data.filterTags || [];

  const filteredTools = tools.filter(t => {
    if (selectedTag === "all") return true;
    return (t.tags || []).includes(selectedTag);
  });

  const getPricingBadge = (pricing: string) => {
    switch (pricing) {
      case "free":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">完全免费</span>;
      case "open_source":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">开源免费</span>;
      case "freemium":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">免费试用/增值</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">商业版</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Category & Tag Filter Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedTag("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedTag === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            全部工具 ({tools.length})
          </button>
          {filterTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                selectedTag === tag
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
          已交叉核验真实可用性
        </span>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredTools.map(tool => (
          <div
            key={tool.id}
            className="p-3.5 rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs hover:border-blue-500/50 dark:hover:border-blue-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {tool.name}
                    </h4>
                    {getPricingBadge(tool.pricing)}
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {tool.tagline}
                  </p>
                </div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold shrink-0">
                  <Star className="w-3 h-3 fill-amber-500" />
                  {tool.rating.toFixed(1)}
                </div>
              </div>

              {tool.highlight && (
                <div className="mt-2.5 px-2 py-1 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span className="truncate">{tool.highlight}</span>
                </div>
              )}

              {tool.tags && tool.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                  {tool.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700/60 text-[10px] text-zinc-600 dark:text-zinc-300 font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700/60 flex items-center justify-between gap-2">
              {tool.hasOnlineDemo ? (
                <button
                  onClick={() => setActiveDemoTool(tool)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  在线免安装体验
                </button>
              ) : (
                <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  免注册/开箱即用
                </span>
              )}

              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>直达官网</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Online Demo Modal Sandbox */}
      {activeDemoTool && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 dark:border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {activeDemoTool.name} · 在线功能沙盒体验
              </span>
            </div>
            <button
              onClick={() => setActiveDemoTool(null)}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-semibold cursor-pointer"
            >
              关闭沙盒
            </button>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            您可以在此直接调用该工具的核心能力，无需本地配置环境或预装依赖。
          </p>
          <div className="flex items-center gap-2 pt-1">
            <a
              href={activeDemoTool.demoUrl || activeDemoTool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>立即在新标签页打开全屏体验</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Recommendation Verdict */}
      {data.recommendationVerdict && (
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">选型建议：</span>
            {data.recommendationVerdict}
          </div>
        </div>
      )}
    </div>
  );
};
