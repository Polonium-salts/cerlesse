/**
 * Declarative Orchestration Kernel —— 声明式编排内核
 * ============================================================
 * 为什么需要它：
 * 之前的协作流程是把各 Agent 的异步函数手工写成 `Promise.all([...])` 的硬编码管道。
 * 这种写法有三个结构性缺陷，而且会随着业务增长越来越痛：
 *
 *   1. **并行度靠人肉保证**：谁依赖谁只存在于代码书写顺序里，新增一个 Agent
 *      必须回头重读整个函数，极易写成事实上串行（尾延迟直接被拉长）。
 *   2. **超时与降级散落各处**：每个阶段各自 `Promise.race` + `setTimeout`，
 *      同一个策略抄了 N 份，行为还不一致。
 *   3. **不可观测**：跑了多久、卡在哪、降级了几次，只能靠 console.log 猜。
 *
 * 本内核把「协作」抽象成一张**声明式的阶段依赖图**：
 *   - 每个阶段声明自己的 id / deps / 超时 / 降级补偿；
 *   - 调度器拓扑推进，**依赖一就绪立刻启动**（就绪即启动，而不是批量等）；
 *   - 超时与异常统一走 fallback，关键阶段失败则阻断下游，非关键阶段降级放行；
 *   - 全程记录每个阶段的耗时、等待时长与降级原因，产出可观测报告。
 *
 * 于是「新增一个专职 Agent」退化成「往图里加一个节点」，不再需要改动既有流程。
 */

export type StageStatus =
  | "pending"    // 等待依赖
  | "running"    // 执行中
  | "completed"  // 正常完成
  | "degraded"   // 超时/异常后由 fallback 兜底，产出仍可用
  | "failed"     // 失败且无兜底
  | "skipped";   // 上游关键阶段失败，被阻断

export interface StageReport {
  id: string;
  name: string;
  /** 该阶段归属的 Agent 角色，用于前端把耗时挂到正确的 Agent 卡片上 */
  role?: string;
  status: StageStatus;
  durationMs: number;
  /** 在依赖上等待的时长：这个数字高 = 该阶段的并行潜力没被利用起来 */
  waitMs: number;
  startedAt: number;
  endedAt: number;
  error?: string;
  degradedReason?: string;
}

export interface OrchestrationReport {
  name: string;
  stages: StageReport[];
  totalDurationMs: number;
  /** 若把全部阶段串行执行的理论耗时，用于衡量并行收益 */
  estimatedSequentialMs: number;
  /** 并行效率 = 串行估计 / 实际耗时 */
  speedup: number;
  /** 观测到的最大并发阶段数 */
  maxConcurrency: number;
  degradedCount: number;
  failedCount: number;
}

export class StageTimeoutError extends Error {
  constructor(public stageId: string, public timeoutMs: number) {
    super(`Stage "${stageId}" timed out after ${timeoutMs}ms`);
    this.name = "StageTimeoutError";
  }
}

export interface StageContext<TState> {
  /** 共享黑板：阶段之间只通过它交换数据，不依赖闭包捕获顺序 */
  state: TState;
  /** 中止信号：阶段超时或上游失败时触发，fetch 等可中止操作应当透传 */
  signal: AbortSignal;
  /** 阶段自己的 id，方便日志与埋点 */
  stageId: string;
}

export interface StageDefinition<TState> {
  id: string;
  name: string;
  role?: string;
  /** 依赖的阶段 id；未声明即视为可立即启动 */
  deps?: string[];
  /** 超时毫秒数；超时后若配置了 fallback 则降级，否则标记失败 */
  timeoutMs?: number;
  /** 关键阶段失败会阻断其所有下游；非关键阶段失败则下游照常（用降级数据） */
  critical?: boolean;
  run: (ctx: StageContext<TState>) => Promise<void> | void;
  /** 降级补偿：超时或抛错时调用，尽量产出可用的最小结果 */
  fallback?: (ctx: StageContext<TState>, error: Error) => Promise<void> | void;
}

export interface RunOrchestrationOptions<TState> {
  name: string;
  state: TState;
  stages: StageDefinition<TState>[];
  /** 并发闸门：限制同时执行的阶段数，防止把下游 API 打爆 */
  maxConcurrency?: number;
  onStageUpdate?: (report: StageReport, all: StageReport[]) => void;
  /** 整体硬超时：到点后中止所有未完成阶段并进入降级 */
  globalTimeoutMs?: number;
}

const SETTLED: StageStatus[] = ["completed", "degraded", "failed", "skipped"];

function isSettled(status: StageStatus): boolean {
  return SETTLED.includes(status);
}

/** 接线期静态校验：未知依赖、自依赖、环形依赖一律在启动前抛出，避免运行时死锁 */
function validateGraph<TState>(stages: StageDefinition<TState>[]): void {
  const ids = new Set<string>();
  for (const stage of stages) {
    if (ids.has(stage.id)) throw new Error(`Orchestrator: duplicated stage id "${stage.id}"`);
    ids.add(stage.id);
  }

  for (const stage of stages) {
    for (const dep of stage.deps || []) {
      if (dep === stage.id) throw new Error(`Orchestrator: stage "${stage.id}" depends on itself`);
      if (!ids.has(dep)) throw new Error(`Orchestrator: stage "${stage.id}" depends on unknown stage "${dep}"`);
    }
  }

  // Kahn 拓扑排序做环检测
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const stage of stages) {
    indegree.set(stage.id, (stage.deps || []).length);
    for (const dep of stage.deps || []) {
      if (!adjacency.has(dep)) adjacency.set(dep, []);
      adjacency.get(dep)!.push(stage.id);
    }
  }
  const queue = stages.filter((s) => (indegree.get(s.id) || 0) === 0).map((s) => s.id);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;
    for (const next of adjacency.get(current) || []) {
      const remaining = (indegree.get(next) || 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  if (visited !== stages.length) {
    throw new Error("Orchestrator: dependency graph contains a cycle");
  }
}

/**
 * 执行一次编排。返回可观测报告；阶段产物通过 `state` 黑板回传。
 *
 * 调度语义（与「批量 Promise.all」的本质区别）：
 *   每一轮都重新扫描所有未启动阶段，只要依赖已 settled 就立即启动。
 *   因此 A→B 与 C→D 两条链会真正并行推进，而不是等最慢的一条。
 */
export async function runOrchestration<TState>(
  options: RunOrchestrationOptions<TState>
): Promise<OrchestrationReport> {
  const { name, state, stages, maxConcurrency = 8, onStageUpdate, globalTimeoutMs } = options;
  validateGraph(stages);

  const startedAtAll = Date.now();
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const reports = new Map<string, StageReport>();
  const startedIds = new Set<string>();

  for (const stage of stages) {
    reports.set(stage.id, {
      id: stage.id,
      name: stage.name,
      role: stage.role,
      status: "pending",
      durationMs: 0,
      waitMs: 0,
      startedAt: 0,
      endedAt: 0
    });
  }

  const snapshot = () => stages.map((s) => ({ ...reports.get(s.id)! }));
  const emit = (id: string) => onStageUpdate?.({ ...reports.get(id)! }, snapshot());

  const controller = new AbortController();
  let globalTimer: ReturnType<typeof setTimeout> | undefined;
  if (globalTimeoutMs && globalTimeoutMs > 0) {
    globalTimer = setTimeout(() => controller.abort(new Error("global orchestration timeout")), globalTimeoutMs);
  }

  let maxConcurrencyObserved = 0;
  const running = new Set<Promise<void>>();

  const launch = (stage: StageDefinition<TState>): Promise<void> => {
    const report = reports.get(stage.id)!;
    const def = stage;

    const task = (async () => {
      report.status = "running";
      report.startedAt = Date.now();
      report.waitMs = report.startedAt - startedAtAll;
      emit(def.id);

      const stageController = new AbortController();
      const onAbort = () => stageController.abort(controller.signal.reason);
      if (controller.signal.aborted) onAbort();
      else controller.signal.addEventListener("abort", onAbort, { once: true });

      const ctx: StageContext<TState> = {
        state,
        signal: stageController.signal,
        stageId: def.id
      };

      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        const work = Promise.resolve().then(() => def.run(ctx));

        if (def.timeoutMs && def.timeoutMs > 0) {
          const timeoutError = new StageTimeoutError(def.id, def.timeoutMs);
          const timeout = new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
              stageController.abort(timeoutError); // 让 fetch 等可中止操作真正停下
              reject(timeoutError);
            }, def.timeoutMs);
          });
          await Promise.race([work, timeout]);
        } else {
          await work;
        }

        report.status = "completed";
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (def.fallback) {
          report.degradedReason = error.message;
          try {
            await def.fallback(ctx, error);
            report.status = "degraded";
          } catch (fallbackErr) {
            report.status = "failed";
            report.error = `${error.message} | fallback failed: ${(fallbackErr as Error)?.message}`;
          }
        } else {
          report.status = "failed";
          report.error = error.message;
        }
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        controller.signal.removeEventListener("abort", onAbort);
        report.endedAt = Date.now();
        report.durationMs = report.endedAt - report.startedAt;
        emit(def.id);
      }
    })();

    running.add(task);
    task.finally(() => running.delete(task));
    return task;
  };

  // 主调度循环：拓扑推进，就绪即启动
  while (true) {
    const pending = stages.filter((s) => !startedIds.has(s.id));

    // 依赖已 settled 的阶段即为「就绪」
    const ready = pending.filter((stage) => {
      const reports0 = (stage.deps || []).map((dep) => reports.get(dep)!);
      if (!reports0.every((r) => isSettled(r.status))) return false;

      // 上游有 failed，且其中存在关键阶段 → 本阶段被阻断
      const blocked = (stage.deps || []).some((dep) => {
        const upstream = stageById.get(dep)!;
        return reports.get(dep)!.status === "failed" && upstream.critical !== false;
      });
      return !blocked;
    });

    if (ready.length === 0) {
      if (pending.length === 0 || running.size === 0) {
        // 没有可启动的，也没有在跑的：剩下的一定是被阻断的
        for (const stage of pending) {
          const report = reports.get(stage.id)!;
          report.status = "skipped";
          report.endedAt = Date.now();
          emit(stage.id);
        }
        break;
      }
      // 还有阶段在跑，等任意一个完成后再重新扫描
      await Promise.race(Array.from(running));
      continue;
    }

    // 处理被关键上游阻断的阶段：标记 skipped 后继续推进
    for (const stage of pending) {
      const depsSettled = (stage.deps || []).every((d) => isSettled(reports.get(d)!.status));
      if (!depsSettled) continue;
      const blocked = (stage.deps || []).some((dep) => {
        const upstream = stageById.get(dep)!;
        return reports.get(dep)!.status === "failed" && upstream.critical !== false;
      });
      if (blocked) {
        const report = reports.get(stage.id)!;
        report.status = "skipped";
        report.error = "blocked by a failed upstream stage";
        report.endedAt = Date.now();
        startedIds.add(stage.id);
        emit(stage.id);
      }
    }

    const slots = Math.max(1, maxConcurrency - running.size);
    const toLaunch = ready.filter((s) => !startedIds.has(s.id)).slice(0, slots);
    if (toLaunch.length === 0) {
      if (running.size > 0) {
        await Promise.race(Array.from(running));
        continue;
      }
      continue;
    }

    for (const stage of toLaunch) {
      startedIds.add(stage.id);
      launch(stage);
    }
    maxConcurrencyObserved = Math.max(maxConcurrencyObserved, Math.min(running.size, maxConcurrency));

    if (running.size > 0) {
      await Promise.race(Array.from(running));
    }
  }

  // 兜底：确保所有后台任务回收
  await Promise.allSettled(Array.from(running));
  if (globalTimer) clearTimeout(globalTimer);

  const stageReports = snapshot();
  const totalDurationMs = Date.now() - startedAtAll;
  // 串行估计：所有阶段各自的执行耗时相加（不含等待）
  const estimatedSequentialMs = stageReports.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    name,
    stages: stageReports,
    totalDurationMs,
    estimatedSequentialMs,
    speedup: Number((estimatedSequentialMs / Math.max(totalDurationMs, 1)).toFixed(2)),
    maxConcurrency: maxConcurrencyObserved,
    degradedCount: stageReports.filter((r) => r.status === "degraded").length,
    failedCount: stageReports.filter((r) => r.status === "failed").length
  };
}
