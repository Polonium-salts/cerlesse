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
}

export interface WidgetRegistryState {
  initialized: boolean;
  widgets: string[];
  failedWidgets: Array<{
    id: string;
    error: string;
  }>;
}

let registryHealth: WidgetRegistryHealth = {
  initialized: false,
  registeredCount: 0,
  failedCount: 0,
  failedWidgets: []
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
