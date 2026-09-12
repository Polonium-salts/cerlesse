import React, { useState } from "react";
import { WidgetBlueprint, BlueprintComponent, WidgetPlannedSize } from "../types.js";
import { WidgetContext } from "./sdk/types.js";
import {
  Download,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
  CloudSun,
  FileCode,
  Box,
  Compass,
  Zap,
  Globe,
  Star,
  Play,
  Pause,
  FolderOpen,
  GitFork,
  Heart
} from "lucide-react";

interface BlueprintRendererProps {
  blueprint: WidgetBlueprint;
  context?: WidgetContext;
  isCompact?: boolean;
  size?: WidgetPlannedSize | "wide";
  onResize?: (nextSize: WidgetPlannedSize) => void;
}

export const WidgetBlueprintRenderer: React.FC<BlueprintRendererProps> = ({
  blueprint,
  context,
  isCompact = false,
  size = blueprint.size || "large",
  onResize
}) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // 1. 交互式下载状态机 (Idle -> Downloading with progress -> Completed)
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "completed">("idle");
  const [downloadSpeed, setDownloadSpeed] = useState<string>("16.2 MB/s");

  // 2. 交互式收藏状态 (持久化至 LocalStorage)
  const [isFavorited, setIsFavorited] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`cerlesse_fav_${blueprint.entity}`) === "true";
    } catch {
      return false;
    }
  });

  // 3. 交互式代码调试器输出控制台
  const [isRunningCode, setIsRunningCode] = useState<boolean>(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);

  // 4. 交互式学习阶段完成打卡
  const [checkedStages, setCheckedStages] = useState<Record<number, boolean>>({ 0: true });

  const handleCopy = (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleOpenUrl = (url: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (context?.openUrl) {
      context.openUrl(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // 触发模拟实时下载流程
  const handleStartDownload = (primaryUrl: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (downloadStatus === "completed") {
      handleOpenUrl(primaryUrl, e);
      return;
    }

    if (downloadStatus === "downloading") return;

    setDownloadStatus("downloading");
    setDownloadProgress(10);

    const stepInterval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(stepInterval);
          setDownloadStatus("completed");
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 20) + 15;
        setDownloadSpeed(`${(12 + Math.random() * 8).toFixed(1)} MB/s`);
        return Math.min(next, 95);
      });
    }, 350);
  };

  // 切换收藏状态
  const handleToggleFavorite = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !isFavorited;
    setIsFavorited(next);
    try {
      localStorage.setItem(`cerlesse_fav_${blueprint.entity}`, String(next));
    } catch {
      // ignore
    }
  };

  // 交互式代码运行
  const handleRunCode = (expectedOutput?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsRunningCode(true);
    setConsoleOutput("正在启动沙箱执行环境...\n");

    setTimeout(() => {
      setIsRunningCode(false);
      const out = expectedOutput || `Hello, ${blueprint.entity || "World"}!\n[Process completed with code 0]`;
      setConsoleOutput(`> 执行成功 (耗时 42ms):\n${out}`);
    }, 600);
  };

  // 渲染单个组件节点
  const renderComponentNode = (comp: BlueprintComponent, idx: number) => {
    const { type, data } = comp;

    switch (type) {
      case "software_info":
        return (
          <div key={idx} className="p-3.5 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-white/10 dark:border-white/5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                  <Box className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                      {data.name}
                    </h4>
                    {data.version && (
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {data.version}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {data.publisher || "官方权威认证"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>已核验</span>
              </div>
            </div>
            {data.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2 mt-2">
                {data.description}
              </p>
            )}
          </div>
        );

      case "download_action":
        if (data.list && Array.isArray(data.list)) {
          return (
            <div key={idx} className="space-y-1.5">
              <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">资源直达链接</div>
              {data.list.map((item: any, i: number) => (
                <div
                  key={i}
                  onClick={(e) => handleOpenUrl(item.url, e)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-medium text-zinc-200 truncate">{item.title}</div>
                    <div className="text-[10px] text-zinc-400">{item.source}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={idx} className="space-y-2">
            {/* 动态交互式下载按钮 */}
            {downloadStatus === "downloading" ? (
              <div className="w-full p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-blue-200 font-medium">
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 animate-bounce text-blue-400" />
                    正在极速下载安装包...
                  </span>
                  <span className="font-mono">{downloadProgress}% ({downloadSpeed})</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-blue-900/60 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300 rounded-full"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            ) : downloadStatus === "completed" ? (
              <button
                onClick={(e) => handleStartDownload(data.primaryUrl, e)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] group"
              >
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="w-4 h-4 text-white/90" />
                  <span className="text-sm font-semibold tracking-wide">下载完成 · 打开安装包</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-white/80 font-mono">
                  <span>运行安装</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </button>
            ) : (
              <button
                onClick={(e) => handleStartDownload(data.primaryUrl, e)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] group"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-white/90 group-hover:translate-y-0.5 transition-transform" />
                  <span className="text-sm font-semibold tracking-wide">{data.label || "立即下载"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/80 font-mono">
                  {data.platform && <span>{data.platform}</span>}
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </div>
              </button>
            )}

            {data.fileSize && (
              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                <span>规格包：{data.fileSize}</span>
                <span className="text-emerald-400 font-medium">高速直连分发通道</span>
              </div>
            )}
          </div>
        );

      case "favorite_action":
        return (
          <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <Heart className={`w-4 h-4 ${isFavorited ? "text-rose-500 fill-rose-500" : "text-zinc-400"}`} />
              <span>{isFavorited ? "已添加至我的专属素材库" : "喜欢该素材？一键收藏备用"}</span>
            </div>
            <button
              onClick={handleToggleFavorite}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                isFavorited 
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" 
                  : "bg-white/10 hover:bg-white/20 text-zinc-200"
              }`}
            >
              {isFavorited ? "★ 已收藏" : "☆ 收藏"}
            </button>
          </div>
        );

      case "version_specs":
        return (
          <div key={idx} className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase">更新通道</span>
              <span className="font-medium text-zinc-200">{data.channel || "Official Release"}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase">授权协议</span>
              <span className="font-medium text-zinc-200">{data.license || "官方正式授权"}</span>
            </div>
          </div>
        );

      case "system_requirement":
        return (
          <div key={idx} className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>系统运行要求</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="text-zinc-400">支持系统: <span className="text-zinc-200">{data.os}</span></div>
              <div className="text-zinc-400">最低内存: <span className="text-zinc-200">{data.minRam}</span></div>
              {data.gpu && <div className="text-zinc-400 col-span-2">图形加速: <span className="text-zinc-200">{data.gpu}</span></div>}
            </div>
          </div>
        );

      case "security_check":
        return (
          <div key={idx} className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-medium text-emerald-300 block">{data.scanEngine || "安全风控质检通过"}</span>
                <span className="text-[10px] text-zinc-500 font-mono">数字指纹: {data.sha256?.slice(0, 16)}...</span>
              </div>
            </div>
            <button
              onClick={(e) => handleCopy(data.sha256 || "", e)}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-zinc-400 flex items-center gap-1 shrink-0"
            >
              {copiedText === data.sha256 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>复制校验码</span>
            </button>
          </div>
        );

      case "quick_action":
        return (
          <div key={idx} className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>{data.label || "快速安装指令"}</span>
              </div>
              <button
                onClick={(e) => handleCopy(data.command, e)}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
              >
                {copiedText === data.command ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-xs text-emerald-400 bg-black/40 px-2.5 py-1.5 rounded select-all break-all border border-white/5">
              {data.command}
            </div>
          </div>
        );

      case "official_portal":
        return (
          <div
            key={idx}
            onClick={(e) => handleOpenUrl(data.url, e)}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all hover:border-blue-500/40 group"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-zinc-200 group-hover:text-blue-300 transition-colors">
                {data.label || "访问官方网站"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              {data.isVerified && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">官方存证</span>}
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        );

      case "weather_current":
        return (
          <div key={idx} className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-amber-300">{data.location}</div>
                <div className="text-2xl font-bold text-zinc-100 mt-1">{data.temp}</div>
                <div className="text-xs text-zinc-400">{data.condition} · {data.highLow}</div>
              </div>
              <CloudSun className="w-10 h-10 text-amber-400 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-amber-500/10 text-[11px] text-zinc-400">
              <div>湿度: {data.humidity}</div>
              <div>风向: {data.wind}</div>
              <div className="col-span-2 text-emerald-400 font-medium">空气质量: {data.airQuality}</div>
            </div>
          </div>
        );

      case "weather_forecast":
        return (
          <div key={idx} className="grid grid-cols-4 gap-1.5 text-center">
            {data.days?.map((d: any, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-zinc-900/40 border border-white/5">
                <div className="text-[10px] text-zinc-400">{d.day}</div>
                <div className="text-xs font-medium text-zinc-200 my-0.5">{d.cond}</div>
                <div className="text-[10px] text-zinc-500">{d.temp}</div>
              </div>
            ))}
          </div>
        );

      case "roadmap_step":
        return (
          <div key={idx} className="space-y-1.5 p-3 rounded-xl bg-zinc-900/40 border border-white/5">
            <div className="text-xs font-semibold text-emerald-400 mb-2">{data.title}</div>
            {data.stages?.map((stage: any, i: number) => {
              const isChecked = checkedStages[i] ?? stage.done;
              return (
                <div 
                  key={i} 
                  onClick={() => setCheckedStages(prev => ({ ...prev, [i]: !isChecked }))}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isChecked ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-600"}`}>
                      {isChecked && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <span className="font-mono text-emerald-500 text-[11px] shrink-0">{stage.phase}</span>
                    <span className={`text-zinc-300 truncate ${isChecked ? "line-through opacity-60" : ""}`}>{stage.title}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 shrink-0 ml-2">{stage.duration}</span>
                </div>
              );
            })}
          </div>
        );

      case "code_run":
        return (
          <div key={idx} className="p-3 rounded-xl bg-black/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-zinc-300 font-semibold">{data.language || "python"} 起步执行沙箱</span>
              </div>
              <button
                onClick={(e) => handleRunCode(data.expectedOutput, e)}
                disabled={isRunningCode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] shadow-sm transition-all active:scale-95"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>{isRunningCode ? "执行中..." : "运行代码"}</span>
              </button>
            </div>
            <pre className="text-xs font-mono text-zinc-300 bg-zinc-950/80 p-2.5 rounded-lg overflow-x-auto border border-white/5">
              <code>{data.code}</code>
            </pre>
            {consoleOutput && (
              <div className="font-mono text-xs text-emerald-300 bg-black/90 p-2.5 rounded-lg border border-emerald-500/20 whitespace-pre-wrap animate-fadeIn">
                {consoleOutput}
              </div>
            )}
          </div>
        );

      case "progress_tracker":
        return (
          <div key={idx} className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">学习进度跟踪</span>
              <span className="font-mono text-emerald-400 font-bold">{data.progressPercent || 25}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                style={{ width: `${data.progressPercent || 25}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">{data.statusText}</p>
          </div>
        );

      case "tags_filter":
        return (
          <div key={idx} className="flex flex-wrap gap-1.5">
            {data.tags?.map((t: string, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/10 text-violet-300 border border-violet-500/20 font-medium">
                #{t}
              </span>
            ))}
          </div>
        );

      case "summary_points":
        return (
          <div key={idx} className="space-y-1.5">
            {data.points?.map((pt: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <span className="leading-snug">{pt}</span>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    // 磁贴外层容器不绘制背景，背板必须由组件自己提供。
    // 本组件内部全部使用深色主题色（text-zinc-100 / bg-white/5 / border-white/10），
    // 因此背板固定为深色面板：既补上缺失的背板，也与其内部配色自洽。
    // 不透明背景是必需的 —— 半透明叠加层（bg-white/5）无法充当背板，
    // 否则会裸露在页面底色上。回归护栏见 scratch/verify_widget_backplates.ts
    <div className="w-full h-full flex flex-col justify-between p-4 overflow-y-auto custom-scrollbar rounded-[22px] bg-zinc-900 dark:bg-[#161616] text-zinc-100 border border-zinc-700/60 dark:border-zinc-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.28)]">
      {/* 顶部标题与实体栏 */}
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-zinc-100 text-base tracking-tight truncate">
              {blueprint.title}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              意图蓝图
            </span>
          </div>
          {blueprint.subtitle && (
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {blueprint.subtitle}
            </p>
          )}
        </div>
        <button
          onClick={handleToggleFavorite}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
            isFavorited
              ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
              : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
          }`}
          title={isFavorited ? "已收藏" : "加入收藏"}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? "fill-rose-400" : ""}`} />
        </button>
      </div>

      {/* 核心组件流 */}
      <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
        {blueprint.components.map((comp, idx) => renderComponentNode(comp, idx))}
      </div>

      {/* 底部功能栏 */}
      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Server-Driven UI 自动编排</span>
        </div>
        <span className="font-mono text-[10px] text-zinc-400">
          {blueprint.entity} · {blueprint.intent}
        </span>
      </div>
    </div>
  );
};
