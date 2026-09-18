import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { ActionsToolboxData } from "./types.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const actionsToolboxAdapter: WidgetAdapter<SearchSynthesisResult, ActionsToolboxData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    return Boolean(
      (result?.widgetPlan?.primaryActions && result.widgetPlan.primaryActions.length > 0) ||
      /(命令|安装|部署|运行|执行|command|script|bash|npm|pnpm|pip|docker)/i.test(query)
    );
  },

  transform(query: string, result?: SearchSynthesisResult): ActionsToolboxData {
    const actions = result?.widgetPlan?.primaryActions || [];
    return {
      query: query || result?.query || "",
      actions,
      activeResult: result
    };
  },

  validate(data: ActionsToolboxData): boolean {
    return Boolean(data);
  }
};
