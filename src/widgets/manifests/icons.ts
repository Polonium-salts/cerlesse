import type { ComponentType } from "react";
import {
  CheckCircle2,
  Compass,
  Database,
  FileText,
  GitFork,
  Layers,
  Link2,
  MessageSquare,
  Power,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Workflow,
  Zap
} from "lucide-react";

/**
 * 清单图标白名单 (Manifest Icon Registry)
 * ============================================================
 * JSON 清单里图标只能写成字符串（`"icon": "Zap"`），因为 JSON 无法承载
 * React 组件。这里维护一份**显式白名单**，把名称解析回真实的图标组件。
 *
 * 为什么不直接 `import { icons } from "lucide-react"` 动态取：
 * 那会把 lucide 全部约 1600 个图标都打进产物（数百 KB），而小组件目录
 * 实际只用到 16 个。白名单让打包器能静态摇树，只保留用到的这些。
 *
 * 新增小组件时：在下方 import 里补上图标、在 ICON_REGISTRY 里挂一条映射。
 * 若清单写了白名单外的名称，resolveManifestIcon 返回 undefined，
 * 消费方（插件市场）会回落到默认的 Layers 图标 —— 界面不会崩，只是图标退化。
 */
const ICON_REGISTRY: Record<string, ComponentType<{ className?: string }>> = {
  CheckCircle2,
  Compass,
  Database,
  FileText,
  GitFork,
  Layers,
  Link2,
  MessageSquare,
  Power,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Workflow,
  Zap
};

/** 名称解析失败时的兜底图标 */
export const FALLBACK_MANIFEST_ICON: ComponentType<{ className?: string }> = Layers;

/** 把清单里的图标名解析为图标组件；未命中返回 undefined（交由调用方兜底） */
export function resolveManifestIcon(
  name?: string
): ComponentType<{ className?: string }> | undefined {
  if (!name) return undefined;
  return ICON_REGISTRY[name];
}

/** 白名单里全部可用的图标名（供校验脚本与文档使用） */
export const KNOWN_MANIFEST_ICONS: string[] = Object.keys(ICON_REGISTRY);
