import React from "react";
import { WidgetModule, ResultWidgetKey } from "./sdk/types.js";
import { safeInstantiateWidgetModule } from "./sdk/sandbox.js";
import { CustomCardData } from "../types.js";
import { UniqueCardWidget } from "../components/widgets/UniqueCardWidget.js";
import { WidgetSchemaRenderer } from "./schemaRenderer.js";

/**
 * 全局小组件注册中心 (Central Widget Registry)
 * 统一管理官方组件模块、社区插件、以及 Agent 动态锻造生成的组件
 */
class WidgetRegistryClass {
  private modules: Map<string, WidgetModule> = new Map();

  constructor() {
    // 延迟或外部初始化官方标准组件
  }

  /**
   * 注册标准 JS Widget 模块
   */
  public register(module: WidgetModule): void {
    if (!module || !module.id) return;
    this.modules.set(String(module.id), module);
  }

  /**
   * 批量注册模块
   */
  public registerAll(modules: WidgetModule[]): void {
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
    return this.modules.get(String(id));
  }

  /**
   * 判断是否存在模块
   */
  public has(id: string | ResultWidgetKey): boolean {
    return this.modules.has(String(id));
  }

  /**
   * 获取所有已注册的组件模块列表
   */
  public getAll(): WidgetModule[] {
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
    
    // 确定黄金默认尺寸
    const defaultSize = (card.archetype === "timeline" || card.archetype === "parameter_matrix")
      ? "large"
      : "medium";

    const customModule: WidgetModule = {
      id: cardKey,
      name: card.title,
      version: "1.0.0",
      description: card.subtitle || `${card.archetype} 业务卡片`,
      category: "custom",
      defaultSize,
      supportedSizes: ["small", "medium", "large", "full"],
      schema: card.archetype === "schema" ? card.schema : undefined,
      render: (ctx) => {
        if (card.archetype === "schema" && card.schema) {
          return <WidgetSchemaRenderer schema={card.schema} context={ctx} />;
        }
        return (
          <UniqueCardWidget
            card={card}
            onUpdateCard={handlers?.onUpdateCard}
            onDeleteCard={handlers?.onDeleteCard}
            isCompact={ctx.isCompact}
            size={ctx.size}
            onResize={ctx.onResize}
          />
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
}

export const WidgetRegistry = new WidgetRegistryClass();
