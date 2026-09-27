import React, { useState } from "react";
import { Terminal, Copy, Check, Play, Sparkles } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";

interface ActionsToolboxWidgetProps {
  activeResult?: SearchSynthesisResult;
  query?: string;
  isCompact?: boolean;
}

export const ActionsToolboxWidget: React.FC<ActionsToolboxWidgetProps> = ({
  activeResult,
  query = "",
  isCompact = false
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // 智能推导可用 CLI 或快捷动作
  const actions = React.useMemo(() => {
    const list: Array<{ label: string; command: string; desc: string }> = [];
    const q = query.toLowerCase();

    if (q.includes("docker") || q.includes("container")) {
      list.push({ label: "运行容器", command: "docker run -d -p 8080:80 --name my-app alpine", desc: "后台启动轻量沙箱" });
      list.push({ label: "查看日志", command: "docker logs -f my-app", desc: "实时流式输出日志" });
    } else if (q.includes("npm") || q.includes("node") || q.includes("react") || q.includes("vue")) {
      list.push({ label: "安装依赖", command: "npm install", desc: "安装 package.json 全部依赖" });
      list.push({ label: "清除缓存", command: "npm cache clean --force", desc: "强力清理 npm 缓存解决冲突" });
    } else if (q.includes("python") || q.includes("pip")) {
      list.push({ label: "安装包", command: "pip install -U requirements.txt", desc: "升级并安装依赖清单" });
      list.push({ label: "虚拟环境", command: "python -m venv .venv && source .venv/bin/activate", desc: "新建独立环境" });
    } else if (q.includes("git")) {
      list.push({ label: "拉取更新", command: "git pull --rebase origin main", desc: "优雅变基拉取远端" });
      list.push({ label: "暂存变更", command: "git stash push -m 'wip'", desc: "暂存本地未提交代码" });
    } else {
      list.push({ label: "快捷搜索", command: `search "${query}"`, desc: "全网精准关键词提纯" });
      list.push({ label: "系统状态", command: "curl -I https://api.github.com", desc: "网络连通性健康探测" });
    }
    return list;
  }, [query]);

  const handleCopy = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="p-4 sm:p-5 flex flex-col h-full overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">行动工具箱</h3>
            <p className="text-xs text-muted-foreground">一键复制实操指令与快捷运行脚本</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500">
          CLI 快捷指令
        </Badge>
      </div>

      <div className="flex-1 overflow-auto space-y-2.5">
        {actions.map((act, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-foreground">{act.label}</span>
              <span className="text-[10px] text-muted-foreground">{act.desc}</span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-background/80 rounded-lg p-2 border border-border/40">
              <code className="text-xs font-mono text-foreground/90 truncate select-all">
                {act.command}
              </code>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleCopy(act.command, idx)}
                title="复制指令"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              >
                {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
