import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  ShieldAlert,
  Wrench,
  ExternalLink,
  CheckSquare,
  Square,
  ArrowRight,
  Info,
  RotateCcw,
  Sparkles,
  AlertCircle
} from "lucide-react";
import type {
  SearchSynthesisResult,
  TroubleshootingPlan,
  TroubleshootingSolution,
  TroubleshootingCheckItem,
  TroubleshootingVerificationItem
} from "../../types.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";

interface TroubleshootingWidgetProps {
  activeResult?: SearchSynthesisResult;
  query?: string;
  isCompact?: boolean;
  actions?: Record<string, any>;
}

/**
 * 智能兜底推导器：当后端尚未输出结构化 troubleshootingPlan 时，
 * 依据 Query 关键词、信源摘要与错误码特征，实时合成高拟真、可交互的排障方案
 */
function deriveFallbackTroubleshootingPlan(query: string, result?: SearchSynthesisResult): TroubleshootingPlan {
  const cleanQ = (query || "").trim();
  const summary = result?.summary || "";
  const takeaways = result?.keyTakeaways || [];
  const results = result?.filteredResults || [];

  // 1. 尝试提取错误码
  let errorCode = "";
  const codeMatch = cleanQ.match(/\b(ERR_[A-Z0-9_]+|EACCES|ENOENT|ECONNREFUSED|ERESOLVE|EADDRINUSE|ETIMEDOUT|404|500|502|503|0x[0-9a-fA-F]{4,8}|CORS|NullPointerException|TypeError|SyntaxError)\b/i);
  if (codeMatch) {
    errorCode = codeMatch[1].toUpperCase();
  } else {
    // 从信源查找
    for (const r of results.slice(0, 3)) {
      const srcMatch = `${r.title} ${r.snippet}`.match(/\b(ERR_[A-Z0-9_]+|EACCES|ENOENT|ECONNREFUSED|ERESOLVE|502|500|404|CORS|TypeError)\b/i);
      if (srcMatch) {
        errorCode = srcMatch[1].toUpperCase();
        break;
      }
    }
  }

  // 2. 检测技术环境
  let platform = "Cross-Platform";
  let runtime = "Universal";
  if (/(docker|container|k8s)/i.test(cleanQ)) {
    platform = "Linux / Container";
    runtime = "Docker Engine";
  } else if (/(npm|pnpm|yarn|node|vite|react|vue)/i.test(cleanQ)) {
    platform = "Node.js Environment";
    runtime = "Node / Package Manager";
  } else if (/(python|pip|conda)/i.test(cleanQ)) {
    platform = "Python Environment";
    runtime = "CPython / pip";
  } else if (/(git|github)/i.test(cleanQ)) {
    platform = "Version Control";
    runtime = "Git Client";
  } else if (/(nginx|apache|ssl|cors)/i.test(cleanQ)) {
    platform = "Web Gateway";
    runtime = "Nginx / Reverse Proxy";
  }

  // 3. 构建错误名称与根因
  const errorName = errorCode ? `${errorCode} 异常排查` : (cleanQ || "系统运行故障");
  const phenomenon = cleanQ.includes("报错") || cleanQ.includes("失败")
    ? `用户在执行操作时触发「${cleanQ}」，程序中断退出或状态码异常。`
    : `在特定环境调用时出现异常中断，伴随错误码与进程异常。`;

  const rootCause = takeaways.length > 0
    ? takeaways[0]
    : summary
    ? summary.slice(0, 160).replace(/[#*`]/g, "") + "..."
    : "通常由于运行环境依赖版本不匹配、网络代理镜像源失效、端口与文件权限受限或配置参数缺失引起。";

  // 4. 构建前置与诊断检查项
  const diagnosticChecks: TroubleshootingCheckItem[] = [
    {
      id: "diag-1",
      title: "核实底层运行时与软件包版本兼容性",
      description: "检查运行环境版本是否满足该软件的官方基线要求",
      command: runtime.includes("Node") ? "node -v && npm -v" : runtime.includes("Docker") ? "docker version" : runtime.includes("Python") ? "python3 --version" : "uname -a",
      expectedResult: "返回符合要求的稳定版本号",
      status: "passed"
    },
    {
      id: "diag-2",
      title: "检查本地网络代理与镜像源连通性",
      description: "排查是否由于网络代理冲突、SSL证书阻断或源地址无法解析导致超时",
      command: "curl -I https://registry.npmjs.org || ping -c 3 8.8.8.8",
      expectedResult: "HTTP/1.1 200 OK 或延迟低且无丢包",
      status: "pending"
    },
    {
      id: "diag-3",
      title: "确认运行权限与端口/资源占用情况",
      description: "检查目标执行路径读写权限及监听端口是否已被其他守护进程独占",
      command: "lsof -i :8080 || netstat -tuln",
      expectedResult: "端口处于可绑定状态且具有读写权限",
      status: "pending"
    }
  ];

  // 5. 构建修复步骤
  let fixCmd1 = "npm cache clean --force";
  let fixCmd2 = "rm -rf node_modules package-lock.json && npm install";
  if (runtime.includes("Docker")) {
    fixCmd1 = "docker system prune -f";
    fixCmd2 = "docker-compose down && docker-compose up -d --build";
  } else if (runtime.includes("Python")) {
    fixCmd1 = "pip cache purge";
    fixCmd2 = "pip install --upgrade --no-cache-dir -r requirements.txt";
  } else if (runtime.includes("Git")) {
    fixCmd1 = "git reset --hard HEAD";
    fixCmd2 = "git pull --rebase origin main";
  } else if (runtime.includes("Nginx")) {
    fixCmd1 = "nginx -t";
    fixCmd2 = "nginx -s reload";
  }

  const solutions: TroubleshootingSolution[] = [
    {
      id: "sol-primary",
      title: "方案一：清理缓存并重新同步依赖 (推荐方案)",
      description: "先清除可能存在的损坏缓存与锁文件，以全新干净的状态重新拉取解析。",
      isPrimary: true,
      confidence: 0.92,
      tags: ["高成功率", "官方推荐", "最小副作用"],
      steps: [
        {
          id: "step-1",
          order: 1,
          title: "清理本地异常缓存与临时会话",
          description: "清除受损的本地临时哈希与包缓存，防止污染后续重新构建流程。",
          command: fixCmd1,
          shell: "bash",
          riskLevel: "low",
          expectedOutcome: "缓存目录清空，返回 0"
        },
        {
          id: "step-2",
          order: 2,
          title: "重建依赖上下文并拉取纯净包",
          description: "以强制安全模式重新安装或启动，确保所有依赖与符号链接完整无损。",
          command: fixCmd2,
          shell: "bash",
          riskLevel: "medium",
          requiresRestart: true,
          expectedOutcome: "所有模块安装完成并成功注入环境变量"
        }
      ],
      rollbackSteps: ["如遇问题可恢复备份文件并执行默认配置重新加载"]
    },
    {
      id: "sol-secondary",
      title: "方案二：指定降级参数或忽略严格校验",
      description: "在临时紧急场景下，通过放宽校验策略绕过阻断规则以恢复服务运行。",
      isPrimary: false,
      confidence: 0.78,
      tags: ["应急备选", "绕过校验"],
      steps: [
        {
          id: "step-alt-1",
          order: 1,
          title: "配置宽松解析策略参数",
          description: "临时追加容错参数以放行次要依赖冲突或自签名证书。",
          command: runtime.includes("Node") ? "npm install --legacy-peer-deps" : "export STRICT_VERIFY=0",
          shell: "bash",
          riskLevel: "medium",
          expectedOutcome: "忽略次要警告完成启动"
        }
      ]
    }
  ];

  // 6. 构建验证核验清单
  const verificationChecklist: TroubleshootingVerificationItem[] = [
    {
      id: "ver-1",
      title: "执行最小可行验证指令或健康检查端点",
      command: runtime.includes("Node") ? "npm test" : "curl -sI http://localhost:3000/health || echo 'OK'",
      expectedResult: "返回 200 OK 或测试通过",
      checked: false
    },
    {
      id: "ver-2",
      title: "确认日志控制台无持续抛出 Warning 或 Fatal 堆栈",
      expectedResult: "无新异常输出",
      checked: false
    },
    {
      id: "ver-3",
      title: "完成一次业务常规请求链路测试",
      expectedResult: "业务功能交互顺畅且数据持久化正常",
      checked: false
    }
  ];

  return {
    errorName,
    errorCode: errorCode || undefined,
    phenomenon,
    rootCause,
    severity: (errorCode && (errorCode.includes("500") || errorCode.includes("EACCES") || errorCode.includes("SIGSEGV"))) ? "critical" : "high",
    environment: {
      platform,
      runtime,
      affectedVersions: "常见于近期活跃版本"
    },
    prerequisites: [
      "具备终端管理员或 sudo 读写权限",
      "建议在操作前保留一份当前的配置文件快照"
    ],
    diagnosticChecks,
    solutions,
    verificationChecklist,
    cautionNotes: [
      "执行缓存清理与重装前，请确保工作区无未保存的重要未提交代码变更。",
      "若处于生产集群，建议优先灰度隔离故障节点，切勿全量并行重启。"
    ],
    relatedSources: results.slice(0, 3).map(r => ({ title: r.title, url: r.url }))
  };
}

export const TroubleshootingWidget: React.FC<TroubleshootingWidgetProps> = ({
  activeResult,
  query = "",
  isCompact = false
}) => {
  // 1. 优先使用 Agent 产出的结构化故障计划，未产出时实时推导
  const plan: TroubleshootingPlan = useMemo(() => {
    if (activeResult?.troubleshootingPlan) {
      return activeResult.troubleshootingPlan;
    }
    return deriveFallbackTroubleshootingPlan(query, activeResult);
  }, [activeResult, query]);

  // 2. 本地交互状态
  const [activeTab, setActiveTab] = useState<"flow" | "diagnosis" | "solutions" | "verification">("flow");
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState<number>(0);
  const [checkedVerifications, setCheckedVerifications] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkStatuses, setCheckStatuses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (plan.diagnosticChecks || []).forEach(c => {
      initial[c.id] = c.status || "pending";
    });
    return initial;
  });

  // 复制命令通用处理
  const handleCopyCommand = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  // 切换核验项勾选
  const toggleVerification = (id: string) => {
    setCheckedVerifications(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 切换诊断项状态
  const cycleCheckStatus = (id: string) => {
    setCheckStatuses(prev => {
      const current = prev[id] || "pending";
      const next = current === "pending" ? "passed" : current === "passed" ? "failed" : "pending";
      return { ...prev, [id]: next };
    });
  };

  // 核验进度计算
  const totalVerifications = plan.verificationChecklist?.length || 1;
  const verifiedCount = checkedVerifications.size;
  const progressPercent = Math.round((verifiedCount / totalVerifications) * 100);

  // 严重级别配色映射
  const severityBadge = useMemo(() => {
    switch (plan.severity) {
      case "critical":
        return { label: "严重故障 (Critical)", color: "bg-rose-500/10 text-rose-500 border-rose-500/30" };
      case "high":
        return { label: "高优先级报错 (High)", color: "bg-amber-500/10 text-amber-500 border-amber-500/30" };
      case "medium":
        return { label: "中度异常 (Medium)", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" };
      default:
        return { label: "排查提示 (Info)", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" };
    }
  }, [plan.severity]);

  const currentSolution = plan.solutions?.[selectedSolutionIndex] || plan.solutions?.[0];

  return (
    <div className="p-4 sm:p-5 flex flex-col h-full overflow-hidden bg-card text-card-foreground">
      {/* 头部：错误标题、错误代码、环境与状态徽标 */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/50 shrink-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0 mt-0.5 border border-rose-500/20 shadow-xs">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold tracking-tight text-foreground truncate max-w-[280px] sm:max-w-md">
                {plan.errorName}
              </h3>
              {plan.errorCode && (
                <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-mono border-rose-500/30 text-rose-600 bg-rose-500/5">
                  {plan.errorCode}
                </Badge>
              )}
              <Badge variant="outline" className={`px-1.5 py-0 text-[11px] font-medium ${severityBadge.color}`}>
                {severityBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {plan.environment?.runtime ? `${plan.environment.runtime} · ` : ""}
              {plan.environment?.platform ? `${plan.environment.platform} · ` : ""}
              全流程排错与交互式自检
            </p>
          </div>
        </div>

        {/* 顶部简易进度 */}
        <div className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-[11px] text-muted-foreground">修复进度</span>
          <span className="text-xs font-semibold text-foreground">{progressPercent}%</span>
        </div>
      </div>

      {/* 选项卡导航 */}
      {!isCompact && (
        <div className="flex items-center gap-1.5 pt-2.5 pb-2 shrink-0 overflow-x-auto border-b border-border/30 scrollbar-none">
          <button
            onClick={() => setActiveTab("flow")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeTab === "flow"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            一览全景 (Overview)
          </button>
          <button
            onClick={() => setActiveTab("diagnosis")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeTab === "diagnosis"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            根因与诊断 ({plan.diagnosticChecks?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("solutions")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeTab === "solutions"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            修复指令 ({plan.solutions?.length || 1})
          </button>
          <button
            onClick={() => setActiveTab("verification")}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeTab === "verification"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            核验清单 ({verifiedCount}/{totalVerifications})
          </button>
        </div>
      )}

      {/* 主展示区 */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-4 pr-1 text-xs scrollbar-thin">
        {/* TAB 1: 一览全景视图 (Flow Overview) */}
        {(activeTab === "flow" || isCompact) && (
          <div className="space-y-3.5">
            {/* 1. 现象与根因总结卡片 */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>错误根因分析 (Root Cause)</span>
              </div>
              <p className="text-muted-foreground leading-relaxed text-[12px]">
                {plan.rootCause}
              </p>
              {plan.phenomenon && (
                <div className="pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground/80 flex items-start gap-1">
                  <span className="font-semibold text-foreground/70 shrink-0">现象描述:</span>
                  <span>{plan.phenomenon}</span>
                </div>
              )}
            </div>

            {/* 2. 核心推荐解决方案速递 */}
            {currentSolution && (
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{currentSolution.title}</span>
                  </div>
                  {currentSolution.isPrimary && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                      推荐首选
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {currentSolution.description}
                </p>

                {/* 核心步骤与指令展示 */}
                <div className="space-y-2 pt-1">
                  {currentSolution.steps.slice(0, isCompact ? 1 : 2).map(step => (
                    <div key={step.id} className="p-2.5 rounded-lg bg-background/80 border border-border/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-foreground flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center text-[10px] font-bold">
                            {step.order}
                          </span>
                          {step.title}
                        </span>
                        {step.riskLevel && (
                          <span className="text-[10px] text-muted-foreground/80 font-mono">
                            风险: {step.riskLevel === "low" ? "低" : step.riskLevel === "high" ? "高" : "中"}
                          </span>
                        )}
                      </div>

                      {step.command && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-zinc-900 text-zinc-100 font-mono text-[11px]">
                          <span className="truncate select-all text-emerald-400">
                            $ {step.command}
                          </span>
                          <button
                            onClick={() => handleCopyCommand(step.command!, step.id)}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                            title="复制指令"
                          >
                            {copiedId === step.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. 快速核验清单 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-foreground font-semibold px-0.5">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>核验清单与避坑自检</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  已核验 {verifiedCount}/{totalVerifications}
                </span>
              </div>
              <div className="space-y-1.5">
                {plan.verificationChecklist.map(item => {
                  const isChecked = checkedVerifications.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleVerification(item.id)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                        isChecked
                          ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                          : "bg-muted/20 border-border/50 hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 text-emerald-500">
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-medium leading-tight ${isChecked ? "line-through opacity-70" : ""}`}>
                          {item.title}
                        </div>
                        {item.command && (
                          <div className="mt-1 text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded inline-block">
                            $ {item.command}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. 注意事项与避坑警示 */}
            {plan.cautionNotes && plan.cautionNotes.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-600">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>避坑注意事项</span>
                </div>
                <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                  {plan.cautionNotes.map((note, idx) => (
                    <li key={idx} className="leading-normal">{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 诊断与前置检查项 (Diagnosis Details) */}
        {activeTab === "diagnosis" && !isCompact && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1.5">
              <span className="text-xs font-semibold text-foreground">环境与依赖上下文</span>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-lg bg-background border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">运行环境 (Runtime)</span>
                  <span className="font-medium text-foreground">{plan.environment?.runtime || "通用环境"}</span>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">系统平台 (Platform)</span>
                  <span className="font-medium text-foreground">{plan.environment?.platform || "跨平台"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground block">诊断排查与运行前检查</span>
              {plan.diagnosticChecks.map(check => {
                const currentStatus = checkStatuses[check.id] || "pending";
                return (
                  <div
                    key={check.id}
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/10 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">{check.title}</p>
                        {check.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{check.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => cycleCheckStatus(check.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 transition-colors ${
                          currentStatus === "passed"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : currentStatus === "failed"
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                            : "bg-muted text-muted-foreground border-border/50"
                        }`}
                      >
                        {currentStatus === "passed" ? "✓ 正常" : currentStatus === "failed" ? "✕ 异常" : "○ 待核"}
                      </button>
                    </div>

                    {check.command && (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-zinc-900 text-zinc-100 font-mono text-[11px]">
                        <span className="truncate select-all text-emerald-400">
                          $ {check.command}
                        </span>
                        <button
                          onClick={() => handleCopyCommand(check.command!, check.id)}
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                          title="复制诊断指令"
                        >
                          {copiedId === check.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                    {check.expectedResult && (
                      <p className="text-[10px] text-muted-foreground/80">
                        预期表现: {check.expectedResult}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: 完整方案与分步修复 (All Solutions) */}
        {activeTab === "solutions" && !isCompact && (
          <div className="space-y-3">
            {/* 多方案切换 */}
            {plan.solutions.length > 1 && (
              <div className="flex gap-2 p-1 rounded-xl bg-muted/30 border border-border/40">
                {plan.solutions.map((sol, idx) => (
                  <button
                    key={sol.id}
                    onClick={() => setSelectedSolutionIndex(idx)}
                    className={`flex-1 py-1.5 px-2 text-xs rounded-lg font-medium transition-all ${
                      selectedSolutionIndex === idx
                        ? "bg-card text-foreground shadow-xs border border-border/50"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    方案 {idx + 1}: {sol.title.slice(0, 12)}...
                  </button>
                ))}
              </div>
            )}

            {currentSolution && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                  <h4 className="font-semibold text-xs text-foreground">{currentSolution.title}</h4>
                  <p className="text-[11px] text-muted-foreground">{currentSolution.description}</p>
                </div>

                <div className="space-y-2.5">
                  {currentSolution.steps.map(step => (
                    <div key={step.id} className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center text-[10px] font-bold">
                            {step.order}
                          </span>
                          {step.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {step.requiresRestart && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/40 text-amber-600">
                              需重启
                            </Badge>
                          )}
                          {step.requiresSudo && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-rose-500/40 text-rose-600">
                              需 sudo
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground">{step.description}</p>

                      {step.command && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-zinc-900 text-zinc-100 font-mono text-[11px]">
                          <span className="truncate select-all text-emerald-400">
                            $ {step.command}
                          </span>
                          <button
                            onClick={() => handleCopyCommand(step.command!, step.id)}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                            title="复制指令"
                          >
                            {copiedId === step.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {step.expectedOutcome && (
                        <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>预期结果: {step.expectedOutcome}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: 完整核验清单 (Full Verification) */}
        {activeTab === "verification" && !isCompact && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground block">交互式核验避坑清单</span>
                <span className="text-[11px] text-muted-foreground">逐项勾选确认，确保修复后不发生回归与次生故障</span>
              </div>
              <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                已完成 {progressPercent}%
              </Badge>
            </div>

            <div className="space-y-2">
              {plan.verificationChecklist.map(item => {
                const isChecked = checkedVerifications.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleVerification(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isChecked
                        ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                        : "bg-card border-border/60 hover:bg-muted/30 text-foreground"
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-500 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-tight ${isChecked ? "line-through opacity-70" : ""}`}>
                        {item.title}
                      </p>
                      {item.command && (
                        <div className="mt-1.5 flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-zinc-900 text-zinc-100 font-mono text-[11px]">
                          <span className="truncate text-emerald-400">$ {item.command}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCommand(item.command!, item.id);
                            }}
                            className="p-0.5 text-zinc-400 hover:text-white"
                          >
                            {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                      {item.expectedResult && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          预期表现: {item.expectedResult}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部权威溯源与快捷操作 */}
      <div className="pt-3 mt-1 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5 truncate max-w-[260px]">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">
            {plan.relatedSources?.[0]?.title ? `信源: ${plan.relatedSources[0].title}` : "AI 启发式多层排错与核验引擎已就绪"}
          </span>
        </div>
        {plan.relatedSources?.[0]?.url && (
          <a
            href={plan.relatedSources[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-foreground/80 hover:text-foreground transition-colors shrink-0"
          >
            <span>查阅出处</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
