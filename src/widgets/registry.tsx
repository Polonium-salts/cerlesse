import React from "react";
import { WidgetModule, ResultWidgetKey } from "./sdk/types.js";
import { safeInstantiateWidgetModule } from "./sdk/sandbox.js";
import { CustomCardData } from "../types.js";
import type { TileWidth } from "../lib/tileLayoutEngine.js";
import { WidgetSchemaRenderer } from "./schemaRenderer.js";
import { TileAtomRenderer } from "./tileRenderer.js";
import { OFFICIAL_WIDGET_MODULES } from "./modules/index.js";
import { RemoteWidgetManifest, resolveCdnAssetUrl, fetchRemoteWidgetManifest } from "./sdk/cdnResolver.js";
import { resolveManifestIcon, FALLBACK_MANIFEST_ICON } from "./manifests/icons.js";

/**
 * 全局小组件注册中心 (Central Widget Registry)
 * 统一管理官方组件模块、社区插件、以及 Agent 动态锻造生成的组件
 */
class WidgetRegistryClass {
  private modules: Map<string, WidgetModule> = new Map();

  /**
   * 官方小组件「补水器」。
   *
   * 为什么需要它：组件模块能否登记，取决于模块求值顺序与 HMR 后的模块重建。
   * 一旦登记时机晚于首次查询（或某个模块文件因导入路径失效而整体加载失败），
   * 磁贴就会退化成「未注册小组件 [id]」空框 —— 即"部分小组件没有加载补全"。
   * 这里保留一个幂等的补水回调，任何查询未命中时自动补登记一次。
   */
  private hydrator: (() => WidgetModule[]) | null = () => OFFICIAL_WIDGET_MODULES;
  private hydrated = false;

  constructor() {
    // 构造时立即补水官方标准小组件，杜绝因引入顺序导致的未登记/无法显示
    this.hydrate();
  }

  /**
   * 注入官方小组件补水器，并立即补水一次
   */
  public setHydrator(hydrator: () => WidgetModule[]): void {
    this.hydrator = hydrator;
    this.hydrated = false;
    this.hydrate();
  }

  /**
   * 强制重新补水（供 UI 上的"重新补全小组件"入口使用）
   */
  public rehydrate(): void {
    this.hydrated = false;
    this.hydrate();
  }

  /**
   * 幂等补水：仅在未补水时执行；失败则回滚标记，留待下次查询重试
   */
  private hydrate(): void {
    if (this.hydrated || !this.hydrator) return;
    // 先置位，避免 registerAll 内部的查询触发递归
    this.hydrated = true;
    try {
      this.registerAll(this.hydrator());
    } catch (err) {
      this.hydrated = false;
      console.error("[WidgetRegistry] 官方小组件补水失败，将在下次查询时重试:", err);
    }
  }

  /**
   * 注册标准 JS Widget 模块
   */
  public register(module: WidgetModule): void {
    if (!module || !module.id) {
      // 静默丢弃是"部分小组件凭空消失"的元凶：必须显式报警
      console.warn(
        "[WidgetRegistry] 忽略无效的小组件模块（缺少 id）。来自官方清单时通常意味着该模块文件加载失败（导入路径失效或循环依赖）。",
        module
      );
      return;
    }
    this.modules.set(String(module.id), module);
  }

  /**
   * 批量注册模块
   */
  public registerAll(modules: WidgetModule[]): void {
    if (!Array.isArray(modules)) {
      console.error("[WidgetRegistry] registerAll 收到非法清单，已跳过:", modules);
      return;
    }

    const lostIndexes: number[] = [];
    modules.forEach((m, i) => {
      if (!m || !m.id) lostIndexes.push(i);
    });
    if (lostIndexes.length > 0) {
      console.warn(
        `[WidgetRegistry] 官方小组件清单有 ${lostIndexes.length} / ${modules.length} 项未能加载` +
          `（下标 ${lostIndexes.join(", ")}）。请检查对应 modules/*.tsx 的相对导入路径是否可解析。`
      );
    }

    modules.forEach((m) => this.register(m));
  }

  /**
   * 注销模块
   */
  public unregister(id: string | ResultWidgetKey): void {
    this.modules.delete(String(id));
  }

  /**
   * 获取指定 ID 的组件模块
   */
  public get(id: string | ResultWidgetKey): WidgetModule | undefined {
    // 未命中前先确保官方清单已补水，杜绝"注册晚于首次渲染"造成的空框
    this.hydrate();
    return this.modules.get(String(id));
  }

  /**
   * 判断是否存在模块
   */
  public has(id: string | ResultWidgetKey): boolean {
    this.hydrate();
    return this.modules.has(String(id));
  }

  /**
   * 获取所有已注册的组件模块列表
   */
  public getAll(): WidgetModule[] {
    this.hydrate();
    return Array.from(this.modules.values());
  }

  /**
   * 适配并将 Agent 锻造的 CustomCardData 动态注册为标准 Widget 模块
   */
  public registerCustomCard(
    card: CustomCardData, 
    handlers?: {
      onUpdateCard?: (updated: CustomCardData) => void;
      onDeleteCard?: (id: string) => void;
    }
  ): WidgetModule {
    const cardKey = `custom_card__${card.id}`;
    
    // 确定黄金默认宽度
    const width: TileWidth = card.archetype === "parameter_matrix"
      ? 100
      : 75;

    const customModule: WidgetModule = {
      id: cardKey,
      name: card.title,
      version: "1.0.0",
      description: card.subtitle || `${card.archetype} 业务卡片`,
      category: "custom",
      width,
      supportedWidths: [25, 50, 75, 100],
      schema: card.archetype === "schema" ? card.schema : undefined,
      render: (ctx) => {
        if (card.schema) {
          return <WidgetSchemaRenderer schema={card.schema} context={ctx} />;
        }
        return (
          <div className="p-4 rounded-xl border border-border bg-card">
            <h4 className="font-semibold text-foreground text-sm">{card.title}</h4>
            {card.subtitle && <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>}
          </div>
        );
      }
    };

    this.register(customModule);
    // 同时注册裸 ID 方便索引
    this.register({ ...customModule, id: card.id });

    return customModule;
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
