import type { WidgetAdapter } from "../../sdk/adapter.js";

export interface TestExtensionData {
  message: string;
}

export const adapter: WidgetAdapter<any, TestExtensionData> = {
  canHandle() {
    return true;
  },

  transform() {
    return {
      message: "Extension Adapter OK"
    };
  },

  validate(data: any) {
    return Boolean(data?.message);
  }
};
