import React from "react";
import { WidgetModule, ResultWidgetKey } from "./sdk/types.js";
import { safeInstantiateWidgetModule } from "./sdk/sandbox.js";
import type { TileWidth } from "../lib/tileLayoutEngine.js";
import { WidgetSchemaRenderer } from "./schemaRenderer.js";
import { TileAtomRenderer } from "./tileRenderer.js";
import { RemoteWidgetManifest, resolveCdnAssetUrl, fetchRemoteWidgetManifest } from "./sdk/cdnResolver.js";
import { resolveManifestIcon, FALLBACK_MANIFEST_ICON } from "./manifests/icons.js";
import { extensionRegistry, ExtensionRegistry } from "./registry/extensionRegistry.js";
import { initializeWidgetExtensions } from "./registry/index.js";
import { createModuleFromExtension } from "./sdk/extension.js";

// 自动发现并注册全部小组件扩展（实现零改动插件式接入）
initializeWidgetExtensions();

/**
 * 全局小组件注册中心 (Central Widget Registry)
 * 架构统一：
 * 1. 扩展组件 (Extension Registry) - 单一权威来源 (Single Source of Truth)
 * 2. 社区/远程组件 (remoteModules) - jsDelivr / GitHub 插件
 * 3. 运行时 AI 动态卡片 (runtimeModules) - 仅运行时渲染实例，不污染组件商店
 */
class WidgetRegistryClass {
  private remoteModules: Map<string, WidgetModule> = new Map();
  private runtimeModules: Map<string, WidgetModule> = new Map();

  constructor() {
    initializeWidgetExtensions();
  }

  /**
   * 重新加载扩展组件（供 UI 或测试刷新时使用）
   */
  public rehydrate(): void {
    initializeWidgetExtensions();
  }

  /**
   * 注册标准 JS Widget 模块（根据 ID 与分类自动归类到分区）
   */
  public register(module: WidgetModule): void {
    if (!module || !module.id) {
      console.warn(
        "[WidgetRegistry] 忽略无效的小组件模块（缺少 id）。",
        module
      );
      return;
    }

    const idStr = String(module.id);
    if (idStr.startsWith("custom_card__") || idStr.startsWith("custom-card-") || idStr.startsWith("schema-widget-")) {
      this.runtimeModules.set(idStr, module);
    } else {
      this.remoteModules.set(idStr, module);
    }
  }

  /**
   * 注册官方组件（兼容方法，重定向到通用 register）
   */
  public registerOfficial(module: WidgetModule): void {
    this.register(module);
  }

  /**
   * 注册社区/远程组件
   */
  public registerRemote(module: WidgetModule): void {
    if (module && module.id) {
      this.remoteModules.set(String(module.id), module);
    }
  }

  /**
   * 注册运行时动态组件
   */
  public registerRuntime(module: WidgetModule): void {
    if (module && module.id) {
      this.runtimeModules.set(String(module.id), module);
    }
  }

  /**
   * 批量注册模块
   */
  public registerAll(modules: WidgetModule[]): void {
    if (!Array.isArray(modules)) {
      console.error("[WidgetRegistry] registerAll 收到非法清单，已跳过:", modules);
      return;
    }
    modules.forEach((m) => this.register(m));
  }

  /**
   * 注销模块（全分区清理）
   */
  public unregister(id: string | ResultWidgetKey): void {
    const idStr = String(id);
    this.remoteModules.delete(idStr);
    this.runtimeModules.delete(idStr);
  }

  /**
   * 诊断指定组件的注册状态
   */
  public diagnose(id: string | ResultWidgetKey) {
    const idStr = String(id);
    return {
      id: idStr,
      inExtensionRegistry: extensionRegistry.has(idStr),
      inRemoteRegistry: this.remoteModules.has(idStr),
      inRuntimeRegistry: this.runtimeModules.has(idStr),
      totalExtensions: extensionRegistry.getAll().length,
      totalWidgets: this.getAll().length
    };
  }

  /**
   * 获取指定 ID 的组件模块（按独立扩展 -> 远程 -> 运行时 顺序逐级检索）
   */
  public get(id: string | ResultWidgetKey): WidgetModule | undefined {
    const idStr = String(id);
    const ext = extensionRegistry.get(idStr);
    if (ext) {
      return createModuleFromExtension(ext);
    }
    const remote = this.remoteModules.get(idStr);
    if (remote) {
      return remote;
    }
    const runtime = this.runtimeModules.get(idStr);
    if (runtime) {
      return runtime;
    }

    console.error(
      "[WidgetRegistry] Widget not found",
      this.diagnose(idStr)
    );

    return undefined;
  }

  /**
   * 判断是否存在模块
   */
  public has(id: string | ResultWidgetKey): boolean {
    const idStr = String(id);
    return (
      extensionRegistry.has(idStr) ||
      this.remoteModules.has(idStr) ||
      this.runtimeModules.has(idStr)
    );
  }

  /**
   * 获取所有已注册的组件模块列表（扩展权威列表 + 远程 + 运行时）
   */
  public getAll(): WidgetModule[] {
    const extModules = extensionRegistry.getAll().map(ext => createModuleFromExtension(ext));
    const set = new Set<string>();
    const res: WidgetModule[] = [];
    for (const m of [
      ...extModules,
      ...Array.from(this.remoteModules.values()),
      ...Array.from(this.runtimeModules.values())
    ]) {
      if (!set.has(String(m.id))) {
        set.add(String(m.id));
        res.push(m);
      }
    }
    return res;
  }

  /**
   * 获取官方组件列表（直接来自 extensionRegistry）
   */
  public getOfficialWidgets(): WidgetModule[] {
    return extensionRegistry.getAll().map(ext => createModuleFromExtension(ext));
  }

  /**
   * 获取社区/远程组件列表
   */
  public getRemoteWidgets(): WidgetModule[] {
    return Array.from(this.remoteModules.values());
  }

  /**
   * 获取运行时动态组件列表
   */
  public getRuntimeWidgets(): WidgetModule[] {
    return Array.from(this.runtimeModules.values());
  }

  /**
   * 获取小组件商店展示列表（权威扩展组件 + 远程社区组件）
   */
  public getMarketplaceWidgets(): WidgetModule[] {
    const extModules = extensionRegistry.getAll().map(ext => createModuleFromExtension(ext));
    return [
      ...extModules,
      ...Array.from(this.remoteModules.values())
    ];
  }

  /**
   * 获取 Agent 可自主选型的组件白名单（权威扩展组件 + 允许 Agent 调用的远程组件）
   */
  public getAgentSelectableWidgets(): WidgetModule[] {
    const extModules = extensionRegistry.getAll().map(ext => createModuleFromExtension(ext));
    const allowedRemotes = Array.from(this.remoteModules.values()).filter(
      (m) => m.agentHint?.selectable !== false
    );
    return [...extModules, ...allowedRemotes];
  }

  /**
   * 从动态 JS 代码字符串中编译并安全沙箱注册新组件
   */
  public loadDynamicWidget(id: string, codeString: string): WidgetModule | null {
    const module = safeInstantiateWidgetModule(codeString);
    if (module) {
      module.id = id || module.id;
      this.register(module);
      return module;
    }
    return null;
  }

  /**
   * 将解析出来的远程 CDN 清单注册为标准 Widget 模块
   */
  public registerRemoteManifest(manifest: RemoteWidgetManifest, baseUrl: string = ""): WidgetModule {
    const id = manifest.id;
    const width: TileWidth = manifest.grid?.width || 50;
    const supportedWidths: TileWidth[] = manifest.grid?.supportedWidths || [25, 50, 75, 100];

    // 处理图标：优先解析 Lucide 白名单；若为图片/SVG相对路径，转为绝对 CDN 地址
    let IconComponent: React.ComponentType<{ className?: string }> | undefined;
    let iconUrl: string | undefined;

    if (manifest.icon) {
      const resolvedIcon = resolveManifestIcon(manifest.icon);
      if (resolvedIcon) {
        IconComponent = resolvedIcon;
      } else if (
        manifest.icon.startsWith("http://") || 
        manifest.icon.startsWith("https://") || 
        manifest.icon.startsWith("data:") ||
        manifest.icon.endsWith(".svg") ||
        manifest.icon.endsWith(".png") ||
        manifest.icon.endsWith(".webp")
      ) {
        iconUrl = resolveCdnAssetUrl(manifest.icon, baseUrl);
        IconComponent = ({ className }: { className?: string }) => (
          <img
            src={iconUrl}
            alt={manifest.name}
            className={`${className || "w-4 h-4"} object-contain`}
            crossOrigin="anonymous"
            loading="lazy"
          />
        );
      }
    }

    if (!IconComponent) {
      IconComponent = FALLBACK_MANIFEST_ICON;
    }

    const remoteModule: WidgetModule = {
      id,
      name: manifest.name,
      version: manifest.version || "1.0.0",
      description: manifest.description || `${manifest.name} (来自 jsDelivr/GitHub 远程小组件)`,
      category: manifest.category || "custom",
      tags: manifest.tags || ["远程组件", "jsDelivr"],
      agentHint: manifest.agentHint,
      icon: IconComponent,
      width,
      supportedWidths,
      tileTheme: manifest.theme,
      schema: manifest.schema,
      render: (ctx) => {
        // 1. 如果包含 Schema 声明式组件树
        if (manifest.schema) {
          return <WidgetSchemaRenderer schema={manifest.schema} context={ctx} />;
        }

        // 2. 如果包含静态 Tile 模板描述
        if (manifest.tileTemplate) {
          return <TileAtomRenderer descriptor={manifest.tileTemplate} context={ctx} />;
        }

        // 3. 兜底优雅渲染
        return (
          <div className="p-4 rounded-xl border border-border bg-card h-full flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <IconComponent className="w-5 h-5 text-primary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground text-sm leading-tight">{manifest.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {manifest.description || "远程小组件运行中"}
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/80 flex items-center justify-between border-t border-border/60 pt-2 mt-2">
              <span>jsDelivr v{manifest.version}</span>
              <span className="truncate max-w-[150px]">{id}</span>
            </div>
          </div>
        );
      }
    };

    this.register(remoteModule);
    return remoteModule;
  }

  /**
   * 从用户输入的 GitHub/npm/jsDelivr 链接中自动拉取并注册远程小组件
   */
  public async registerRemoteWidgetFromCdn(input: string): Promise<{
    module: WidgetModule;
    manifest: RemoteWidgetManifest;
    cdnInfo: any;
  }> {
    const { manifest, parsedCdn } = await fetchRemoteWidgetManifest(input);
    const module = this.registerRemoteManifest(manifest, parsedCdn.baseUrl);

    // 如果清单中声明了 entry (JS 动态代码模块)，尝试通过 fetch 安全加载
    if (manifest.entry) {
      try {
        const entryUrl = resolveCdnAssetUrl(manifest.entry, parsedCdn.baseUrl);
        const res = await fetch(entryUrl);
        if (res.ok) {
          const codeString = await res.text();
          const dynamicMod = safeInstantiateWidgetModule(codeString);
          if (dynamicMod) {
            // 合并动态组件的 render 与 actions
            if (dynamicMod.render) module.render = dynamicMod.render;
            if (dynamicMod.renderBack) module.renderBack = dynamicMod.renderBack;
            if (dynamicMod.actions) module.actions = dynamicMod.actions;
            this.register(module);
          }
        }
      } catch (entryErr) {
        console.warn(`[WidgetRegistry] 加载远程 JS 入口失败 (${manifest.entry}):`, entryErr);
      }
    }

    return {
      module,
      manifest,
      cdnInfo: parsedCdn
    };
  }
}

/**
 * 全局单例锚点 (HMR-Safe Singleton)
 *
 * 为什么不能直接 `new WidgetRegistryClass()`：
 * 模块级单例只在「同一份模块图」内成立。一旦模块被重复求值
 * （HMR 重建、或同一文件被 `.js` / `.tsx` 等不同 specifier 分别加载），
 * 就会产生**多个互不相通的注册中心**——组件把模块登记进实例 A，
 * 磁贴却去实例 B 查询，界面便退化成"部分小组件未注册"的空框。
 *
 * 因此把实例锚定到 globalThis：无论模块被求值多少次，
 * 全应用始终共享同一个注册中心。
 */
interface WidgetRegistryGlobal {
  __CERLESSE_WIDGET_REGISTRY__?: WidgetRegistryClass;
}

const registryGlobal = globalThis as unknown as WidgetRegistryGlobal;

export const WidgetRegistry: WidgetRegistryClass =
  registryGlobal.__CERLESSE_WIDGET_REGISTRY__ ??
  (registryGlobal.__CERLESSE_WIDGET_REGISTRY__ = new WidgetRegistryClass());
