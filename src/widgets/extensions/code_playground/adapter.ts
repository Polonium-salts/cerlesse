import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { CodePlaygroundData, CodeSnippetItem } from "./types.js";

export interface CodePlaygroundAdapterType extends WidgetAdapter<any, CodePlaygroundData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): CodePlaygroundData;
  validate(data: CodePlaygroundData): boolean;
}

export const codePlaygroundAdapter: CodePlaygroundAdapterType = {
  canHandle(query: string) {
    return /(代码|运行|playground|示例|snippet|实现|demo|调试|console|python|typescript|javascript|bash)/i.test(query);
  },

  transform(query: string, result?: any): CodePlaygroundData {
    const q = query || result?.query || "代码演练";

    const isPython = /python/i.test(q);
    const isBash = /bash|shell|curl|brew|npm|docker/i.test(q);

    let snippets: CodeSnippetItem[] = [
      {
        id: "demo-main",
        title: "主逻辑示例 (TypeScript)",
        language: "typescript" as const,
        code: `// 🎯 核心业务执行逻辑演练
async function processBatch<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 3
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = (async () => {
      const res = await worker(item);
      results.push(res);
    })().then(() => {
      executing.delete(p);
    });

    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// 运行测试用例
const tasks = [100, 200, 150, 300, 50];
console.log("🚀 开始并发执行任务批处理...");
const start = performance.now();
const outputs = await processBatch(tasks, async (ms) => {
  await new Promise((r) => setTimeout(r, ms));
  return \`任务耗时: \${ms}ms\`;
}, 2);

console.log(\`✅ 全部完成! 耗时: \${(performance.now() - start).toFixed(1)}ms\`);
console.table(outputs);`,
        output: `🚀 开始并发执行任务批处理...
✅ 全部完成! 耗时: 452.1ms
┌─────────┬──────────────────┐
│ (index) │      Values      │
├─────────┼──────────────────┤
│    0    │ '任务耗时: 100ms' │
│    1    │ '任务耗时: 150ms' │
│    2    │ '任务耗时: 200ms' │
│    3    │ '任务耗时: 50ms'  │
│    4    │ '任务耗时: 300ms' │
└─────────┴──────────────────┘`,
        description: "轻量级高并发限制队列，避免下游 API 限流或系统资源爆仓",
        executionTimeMs: 452
      },
      {
        id: "demo-quick",
        title: "快速调用脚本",
        language: "javascript" as const,
        code: `// 极简单行调用
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const result = await Promise.all([1, 2, 3].map(async (n) => {
  await delay(n * 50);
  return n * 2;
}));
console.log("计算结果:", result);`,
        output: `计算结果: [ 2, 4, 6 ]`,
        description: "基础 Promise 异步处理示例",
        executionTimeMs: 150
      }
    ];

    if (isPython) {
      snippets = [
        {
          id: "py-demo",
          title: "Python 核心数据流处理",
          language: "python" as const,
          code: `import asyncio
import time

async def fetch_item(item_id: int):
    await asyncio.sleep(0.1)
    return {"id": item_id, "status": "success", "score": item_id * 1.5}

async def main():
    print("🚀 启动 Python 异步事件循环...")
    tasks = [fetch_item(i) for i in range(1, 6)]
    results = await asyncio.gather(*tasks)
    print(f"✅ 处理完成: {len(results)} 条数据")
    for r in results:
        print(f"  • ID {r['id']}: 得分 {r['score']}")

asyncio.run(main())`,
          output: `🚀 启动 Python 异步事件循环...
✅ 处理完成: 5 条数据
  • ID 1: 得分 1.5
  • ID 2: 得分 3.0
  • ID 3: 得分 4.5
  • ID 4: 得分 6.0
  • ID 5: 得分 7.5`,
          description: "使用 asyncio.gather 实现高并发 I/O 调度",
          executionTimeMs: 105
        }
      ];
    }

    return {
      title: `${q.replace(/(运行|代码|playground)/gi, "").trim() || "实时"} 代码演练与控制台`,
      description: "在安全隔离沙箱中即时预览、编辑与执行代码逻辑",
      defaultLanguage: isPython ? "python" : "typescript",
      snippets,
      allowEdit: true
    };
  },

  validate(data: CodePlaygroundData): boolean {
    return Boolean(data && Array.isArray(data.snippets) && data.snippets.length > 0);
  }
};
