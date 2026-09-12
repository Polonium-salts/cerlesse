import React, { useState } from "react";
import { DownloadHubData, DownloadReleaseItem } from "../../../types.js";
import {
  Download,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Server,
  Laptop,
  Cpu,
  Boxes
} from "lucide-react";

interface DownloadHubViewProps {
  data: DownloadHubData;
  themeColor?: string;
  onExecuteAction?: (action: any) => void;
}

export const DownloadHubView: React.FC<DownloadHubViewProps> = ({
  data,
  themeColor: _themeColor = "blue",
  onExecuteAction
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const releases = data.releases || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "linux":
        return <Server className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "macos":
        return <Laptop className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "windows":
        return <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case "docker":
        return <Boxes className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      default:
        return <Cpu className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
    }
  };

  const filteredReleases = releases.filter(r => {
    if (selectedPlatform === "all") return true;
    return r.platform === selectedPlatform;
  });

  return (
    <div className="space-y-4">
      {/* Header with Quick One-Click Install */}
      {data.quickCopyCommand && (
        <div className="p-3.5 rounded-xl bg-zinc-900 dark:bg-black text-white border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-emerald-400 flex items-center gap-1.5 font-bold">
              <Terminal className="w-3.5 h-3.5" />
              推荐一键部署 / 安装脚本
            </span>
            <span className="text-[10px] text-zinc-400">已核验官方签名源</span>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-950 font-mono text-xs text-zinc-200 flex items-center justify-between gap-3 overflow-x-auto">
            <span className="select-all truncate">{data.quickCopyCommand}</span>
            <button
              onClick={() => handleCopy(data.quickCopyCommand, "quick-cmd")}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              {copiedId === "quick-cmd" ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>复制命令</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Platform Filter Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedPlatform("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedPlatform === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            全平台架构 ({releases.length})
          </button>
          {Array.from(new Set(releases.map(r => r.platform))).map(plat => (
            <button
              key={plat}
              onClick={() => setSelectedPlatform(plat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                selectedPlatform === plat
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {getPlatformIcon(plat)}
              <span className="capitalize">{plat}</span>
            </button>
          ))}
        </div>
        <a
          href={data.officialSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
        >
          <span>官方 Release 发布页</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Releases Cards Matrix */}
      <div className="space-y-2.5">
        {filteredReleases.map(rel => (
          <div
            key={rel.id}
            className={`p-3 rounded-xl border transition-all ${
              rel.isRecommended
                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/40 dark:border-emerald-500/30"
                : "bg-white dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 shrink-0 mt-0.5">
                  {getPlatformIcon(rel.platform)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {rel.platformLabel}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                      v{rel.version || data.latestVersion}
                    </span>
                    {rel.isRecommended && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white">
                        官方推荐
                      </span>
                    )}
                  </div>

                  {rel.installCommand && (
                    <div className="mt-2 p-2 rounded bg-zinc-900 font-mono text-[11px] text-emerald-400 flex items-center justify-between gap-2 overflow-x-auto">
                      <span className="truncate select-all">{rel.installCommand}</span>
                      <button
                        onClick={() => handleCopy(rel.installCommand!, rel.id)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                        title="复制命令"
                      >
                        {copiedId === rel.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}

                  {rel.checksum && (
                    <div className="mt-1 text-[10px] text-zinc-400 font-mono truncate">
                      SHA256: {rel.checksum}
                    </div>
                  )}
                </div>
              </div>

              {rel.downloadUrl && (
                <a
                  href={rel.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载安装包</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* System Requirements Note */}
      {data.systemRequirements && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>前置环境要求: {data.systemRequirements}</span>
        </div>
      )}
    </div>
  );
};
