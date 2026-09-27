import React, { useState } from "react";
import {
  SlidersHorizontal,
  ArrowLeft,
  Sparkles,
  Server,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Cpu
} from "lucide-react";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card.js";
import type { UserSettings, AiApiModel } from "../types.js";

interface ModelSettingsPageProps {
  settings: UserSettings;
  onUpdateSettings: (newPartial: Partial<UserSettings>) => void;
  availableModels: AiApiModel[];
  isServerKeyConfigured: boolean;
  isServerDisabled: boolean;
  defaultServerModel: string;
  onBack: () => void;
  onGoToSearch?: (query?: string) => void;
}

export function ModelSettingsPage({
  settings,
  onUpdateSettings,
  availableModels,
  isServerKeyConfigured,
  isServerDisabled,
  defaultServerModel,
  onBack,
  onGoToSearch
}: ModelSettingsPageProps) {
  const [model, setModel] = useState(settings.selectedModel || defaultServerModel || "deepseek/deepseek-v4-flash");
  const [customKey, setCustomKey] = useState(settings.customApiKey || "");
  const [customBaseUrl, setCustomBaseUrl] = useState(settings.customApiBaseUrl || "");
  const [searxngUrl, setSearxngUrl] = useState(settings.searxngCustomUrl || "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onUpdateSettings({
      selectedModel: model.trim(),
      customApiKey: customKey.trim() || undefined,
      customApiBaseUrl: customBaseUrl.trim() || undefined,
      searxngCustomUrl: searxngUrl.trim()
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const presetProviders = [
    {
      id: "unorouter",
      name: "UnoRouter (推荐网关)",
      badge: "238+ 模型 / 117+ 免费",
      url: "https://api.unorouter.com/v1",
      site: "https://unorouter.com",
      defaultModel: "deepseek/deepseek-v4-flash",
      desc: "一个 API Key 打通 238+ 模型，支持自动故障转移与模型真实性校验。"
    },
    {
      id: "deepseek",
      name: "DeepSeek 官方直连",
      badge: "极速 / 1M 上下文",
      url: "https://api.deepseek.com/v1",
      site: "https://platform.deepseek.com",
      defaultModel: "deepseek-v4-flash",
      desc: "DeepSeek 官方大模型 API，推理速度快，超高性价比与大上下文。"
    },
    {
      id: "openrouter",
      name: "OpenRouter 聚合网关",
      badge: "多模型路由",
      url: "https://openrouter.ai/api/v1",
      site: "https://openrouter.ai",
      defaultModel: "openrouter/free",
      desc: "支持广泛的上游模型与免费路由模型池。"
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-amber-500" />
              模型与网关设置
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              配置 AI Agent 大模型调用来源与 SearXNG 检索节点
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="size-3.5" /> 已保存
            </span>
          )}
          <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground">
            保存配置
          </Button>
        </div>
      </div>

      {/* 服务端就绪指示 */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-xs flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isServerKeyConfigured ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
            {isServerKeyConfigured ? <ShieldCheck className="size-5" /> : <AlertCircle className="size-5" />}
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground flex items-center gap-2">
              服务端模型网关状态：
              {isServerDisabled ? (
                <span className="text-destructive font-mono text-xs">已禁用 (AI_API_DISABLED)</span>
              ) : isServerKeyConfigured ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-mono">已就绪 (Server Configured)</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 text-xs font-mono">未配服务端 Key（可通过下方客户端自定义）</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              默认模型：<code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono">{defaultServerModel || "未指定"}</code>
            </p>
          </div>
        </div>

        {onGoToSearch && (
          <Button variant="outline" size="sm" onClick={() => onGoToSearch()} className="text-xs gap-1.5 shrink-0">
            <Sparkles className="size-3.5 text-primary" />
            快速测试搜索
          </Button>
        )}
      </div>

      {/* 快捷供应商预设 */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">快捷预设模板</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presetProviders.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-xl border border-border bg-card/40 hover:bg-card/80 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
              onClick={() => {
                setCustomBaseUrl(p.url);
                setModel(p.defaultModel);
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    {p.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.desc}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                <span className="font-mono truncate max-w-[160px]">{p.defaultModel}</span>
                <a
                  href={p.site}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground flex items-center gap-0.5 text-primary"
                >
                  官网 <ExternalLink className="size-2.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 自定义配置表单 */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="size-4 text-primary" />
            自定义 API 网关与模型覆盖
          </CardTitle>
          <CardDescription className="text-xs">
            若留空则优先使用服务端的全局环境变量（.env）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center justify-between">
              <span>模型名称 (Model ID)</span>
              <span className="text-muted-foreground text-[11px]">如 deepseek/deepseek-v4-flash, gpt-4o-mini 等</span>
            </Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如：deepseek/deepseek-v4-flash"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center justify-between">
              <span>API Base URL (可选)</span>
              <span className="text-muted-foreground text-[11px]">如 https://api.unorouter.com/v1</span>
            </Label>
            <Input
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="默认自动根据网关匹配"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center justify-between">
              <span>API Key (可选)</span>
              <span className="text-muted-foreground text-[11px]">UnoRouter / DeepSeek / OpenAI Key</span>
            </Label>
            <Input
              type="password"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="sk-..."
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label className="text-xs flex items-center justify-between">
              <span>SearXNG 搜索节点地址 (可选)</span>
              <span className="text-muted-foreground text-[11px]">留空使用集群内置服务</span>
            </Label>
            <Input
              value={searxngUrl}
              onChange={(e) => setSearxngUrl(e.target.value)}
              placeholder="https://your-searxng-instance.com"
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
