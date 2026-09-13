/**
 * AgentTeam 端到端编排回归测试
 * 验证的是「架构性质」，而不只是「跑通了」：
 *   - 依赖关系被真正遵守（上游没结束，下游不能开始）
 *   - 排版不再被卡片锻造阻塞（两者必须并行）
 *   - 加速比来自真实测量
 *   - 降级链路可用（无 API Key 时也能完整交付）
 *
 * 运行：npx tsx scratch/test_agent_team_stream.ts
 */
import { runAgentTeam } from "../server/agentTeam.js";
import { OrchestrationStageSummary } from "../src/types.js";

let passed = true;
const check = (name: string, condition: boolean, extra = "") => {
  if (condition) console.log(`  OK   ${name}${extra ? ` (${extra})` : ""}`);
  else {
    passed = false;
    console.log(`  FAIL ${name}${extra ? ` (${extra})` : ""}`);
  }
};

async function main() {
  console.log("=== AgentTeam 端到端编排回归 ===\n");

  const t0 = Date.now();
  const result = await runAgentTeam({
    query: "RTX 5090 显卡性能参数与选购建议",
    enableDeepSearch: false
  });
  const wallClock = Date.now() - t0;

  const summary = result.agentTeam?.orchestration;
  check("编排报告已产出（性能可观测）", !!summary);
  if (!summary) {
    console.log("\n端到端编排: FAILED\n");
    process.exit(1);
  }

  const byId = new Map<string, OrchestrationStageSummary>(summary.stages.map((s) => [s.id, s]));
  const get = (id: string) => byId.get(id)!;

  console.log("\n--- 阶段执行剖面 ---");
  for (const s of summary.stages) {
    console.log(
      `  ${s.id.padEnd(12)} ${s.status.padEnd(10)} 执行 ${String(s.durationMs).padStart(6)}ms  启动于 +${String(s.waitMs).padStart(6)}ms`
    );
  }
  console.log(
    `\n  墙钟 ${wallClock}ms | 串行估计 ${summary.estimatedSequentialMs}ms | 加速比 ${summary.speedup}x | 峰值并发 ${summary.maxConcurrency}`
  );

  console.log("\n=== 1. 交付完整性 ===");
  check("检索信源已产出", result.filteredResults.length > 0, `${result.filteredResults.length} 条`);
  check("研报摘要已产出", (result.summary?.length || 0) > 50, `${result.summary?.length} 字符`);
  check("排版策略已产出", !!result.layoutStrategy);
  check("组件排版决策单已产出", !!result.layoutStrategy?.layoutAgentDecision);
  check("无关键阶段失败", summary.failedCount === 0, `failed=${summary.failedCount}`);

  console.log("\n=== 2. 依赖关系被真正遵守 ===");
  const retrieve = get("retrieve");
  check("检索是第一个启动的阶段（无前置依赖）", retrieve.waitMs <= 20, `waitMs=${retrieve.waitMs}`);

  const retrieveEnd = retrieve.waitMs + retrieve.durationMs;
  for (const id of ["synthesize", "widgetPlan"]) {
    const stage = get(id);
    check(`${id} 在检索结束之后才启动`, stage.waitMs >= retrieveEnd - 20,
      `start=+${stage.waitMs} vs retrieve端=+${retrieveEnd}`);
  }

  const layout = get("layout");
  const synth = get("synthesize");
  const planStage = get("widgetPlan");
  const layoutGate = Math.max(synth.waitMs + synth.durationMs, planStage.waitMs + planStage.durationMs);
  check("排版等待的是「综合提炼 + 组件规划」这两个真实依赖", layout.waitMs >= layoutGate - 20,
    `layout start=+${layout.waitMs} vs 依赖就绪=+${layoutGate}`);

  console.log("\n=== 3. 排版必须与卡片锻造并行（本轮的核心性能修复）===");
  const forge = get("forge");
  const forgeEnd = forge.waitMs + forge.durationMs;
  const overlapped = layout.waitMs < forgeEnd;
  check("排版没有等待卡片锻造结束",
    overlapped || forge.durationMs < 300,
    `layout start=+${layout.waitMs} / forge 端=+${forgeEnd} / forge 耗时=${forge.durationMs}ms`);
  check("锻造与排版在时间轴上存在重叠", overlapped,
    overlapped ? "已重叠" : "未重叠（锻造过快，无法判定）");

  console.log("\n=== 4. 并行调度确实带来收益 ===");
  check("存在并发执行", summary.maxConcurrency >= 2, `${summary.maxConcurrency}`);
  check("加速比 > 1", summary.speedup > 1, `${summary.speedup}x`);
  check("墙钟小于串行估计", summary.totalDurationMs < summary.estimatedSequentialMs,
    `${summary.totalDurationMs}ms < ${summary.estimatedSequentialMs}ms`);

  console.log("\n=== 5. 检索质量可解释 ===");
  const retrievalStep = result.steps.find((s) => s.id === "filter_and_rank");
  check("检索步骤已产出交付明细", (retrievalStep?.details?.length || 0) > 0, `${retrievalStep?.details?.length} 条`);
  check("信源带相关性打分与依据",
    result.filteredResults.every((r) => typeof (r as any).relevanceScore === "number" && !!(r as any).relevanceReason),
    `${result.filteredResults.length} 条`);
  const topResult = result.filteredResults[0] as any;
  if (topResult) {
    console.log(`  首位信源: [${topResult.relevanceScore}] ${topResult.title?.slice(0, 46)}`);
    console.log(`            依据: ${topResult.relevanceReason}`);
  }

  console.log("\n=== 6. 降级链路可用（无 API Key 也必须完整交付）===");
  check("无 API Key 时仍未失败", summary.failedCount === 0);
  check("速答/要点已产出", (result.keyTakeaways?.length || 0) > 0, `${result.keyTakeaways?.length} 条`);
  check("思维导图已产出", !!result.mindMap, result.mindMap?.label || "");

  console.log(`\n端到端编排: ${passed ? "PASSED" : "FAILED"}\n`);
  if (!passed) process.exit(1);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
