import type { SearchSynthesisResult, WidgetAction } from "../../../types.js";

export interface ActionsToolboxData {
  query: string;
  actions: WidgetAction[];
  activeResult?: SearchSynthesisResult;
}
