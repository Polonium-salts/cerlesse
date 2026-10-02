import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { WidgetNavigatorData, NavigatorWidgetItem } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";
import { MANIFEST_BY_ID } from "../../manifests/index.js";

export const widgetNavigatorAdapter: WidgetAdapter<SearchSynthesisResult, WidgetNavigatorData> = {
  canHandle(_query: string, _result?: SearchSynthesisResult): boolean {
    return true;
  },

  transform(_query: string, result?: SearchSynthesisResult): WidgetNavigatorData {
    const rawOrder = result?.widgetPlan?.widgetOrder || result?.layoutStrategy?.componentOrder || [];
    const items: NavigatorWidgetItem[] = [];
    const seen = new Set<string>();

    for (const key of rawOrder) {
      if (!key || seen.has(String(key))) continue;
      seen.add(String(key));
      const manifest = MANIFEST_BY_ID[String(key)];
      items.push({
        id: String(key),
        name: manifest?.name || String(key),
        category: manifest?.category || "general",
        description: manifest?.description || "",
        size: manifest?.grid?.width || 50,
        isResident: manifest?.presence === "resident"
      });
    }

    return {
      items,
      totalWidgets: items.length
    };
  },

  validate(data: WidgetNavigatorData): boolean {
    return Boolean(data && typeof data.totalWidgets === "number");
  }
};
