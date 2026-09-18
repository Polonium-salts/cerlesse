import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { TroubleshootingPlan } from "./types.js";
import { deriveFallbackTroubleshootingPlan } from "./widget.js";

export { deriveFallbackTroubleshootingPlan };

export interface TroubleshootingAdapterType extends WidgetAdapter<any, TroubleshootingPlan> {
  canHandle(query: string, result?: any): boolean;
  transform(query: string, result?: any): TroubleshootingPlan;
  validate(data: TroubleshootingPlan): boolean;
}

export const troubleshootingAdapter: TroubleshootingAdapterType = {
  canHandle(query: string, result?: any): boolean {
    if (result?.troubleshootingPlan) return true;
    const q = (query || "").toLowerCase();
    const errorPattern = /\b(ERR_[A-Z0-9_]+|EACCES|ENOENT|ECONNREFUSED|ERESOLVE|EADDRINUSE|ETIMEDOUT|404|500|502|503|0x[0-9a-fA-F]{4,8}|CORS|NullPointerException|TypeError|SyntaxError)\b/i;
    if (errorPattern.test(q)) return true;
    return /(报错|失败|崩溃|exception|error|failed|fatal|异常|排错|排查|无法启动|解决)/i.test(q);
  },

  transform(query: string, result?: any): TroubleshootingPlan {
    if (result?.troubleshootingPlan) {
      return result.troubleshootingPlan;
    }
    return deriveFallbackTroubleshootingPlan(query, result);
  },

  validate(data: TroubleshootingPlan): boolean {
    return Boolean(
      data &&
      typeof data.errorName === "string" &&
      data.errorName.length > 0 &&
      Array.isArray(data.solutions) &&
      data.solutions.length > 0
    );
  }
};
