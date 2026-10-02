export interface NavigatorWidgetItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  iconName?: string;
  size?: number; // 25 | 50 | 75 | 100
  isResident?: boolean;
}

export interface WidgetNavigatorData {
  items: NavigatorWidgetItem[];
  activeWidgetId?: string;
  totalWidgets: number;
}
