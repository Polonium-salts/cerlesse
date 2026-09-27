/**
 * 小组件注册中心健康状态契约与一致性校验 (Widget Registry Health & Consistency Contract)
 */

export interface WidgetRegistryHealth {
  initialized: boolean;
  registeredCount: number;
  failedCount: number;
  failedWidgets: Array<{
    id: string;
    error: string;
  }>;
  /** 使用了历史非标准宽度命名的组件数量 */
  legacyWidgetsCount?: number;
  /** 使用了历史非标准宽度命名的组件 ID 列表 */
  legacyWidgetIds?: string[];
}

export interface WidgetRegistryState {
  initialized: boolean;
  widgets: string[];
  failedWidgets: Array<{
    id: string;
    error: string;
  }>;
  legacyWidgetsCount?: number;
  legacyWidgetIds?: string[];
}

let registryHealth: WidgetRegistryHealth = {
  initialized: false,
  registeredCount: 0,
  failedCount: 0,
  failedWidgets: [],
  legacyWidgetsCount: 0,
  legacyWidgetIds: []
};

export function getWidgetRegistryHealth(): WidgetRegistryHealth {
  return {
    ...registryHealth,
    failedWidgets: [...registryHealth.failedWidgets]
  };
}

export function setWidgetRegistryHealth(next: Partial<WidgetRegistryHealth>): void {
  registryHealth = {
    ...registryHealth,
    ...next,
    failedWidgets: next.failedWidgets ? [...next.failedWidgets] : registryHealth.failedWidgets
  };
}

export function resetWidgetRegistryHealth(): void {
  registryHealth = {
    initialized: false,
    registeredCount: 0,
    failedCount: 0,
    failedWidgets: []
  };
}

/**
 * 校验规划的组件列表与真实注册中心的一致性
 * 返回在 registeredKeys 中缺失的 plannedKeys 数组
 */
export function validateWidgetRegistryConsistency(
  plannedKeys: string[],
  registeredKeys: string[]
): string[] {
  const registered = new Set(registeredKeys.map(k => String(k)));
  return plannedKeys.filter(key => !registered.has(String(key)));
}
