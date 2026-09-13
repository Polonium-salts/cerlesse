import { WidgetModule, WidgetContext } from "./types.js";

/**
 * 安全隔离的 JS Widget 模块沙箱解析器 (Sandboxed Widget Module Parser)
 * 屏蔽外部敏感原生 API（window, document, localStorage, eval, fetch），防止恶意代码与样式逃逸
 */
export function safeInstantiateWidgetModule(codeString: string): WidgetModule | null {
  if (!codeString || typeof codeString !== "string" || codeString.trim() === "") {
    return null;
  }

  try {
    // 构建封闭作用域沙箱，拦截敏感原生对象
    const sandboxScope = {
      window: undefined,
      document: undefined,
      localStorage: undefined,
      sessionStorage: undefined,
      indexedDB: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined,
      WebSocket: undefined,
      eval: undefined,
      Function: undefined,
      process: undefined,
      globalThis: undefined,
      console: {
        log: (...args: any[]) => console.log("[WidgetSandbox]", ...args),
        warn: (...args: any[]) => console.warn("[WidgetSandbox]", ...args),
        error: (...args: any[]) => console.error("[WidgetSandbox]", ...args),
      }
    };

    const scopeKeys = Object.keys(sandboxScope);
    const scopeValues = Object.values(sandboxScope);

    // 标准包装：期望动态代码中提供 export default 或 module.exports 或 return 语句
    const wrappedCode = `
      "use strict";
      const module = { exports: {} };
      const exports = module.exports;
      
      ${codeString}
      
      return module.exports.default || module.exports || exports;
    `;

    // 执行在有限沙箱入参中的函数
    const sandboxFunction = new Function(...scopeKeys, wrappedCode);
    const result = sandboxFunction(...scopeValues);

    if (result && typeof result === "object" && (result.id || result.name)) {
      return {
        version: "1.0.0",
        width: result.width || 50,
        supportedWidths: result.supportedWidths || [25, 50, 75, 100],
        ...result
      } as WidgetModule;
    }

    return null;
  } catch (err) {
    console.error("Failed to safely compile sandboxed JS widget module:", err);
    return null;
  }
}
