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
  Cpu,
  Loader2,
  Check
} from "lucide-react";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card.js";
import type { UserSettings, AiApiModel } from "../types.js";
import { useModelProviderStore } from "../state/modelProviderStore.js";

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
  availableModels: propAvailableModels,
  isServerKeyConfigured,
  isServerDisabled,
  defaultServerModel,
  onBack,
  onGoToSearch
}: ModelSettingsPageProps) {
  const {
    models: storeModels,
    detectAndLoadModels,
    isDetecting,
    detectedProviderName
  } = useModelProviderStore();

  const [model, setModel] = useState(settings.selectedModel || defaultServerModel || "deepseek-chat");
  const [customKey, setCustomKey] = useState(settings.customApiKey || "");
  const [customBaseUrl, setCustomBaseUrl] = useState(settings.customApiBaseUrl || "");
  const [searxngUrl, setSearxngUrl] = useState(settings.searxngCustomUrl || "");
  const [detectFeedback, setDetectFeedback] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const effectiveModels = storeModels.length > 0 ? storeModels : propAvailableModels;

  const handleDetect = async () => {
    setDetectFeedback("正在连接并自动探测模型列表...");
    const res = await detectAndLoadModels(customKey.trim() || undefined, customBaseUrl.trim() || undefined);
    if (res && res.models.length > 0) {
      setDetectFeedback(`成功识别【${res.provider}】，已动态加载 ${res.models.length} 个可用模型`);
      if (res.defaultModel && !res.models.some((m) => m.id === model)) {
        setModel(res.defaultModel);
      }
    } else {
      setDetectFeedback("未检测到有效模型，请检查 API Key 或网络地址");
    }
  };

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
      id: "deepseek",
      name: "DeepSeek 官方直连",
      badge: "极速 / 1M 上下文",
      url: "https://api.deepseek.com/v1",
      site: "https://platform.deepseek.com",
      defaultModel: "deepseek-chat",
      desc: "DeepSeek 官方大模型 API，推理速度快，超高性价比与大上下文。"
    },
    {
      id: "unorouter",
      name: "UnoRouter (推荐网关)",
      badge: "238+ 模型 / 117+ 免费",
      url: "https://api.unorouter.com/v1",
      site: "https://unorouter.com",
      defaultModel: "deepseek/deepseek-chat",
      desc: "一个 API Key 打通 238+ 模型，支持自动故障转移与模型真实性校验。"
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
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 cursor-pointer">
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              模型与 API 设置
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              输入 API Key 即可自动识别上游服务与加载所有可用模型
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="size-3.5" /> 已保存
            </span>
          )}
          <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground cursor-pointer">
            保存配置
          </Button>
        </div>
      </div>

      {/* 服务端就绪指示 */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-xs flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isServerKeyConfigured || customKey ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
            {isServerKeyConfigured || customKey ? <ShieldCheck className="size-5" /> : <AlertCircle className="size-5" />}
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground flex items-center gap-2">
              模型服务状态：
              {isServerDisabled ? (
                <span className="text-destructive font-mono text-xs">已禁用 (AI_API_DISABLED)</span>
              ) : customKey ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-mono">自定义 API Key 已就绪 ({detectedProviderName || "已识别"})</span>
              ) : isServerKeyConfigured ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-mono">服务端环境已配置 ({detectedProviderName || "就绪"})</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 text-xs font-mono">未配 API Key（在下方输入即可自动探测加载）</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              当前激活模型：<code className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono font-semibold">{model || "未指定"}</code>
            </p>
          </div>
        </div>

        {onGoToSearch && (
          <Button variant="outline" size="sm" onClick={() => onGoToSearch()} className="text-xs gap-1.5 shrink-0 cursor-pointer">
            <Sparkles className="size-3.5 text-primary" />
            测试搜索
          </Button>
        )}
      </div>

      {/* 快捷供应商预设 */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">快捷服务模板</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presetProviders.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-xl border border-border bg-card/40 hover:bg-card/80 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
              onClick={() => {
                setCustomBaseUrl(p.url);
                setModel(p.defaultModel);
                detectAndLoadModels(customKey || undefined, p.url, p.id);
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
            API Key 与模型动态加载
          </CardTitle>
          <CardDescription className="text-xs">
            输入 API Key 后点击探测，系统将实时请求上游 `/models` 接口获取所有真实可用模型
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center justify-between">
              <span>API Key</span>
              <span className="text-muted-foreground text-[11px]">支持 DeepSeek、UnoRouter、OpenRouter、Groq、OpenAI</span>
            </Label>
            <Input
              type="password"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="粘贴 sk-... / gsk_... 密钥"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center justify-between">
              <span>API Base URL (可选)</span>
              <span className="text-muted-foreground text-[11px]">留空根据 Key 格式智能匹配默认网关</span>
            </Label>
            <Input
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="例如：https://api.deepseek.com/v1"
              className="font-mono text-xs"
            />
          </div>

          {/* 探测按钮与反馈 */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDetecting}
              onClick={handleDetect}
              className="text-xs gap-1.5 cursor-pointer"
            >
              {isDetecting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5 text-primary" />}
              <span>自动探测并拉取可用模型</span>
            </Button>
            {detectFeedback && (
              <span className="text-xs text-muted-foreground">{detectFeedback}</span>
            )}
          </div>

          {/* 动态加载的模型列表 */}
          {effectiveModels.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs flex items-center justify-between">
                <span>可用模型列表（点击直接选定）</span>
                <span className="text-muted-foreground text-[11px]">已加载 {effectiveModels.length} 个模型</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg border-border/60 bg-muted/20">
                {effectiveModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m.id)}
                    className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex flex-col justify-between ${
                      model === m.id
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 bg-background/60 hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{m.name || m.id}</span>
                      {model === m.id && <Check className="size-3 text-primary shrink-0" />}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground truncate mt-1">
                      {m.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label className="text-xs flex items-center justify-between">
              <span>当前选中模型 ID</span>
              <span className="text-muted-foreground text-[11px]">可手动输入或点击上方卡片选择</span>
            </Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如：deepseek-chat"
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
