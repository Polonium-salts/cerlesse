import React, { useState } from "react";
import { ShieldCheck, CheckSquare, Square, AlertCircle, RefreshCw } from "lucide-react";
import { SearchSynthesisResult } from "../../types.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";

interface VerificationChecklistWidgetProps {
  activeResult?: SearchSynthesisResult;
  query?: string;
  isCompact?: boolean;
}

export const VerificationChecklistWidget: React.FC<VerificationChecklistWidgetProps> = ({
  activeResult,
  query = "",
  isCompact = false
}) => {
  // 智能推导核验步骤
  const initialChecklist = React.useMemo(() => {
    const q = query.toLowerCase();
    if (q.includes("error") || q.includes("fail") || q.includes("bug") || q.includes("报错") || q.includes("解决")) {
      return [
        { id: "1", title: "核实运行环境与运行时版本", detail: "确保 Node/Python/Docker 版本满足官方基线要求" },
        { id: "2", title: "清理本地缓存与锁文件", detail: "删除 package-lock.json / node_modules 后重新构建" },
        { id: "3", title: "排查网络代理与镜像源配置", detail: "测试 registry.npmjs.org / pypi.org 连通性与证书有效性" },
        { id: "4", title: "确认系统权限与端口占用", detail: "检查端口是否被占用 (lsof -i :port) 及权限策略" }
      ];
    }
    return [
      { id: "1", title: "核查官方前置依赖条件", detail: "确认目标软件所需的系统级依赖与环境支持" },
      { id: "2", title: "验证安装包完整性与哈希", detail: "校验下载包的 SHA256 签名以确保无篡改" },
      { id: "3", title: "执行最小可行验证指令", detail: "运行 --version 或简单用例测试是否可正常工作" },
      { id: "4", title: "配置系统全局环境变量", detail: "将可执行路径添加至 PATH 并验证终端生效" }
    ];
  }, [query]);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const progress = Math.round((checkedIds.size / initialChecklist.length) * 100);

  return (
    <div className="p-4 sm:p-5 flex flex-col h-full overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">故障排查与核验清单</h3>
            <p className="text-xs text-muted-foreground">交互式步骤自检与避坑保障</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">
          已完成 {progress}%
        </Badge>
      </div>

      <div className="flex-1 overflow-auto space-y-2">
        {initialChecklist.map((item) => {
          const isDone = checkedIds.has(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                isDone
                  ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                  : "bg-muted/20 border-border/40 hover:bg-muted/40 hover:border-emerald-500/30 text-foreground"
              }`}
            >
              <div className="mt-0.5 text-emerald-500 shrink-0">
                {isDone ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4 text-muted-foreground/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-tight ${isDone ? "line-through opacity-70" : ""}`}>
                  {item.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
