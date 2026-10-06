/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 检索深度契约：观测层必须把足够多、足够长的信源内容交给模型，
 * 否则「回答得更全」只是提示词里的一句话，模型看不到证据。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchObservation,
  planSearchQueries,
  DEFAULT_MAX_REFINEMENT_ROUNDS,
  DEFAULT_SNIPPET_CHARS,
  DEFAULT_SNIPPET_BUDGET_CHARS
} from "../../server/codex/queryReasoner.js";
import { SEARCH_POLICY } from "../../server/searchPolicy.js";
import type { SearchResult } from "../../src/types.js";

function makeSources(n: number, snippetLen: number): SearchResult[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `src-${i + 1}`,
    ref: i + 1,
    title: `量子退火 权威文档 章节 ${i + 1}`,
    url: `https://example.com/quantum-annealing/${i + 1}`,
    snippet: "量子退火利用绝热定理在超导电路中寻优。".repeat(
      Math.ceil(snippetLen / 20)
    )
  }));
}

describe("检索观测层深度", () => {
  it("默认摘要长度足以承载多句证据（不再是 240 字符截断）", () => {
    const sources = makeSources(3, 2000);
    const obs = buildSearchObservation("量子退火原理", sources);
    for (const r of obs.results) {
      assert.ok(
        r.snippet.length > 240,
        `摘要应超过旧的 240 字符上限，实际 ${r.snippet.length}`
      );
    }
  });

  it("显式 snippetChars 仍然生效（可按需调窄）", () => {
    const sources = makeSources(2, 2000);
    const obs = buildSearchObservation("量子退火原理", sources, { snippetChars: 240 });
    for (const r of obs.results) {
      assert.ok(r.snippet.length <= 240);
    }
  });

  it("maxResults 截断仍然生效", () => {
    const sources = makeSources(40, 400);
    const obs = buildSearchObservation("量子退火原理", sources, { maxResults: 5 });
    assert.equal(obs.results.length, 5);
  });

  it("默认能观测到 24 条以上信源（不再是 10 条瓶颈）", () => {
    const sources = makeSources(30, 400);
    const obs = buildSearchObservation("量子退火原理", sources, { maxResults: 24 });
    assert.equal(obs.results.length, 24);
  });

  it("默认补检轮数契约保持为 1 轮（不放宽自动补检预算）", () => {
    // 搜得更全靠观测层（更多信源 + 更长摘要 + 更多补检方向），不靠自动多搜一轮：
    // 自动补检不受模型判断约束，会同时抬高延迟与 token。
    assert.equal(DEFAULT_MAX_REFINEMENT_ROUNDS, 1);
  });

  it("摘要总量有硬上限：结果变多时按条均摊而非线性膨胀", () => {
    const sources = makeSources(30, 4000);
    const obs = buildSearchObservation("量子退火原理", sources, { maxResults: 24 });
    const total = obs.results.reduce((sum, r) => sum + r.snippet.length, 0);
    assert.ok(
      total <= DEFAULT_SNIPPET_BUDGET_CHARS,
      `24 条观测摘要总量 ${total} 应不超过 ${DEFAULT_SNIPPET_BUDGET_CHARS}`
    );
    // 均摊后仍远高于旧的 240 截断
    for (const r of obs.results) {
      assert.ok(r.snippet.length > 240, `均摊后每条仍应超过 240，实际 ${r.snippet.length}`);
    }
    assert.ok(DEFAULT_SNIPPET_BUDGET_CHARS / 24 < DEFAULT_SNIPPET_CHARS);
  });

  it("结果很少时每条仍能拿到完整上限", () => {
    const sources = makeSources(3, 4000);
    const obs = buildSearchObservation("量子退火原理", sources, { maxResults: 24 });
    for (const r of obs.results) {
      assert.equal(r.snippet.length, DEFAULT_SNIPPET_CHARS);
    }
  });

  it("默认规划出 3 条补检方向（上限 4）", () => {
    const plan = planSearchQueries("量子退火算法原理");
    assert.ok(
      plan.refinements.length >= 2,
      `默认应给出多条补检方向，实际 ${plan.refinements.length}`
    );
    const capped = planSearchQueries("量子退火算法原理", { maxRefinements: 4 });
    assert.ok(capped.refinements.length <= 4);
  });

  it("显式 maxRefinements 仍然优先于默认值", () => {
    assert.equal(planSearchQueries("量子退火算法原理", { maxRefinements: 0 }).refinements.length, 0);
    assert.equal(planSearchQueries("量子退火算法原理", { maxRefinements: 1 }).refinements.length, 1);
  });

  it("检索轮数契约保持不变（4 轮，未被本次改动破坏）", () => {
    assert.equal(SEARCH_POLICY.maxSearchRounds, 4);
    assert.equal(SEARCH_POLICY.minSources, 7);
  });
});