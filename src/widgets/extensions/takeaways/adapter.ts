import type { WidgetAdapter } from "../../sdk/adapter.js";
import { buildTakeawaysData, type TakeawaysData } from "../../components/TakeawaysWidget.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const takeawaysAdapter: WidgetAdapter<SearchSynthesisResult, TakeawaysData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(result?.keyTakeaways && result.keyTakeaways.length > 0);
  },

  transform(query: string, result?: SearchSynthesisResult): TakeawaysData {
    return buildTakeawaysData(result);
  },

  validate(data: TakeawaysData): boolean {
    return Boolean(data && Array.isArray(data.items) && data.items.length > 0);
  }
};
