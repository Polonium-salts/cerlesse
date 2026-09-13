/**
 * 声明式编排内核回归测试
 * 运行：npx tsx scratch/test_orchestrator.ts
 */
import { runOrchestration, StageDefinition } from "../server/orchestrator.js";

let passed = true;
const check = (name: string, condition: boolean, extra = "") => {
  if (condition) console.log(`  OK   ${name}${extra ? ` (${extra})` : ""}`);
  else {
    passed = false;
    console.log(`  FAIL ${name}${extra ? ` (${extra})` : ""}`);
  }
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface State { log: string[]; data: Record<string, unknown>; }

async function main() {
  console.log("\n=== 1. 依赖驱动调度：独立链必须真正并行 ===");
  {
    const state: State = { log: [], data: {} };
    const report = await runOrchestration<State>({
      name: "parallel-test",
      state,
      stages: [
        { id: "a", name: "A", run: async () => { await sleep(60); state.log.push("a"); } },
        { id: "b", name: "B", deps: ["a"], run: async () => { await sleep(60); state.log.push("b"); } },
        { id: "c", name: "C", run: async () => { await sleep(60); state.log.push("c"); } },
        { id: "d", name: "D", deps: ["c"], run: async () => { await sleep(60); state.log.push("d"); } }
      ]
    });

    // 串行需 240ms；两条链并行应接近 120ms
    check("两条独立链并行推进", report.totalDurationMs < 200, `${report.totalDurationMs}ms`);
    check("观测到并发 ≥ 2", report.maxConcurrency >= 2, `${report.maxConcurrency}`);
    check("拓扑顺序正确（a 先于 b，c 先于 d）",
      state.log.indexOf("a") < state.log.indexOf("b") && state.log.indexOf("c") < state.log.indexOf("d"),
      state.log.join("→"));
    check("串行估计累加各阶段耗时", report.estimatedSequentialMs >= 230, `${report.estimatedSequentialMs}ms`);
    check("并行加速比 > 1.5", report.speedup > 1.5, `${report.speedup}x`);
  }

  console.log("\n=== 2. 超时 → fallback 降级，流程不被中断 ===");
  {
    const state: State = { log: [], data: {} };
    const report = await runOrchestration<State>({
      name: "timeout-test",
      state,
      stages: [
        {
          id: "slow",
          name: "慢阶段",
          timeoutMs: 80,
          fallback: async () => { state.data.fallbackUsed = true; },
          run: async () => { await sleep(1000); }
        },
        { id: "after", name: "下游", deps: ["slow"], run: async () => { state.log.push("after"); } }
      ]
    });

    const slow = report.stages.find((s) => s.id === "slow")!;
    check("超时阶段被标记为降级", slow.status === "degraded", slow.status);
    check("记录了降级原因", !!slow.degradedReason, slow.degradedReason || "");
    check("降级补偿已执行", state.data.fallbackUsed === true);
    check("下游照常执行（非阻断）", state.log.includes("after"), state.log.join(","));
    check("报告统计降级次数", report.degradedCount === 1, `${report.degradedCount}`);
  }

  console.log("\n=== 3. 关键阶段失败 → 阻断下游 ===");
  {
    const state: State = { log: [], data: {} };
    const report = await runOrchestration<State>({
      name: "critical-test",
      state,
      stages: [
        { id: "must", name: "关键", critical: true, run: async () => { throw new Error("boom"); } },
        { id: "child", name: "下游", deps: ["must"], run: async () => { state.log.push("child"); } },
        { id: "grand", name: "下游的下游", deps: ["child"], run: async () => { state.log.push("grand"); } }
      ]
    });

    check("关键阶段标记失败", report.stages.find((s) => s.id === "must")!.status === "failed");
    check("直接下游被跳过", report.stages.find((s) => s.id === "child")!.status === "skipped");
    check("级联下游也被跳过", report.stages.find((s) => s.id === "grand")!.status === "skipped");
    check("下游函数确实没跑", state.log.length === 0, state.log.join(","));
    check("报告统计失败次数", report.failedCount === 1, `${report.failedCount}`);
  }

  console.log("\n=== 4. 非关键阶段失败 → 下游照常（可降级放行） ===");
  {
    const state: State = { log: [], data: {} };
    const report = await runOrchestration<State>({
      name: "non-critical-test",
      state,
      stages: [
        { id: "opt", name: "可选增强", critical: false, run: async () => { throw new Error("optional fail"); } },
        { id: "core", name: "主流程", deps: ["opt"], run: async () => { state.log.push("core"); } }
      ]
    });

    check("可选阶段失败", report.stages.find((s) => s.id === "opt")!.status === "failed");
    check("下游未被阻断", state.log.includes("core"), state.log.join(","));
    check("主流程正常完成", report.stages.find((s) => s.id === "core")!.status === "completed");
  }

  console.log("\n=== 5. 并发闸门生效 ===");
  {
    let concurrent = 0;
    let peak = 0;
    const state: State = { log: [], data: {} };
    await runOrchestration<State>({
      name: "gate-test",
      state,
      maxConcurrency: 2,
      stages: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        name: `S${i}`,
        run: async () => {
          concurrent++;
          peak = Math.max(peak, concurrent);
          await sleep(40);
          concurrent--;
        }
      }))
    });
    check("同时执行的阶段数不超过闸门", peak <= 2, `峰值 ${peak}`);
  }

  console.log("\n=== 6. 接线期校验：未知依赖 / 环形依赖必须快速失败 ===");
  {
    let unknownFailed = false;
    try {
      await runOrchestration<State>({
        name: "bad-dep",
        state: { log: [], data: {} },
        stages: [{ id: "x", name: "X", deps: ["nope"], run: async () => {} }]
      });
    } catch { unknownFailed = true; }
    check("未知依赖被拒绝", unknownFailed);

    let cycleFailed = false;
    try {
      await runOrchestration<State>({
        name: "cycle",
        state: { log: [], data: {} },
        stages: [
          { id: "a", name: "A", deps: ["b"], run: async () => {} },
          { id: "b", name: "B", deps: ["a"], run: async () => {} }
        ]
      });
    } catch { cycleFailed = true; }
    check("环形依赖被拒绝", cycleFailed);
  }

  console.log("\n=== 7. 可观测性：每个阶段都有耗时与等待时长 ===");
  {
    const state: State = { log: [], data: {} };
    const updates: string[] = [];
    const report = await runOrchestration<State>({
      name: "observability",
      state,
      onStageUpdate: (r) => updates.push(`${r.id}:${r.status}`),
      stages: [
        { id: "root", name: "根", role: "retrieval", run: async () => { await sleep(50); } },
        { id: "leaf", name: "叶", role: "layout", deps: ["root"], run: async () => { await sleep(20); } }
      ]
    });

    check("阶段耗时已记录", report.stages.every((s) => s.durationMs >= 0 && s.endedAt >= s.startedAt));
    check("叶子阶段记录了等待时长", report.stages.find((s) => s.id === "leaf")!.waitMs >= 40,
      `${report.stages.find((s) => s.id === "leaf")!.waitMs}ms`);
    check("角色信息透传（供前端挂载到 Agent 卡片）", report.stages.find((s) => s.id === "root")!.role === "retrieval");
    check("状态回调被触发", updates.includes("root:running") && updates.includes("leaf:completed"), updates.join(" "));
  }

  console.log(`\n声明式编排内核: ${passed ? "PASSED" : "FAILED"}\n`);
  if (!passed) process.exit(1);
}

main();
