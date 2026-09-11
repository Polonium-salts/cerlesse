import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  GitFork, 
  Scale, 
  Database, 
  BrainCircuit, 
  FileText, 
  History, 
  Settings, 
  Globe,
  X
} from "lucide-react";

interface GoogleAppsMenuProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onSelectTab?: (tab: "summary" | "mindmap" | "comparison" | "sources" | "reasoning") => void;
  hasResult?: boolean;
}

export const GoogleAppsMenu: React.FC<GoogleAppsMenuProps> = ({
  onOpenSettings,
  onOpenHistory,
  onSelectTab,
  hasResult = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const apps = [
    {
      name: "深度检索",
      desc: "SearXNG 实时聚合",
      icon: <Globe className="w-6 h-6 text-[#4285F4]" />,
      action: () => setIsOpen(false)
    },
    {
      name: "AI 概览",
      desc: "决策级研报提炼",
      icon: <Sparkles className="w-6 h-6 text-[#EA4335]" />,
      action: () => {
        if (hasResult && onSelectTab) onSelectTab("summary");
        setIsOpen(false);
      }
    },
    {
      name: "思维导图",
      desc: "交互式知识层级",
      icon: <GitFork className="w-6 h-6 text-[#FBBC05]" />,
      action: () => {
        if (hasResult && onSelectTab) onSelectTab("mindmap");
        setIsOpen(false);
      }
    },
    {
      name: "对比矩阵",
      desc: "跨源多维事实校验",
      icon: <Scale className="w-6 h-6 text-[#34A853]" />,
      action: () => {
        if (hasResult && onSelectTab) onSelectTab("comparison");
        setIsOpen(false);
      }
    },
    {
      name: "过滤信源",
      desc: "降噪与学术可信库",
      icon: <Database className="w-6 h-6 text-[#4285F4]" />,
      action: () => {
        if (hasResult && onSelectTab) onSelectTab("sources");
        setIsOpen(false);
      }
    },
    {
      name: "Agent 链路",
      desc: "实时思考决策流",
      icon: <BrainCircuit className="w-6 h-6 text-[#EA4335]" />,
      action: () => {
        if (hasResult && onSelectTab) onSelectTab("reasoning");
        setIsOpen(false);
      }
    },
    {
      name: "搜索历史",
      desc: "研报快照与归档",
      icon: <History className="w-6 h-6 text-[#34A853]" />,
      action: () => {
        onOpenHistory();
        setIsOpen(false);
      }
    },
    {
      name: "系统配置",
      desc: "模型与 API 密钥",
      icon: <Settings className="w-6 h-6 text-[#5f6368] dark:text-[#9aa0a6]" />,
      action: () => {
        onOpenSettings();
        setIsOpen(false);
      }
    }
  ];

  return (
    <div className="relative" ref={menuRef}>
      {/* 9 Dots Google Waffle Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Google 应用与工具"
        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-[#303134] text-zinc-600 dark:text-[#bdc1c6] transition-colors cursor-pointer"
        aria-label="Google 应用"
      >
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {/* Floating Apps Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-88 p-4 bg-white dark:bg-[#303134] border border-[#dfe1e5] dark:border-[#3c4043] rounded-3xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-100 dark:border-zinc-700/60">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Google Agent 矩阵工具
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {apps.map((app, index) => (
              <button
                key={index}
                onClick={app.action}
                className="flex flex-col items-center justify-center p-2.5 rounded-2xl hover:bg-zinc-50 dark:hover:bg-[#3c4043] transition-all group text-center cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  {app.icon}
                </div>
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">
                  {app.name}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-400 line-clamp-1 scale-90">
                  {app.desc}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-700/60 text-center">
            <span className="text-[11px] text-zinc-400">
              SearXNG 并发引擎 × OpenRouter 免费大模型
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
