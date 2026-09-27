import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SearchResult } from "../../src/types.js";
import {
  assessEvidence,
  buildSearchObservation,
  compactQuery,
  detectQueryIntent,
  executeReasonedSearch,
  planSearchQueries,
  prepareSearchArguments,
  type ReasonedSearchRequest
} from "../../server/codex/queryReasoner.js";
import { canonicalTermSet } from "../../server/retrievalRanker.js";

function result(id: string, title: string, url: string, snippet = ""): SearchResult {
  return { id, title, url, snippet };
}

/** 真实的 k8s 官方文档型候选（域名互不相同，避免域名配额影响断言） */
function kubernetesDocs(): SearchResult[] {
  return [
    result("k8s-1", "Kubernetes 集群部署指南", "https://kubernetes.io/docs/setup/production-environment/"),
    result("k8s-2", "Kubernetes 集群部署官方文档", "https://docs.docker.com/engine/swarm/"),
    result("k8s-3", "Kubernetes 集群部署实践与经验", "https://example-community.dev/kubernetes-cluster-setup")
  ];
}

describe("Query Reasoner · 意图识别与查询收敛", () => {
  it("按优先级识别意图：排查优先于教程、时效优先于概念", () => {
    assert.equal(detectQueryIntent("docker 部署报错怎么解决"), "troubleshooting");
    assert.equal(detectQueryIntent("k8s 集群部署教程"), "howto");
    assert.equal(detectQueryIntent("React 19 vs Vue 3 哪个好"), "comparison");
    assert.equal(detectQueryIntent("Kubernetes 是什么"), "definition");
    assert.equal(detectQueryIntent("xx 最新版本是什么"), "news");
    assert.equal(detectQueryIntent("Kubernetes 官网"), "official");
    assert.equal(detectQueryIntent("随机的一句话"), "general");
    assert.equal(detectQueryIntent(""), "general");
  });

  it("去除对话填充词与句末标点，但保留一切有检索语义的词", () => {
    assert.equal(compactQuery("请问下 Kubernetes 的 Ingress 怎么配置？谢谢"), "Kubernetes 的 Ingress 怎么配置");
    assert.equal(compactQuery("Please tell me how to install docker"), "how to install docker");
    // 意图词（对比 / 官方）必须留下 —— 它们是有效检索信号，不是噪声
    assert.equal(compactQuery("帮我看看 React 状态管理的优缺点对比"), "React 状态管理的优缺点对比");
    assert.equal(compactQuery("   "), "");
  });

  it("把对话式长句规划为聚焦主查询 + 意图补检查询", () => {
    const plan = planSearchQueries("请问下 React 状态管理的优缺点对比哪个好？");

    assert.equal(plan.primary.strategy, "compacted");
    assert.equal(plan.primary.query, "React 状态管理的优缺点对比哪个好");
    assert.equal(plan.understanding.intent, "comparison");
    assert.ok(plan.understanding.entity.includes("React"));
    assert.ok(plan.refinements.length >= 1);
    // 补检必须带着实体，否则等于换了个话题
    for (const refinement of plan.refinements) {
      assert.ok(refinement.query.startsWith(plan.understanding.entity));
      assert.ok(refinement.facet);
    }
  });

  it("主查询绝不丢失原始查询的内容词（拉丁主体词必须逐字保留）", () => {
    const queries = [
      "please help me install docker compose on ubuntu",
      "k8s 集群部署",
      "nginx 反向代理配置报错",
      "帮我看看 TypeScript 装饰器原理",
      "thanks for the memory album"
    ];
    for (const query of queries) {
      const plan = planSearchQueries(query);
      const planned = canonicalTermSet(plan.primary.query);
      const latinOriginals = [...canonicalTermSet(query)].filter((term) => /^[a-z][a-z0-9+#._-]*$/.test(term));
      for (const term of latinOriginals) {
        assert.ok(planned.has(term), `主查询丢失了内容词「${term}」：${query} → ${plan.primary.query}`);
      }
    }
  });

  it("收敛不安全时退回原样下发，而不是改写用户的问题", () => {
    const plan = planSearchQueries("thanks for the memory album");
    assert.equal(plan.primary.strategy, "verbatim");
    assert.equal(plan.primary.query, "thanks for the memory album");
  });

  it("空查询产出空计划，不产生任何补检", () => {
    const plan = planSearchQueries("   ");
    assert.equal(plan.primary.query, "");
    assert.deepEqual(plan.refinements, []);
  });

  it("补检数量受 maxRefinements 约束", () => {
    assert.equal(planSearchQueries("k8s 集群部署", { maxRefinements: 0 }).refinements.length, 0);
    assert.equal(planSearchQueries("k8s 集群部署", { maxRefinements: 1 }).refinements.length, 1);
    assert.ok(planSearchQueries("k8s 集群部署", { maxRefinements: 2 }).refinements.length <= 2);
  });

  it("时效意图带上时效窗口，其余沿用默认", () => {
    assert.equal(planSearchQueries("xx 最新进展").understanding.recencyDays, 90);
    // 带年份的教程类查询：不是新闻意图，但时效语义明确 → 180 天窗口
    assert.equal(planSearchQueries("2026 年 Kubernetes 集群部署").understanding.recencyDays, 180);
    assert.equal(planSearchQueries("Kubernetes 是什么").understanding.recencyDays, undefined);
  });
});

describe("Query Reasoner · 证据评估", () => {
  it("实体命中充足且有权威源时判定为命中，无需补检", () => {
    const plan = planSearchQueries("k8s 集群部署");
    const assessment = assessEvidence(kubernetesDocs(), plan);

    assert.equal(assessment.level, "hit");
    assert.equal(assessment.entityMatchedCount, 3);
    assert.ok(assessment.authoritativeCount > 0);
    assert.equal(assessment.shouldRefine, false);
    assert.ok(assessment.reason.includes("证据充分"));
  });

  it("页面只命中修饰词、不含主体词时判定为未命中，必须补检", () => {
    const plan = planSearchQueries("nginx 反向代理配置");
    const assessment = assessEvidence(
      [result("apache", "Apache 反向代理配置完整教程", "https://httpd.apache.org/docs/2.4/", "反向代理配置说明")],
      plan
    );

    assert.equal(assessment.entityMatchedCount, 0);
    assert.equal(assessment.shouldRefine, true);
    assert.ok(assessment.missingTerms.some((term) => term.includes("nginx")));
  });

  it("零候选时判定为无命中，并如实给出缺口", () => {
    const plan = planSearchQueries("k8s 集群部署");
    const assessment = assessEvidence([], plan);

    assert.equal(assessment.level, "no_hit");
    assert.equal(assessment.resultCount, 0);
    assert.equal(assessment.shouldRefine, true);
    assert.ok(assessment.reason.includes("未召回任何结果"));
  });

  it("跨语言权威文档也算实体命中（k8s ↔ kubernetes）", () => {
    const plan = planSearchQueries("k8s 集群部署");
    const assessment = assessEvidence(
      [result("en", "Production cluster setup with kubeadm", "https://kubernetes.io/docs/setup/", "Kubernetes cluster deployment guide")],
      plan
    );
    assert.equal(assessment.entityMatchedCount, 1);
  });
});

describe("Query Reasoner · 精确观测", () => {
  it("证据充分时明确允许作答，并压缩结果条数", () => {
    const observation = buildSearchObservation("k8s 集群部署", kubernetesDocs(), { maxResults: 2 });

    assert.equal(observation.results.length, 2);
    assert.equal(observation.evidence.level, "hit");
    assert.deepEqual(observation.suggestedQueries, []);
    assert.ok(observation.notice.includes("可以基于下列结果作答"));
    assert.equal(observation.results[0].entityMatched, true);
  });

  it("证据不足时给出缺口词项与建议补检查询", () => {
    const observation = buildSearchObservation(
      "nginx 反向代理配置",
      [result("apache", "Apache 反向代理配置", "https://httpd.apache.org/docs/2.4/")],
      { maxResults: 5 }
    );

    assert.equal(observation.evidence.level, "no_hit");
    assert.ok(observation.suggestedQueries.length > 0);
    assert.ok(observation.suggestedQueries[0].includes("nginx"));
    assert.ok(observation.notice.includes("先调用 search_web 补检"));
    assert.ok(observation.notice.includes("不得推测"));
  });
});

describe("Query Reasoner · search_web 入参精准化", () => {
  it("收敛查询并补齐语言与时效先验，同时如实记录调整说明", () => {
    const prepared = prepareSearchArguments({ query: "请问下 Kubernetes Ingress 怎么配置？" });

    assert.equal(prepared.args.query, "Kubernetes Ingress 怎么配置");
    assert.equal(prepared.args.language, "zh");
    assert.ok(prepared.notes.some((note) => note.includes("查询已收敛")));
  });

  it("调用方显式给出的语言、时效与域名一律不被覆盖", () => {
    const prepared = prepareSearchArguments({
      query: "xx 最新进展",
      language: "en",
      recencyDays: 7,
      domains: ["kubernetes.io"]
    });

    assert.equal(prepared.args.language, "en");
    assert.equal(prepared.args.recencyDays, 7);
    assert.deepEqual(prepared.args.domains, ["kubernetes.io"]);
  });
});

describe("Query Reasoner · 受控补检编排", () => {
  it("主查询证据不足时补检一次，并把两轮结果合并去重", async () => {
    const calls: ReasonedSearchRequest[] = [];
    const reasoning: string[] = [];
    const outcome = await executeReasonedSearch("k8s 集群部署", {
      limit: 8,
      search: async (request) => {
        calls.push(request);
        if (calls.length === 1) {
          return [result("noise", "Apache 反向代理配置", "https://httpd.apache.org/docs/2.4/")];
        }
        return [
          ...kubernetesDocs(),
          // 同一 URL 再次命中：必须被归一化去重，而不是重复占位
          result("k8s-dup", "Kubernetes 集群部署指南", "https://kubernetes.io/docs/setup/production-environment/?utm_source=x")
        ];
      },
      emitReasoning: (content) => reasoning.push(content)
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[1].query, outcome.plan.refinements[0].query);
    assert.equal(outcome.refined, true);
    assert.deepEqual(outcome.executedQueries, [calls[0].query, calls[1].query]);
    assert.equal(outcome.assessment.level, "hit");

    const urls = outcome.results.map((item) => item.url);
    assert.equal(new Set(urls).size, urls.length, "结果中不应出现重复 URL");
    assert.ok(urls.some((url) => url.includes("kubernetes.io")));

    assert.ok(reasoning.some((line) => line.includes("补检")));
    assert.ok(reasoning.some((line) => line.includes("检索计划")));
  });

  it("证据充分时绝不发起额外检索", async () => {
    const calls: string[] = [];
    const outcome = await executeReasonedSearch("k8s 集群部署", {
      limit: 8,
      search: async (request) => {
        calls.push(request.query);
        return kubernetesDocs();
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(outcome.refined, false);
    assert.equal(outcome.assessment.shouldRefine, false);
    assert.ok(outcome.results.length >= 1);
  });

  it("补检轮数受 budget 上限约束（默认最多 1 轮，0 表示只做主查询）", async () => {
    const always = async () => [result("noise", "完全无关的页面", "https://irrelevant.example.com/page")];

    let calls = 0;
    await executeReasonedSearch("k8s 集群部署", {
      search: async () => {
        calls++;
        return always();
      }
    });
    assert.equal(calls, 2, "默认预算为一轮补检");

    let noBudgetCalls = 0;
    await executeReasonedSearch("k8s 集群部署", {
      maxRefinementRounds: 0,
      search: async () => {
        noBudgetCalls++;
        return always();
      }
    });
    assert.equal(noBudgetCalls, 1);
  });

  it("预算用尽仍无证据时如实标注，不做推测", async () => {
    const reasoning: string[] = [];
    const outcome = await executeReasonedSearch("k8s 集群部署", {
      search: async () => [],
      emitReasoning: (content) => reasoning.push(content)
    });

    assert.equal(outcome.assessment.level, "no_hit");
    assert.equal(outcome.results.length, 0);
    assert.ok(reasoning.some((line) => line.includes("补检预算已用尽")));
  });

  it("已有候选时只补检缺口，不重复主查询", async () => {
    const calls: ReasonedSearchRequest[] = [];
    const outcome = await executeReasonedSearch("k8s 集群部署", {
      initialResults: [result("noise", "无关页面", "https://irrelevant.example.com/page")],
      search: async (request) => {
        calls.push(request);
        return kubernetesDocs();
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].query, outcome.plan.refinements[0].query);
    assert.equal(outcome.rounds[0].kind, "existing");
    assert.equal(outcome.assessment.level, "hit");
  });

  it("skipPrimary 时不重发已下发过的主查询（即使一条都没召回）", async () => {
    const calls: ReasonedSearchRequest[] = [];
    const outcome = await executeReasonedSearch("k8s 集群部署", {
      initialResults: [],
      skipPrimary: true,
      search: async (request) => {
        calls.push(request);
        return kubernetesDocs();
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].query, outcome.plan.refinements[0].query);
    assert.notEqual(calls[0].query, outcome.plan.primary.query);
    assert.equal(outcome.rounds[0].kind, "existing");
    assert.equal(outcome.rounds[0].resultCount, 0);
    assert.equal(outcome.assessment.level, "hit");
  });

  it("单轮检索失败不抛出，仍按证据继续补检", async () => {
    let calls = 0;
    const outcome = await executeReasonedSearch("k8s 集群部署", {
      search: async () => {
        calls++;
        if (calls === 1) throw new Error("upstream offline");
        return kubernetesDocs();
      }
    });

    assert.equal(calls, 2);
    assert.equal(outcome.rounds[0].error, "upstream offline");
    assert.ok(outcome.rounds[0].resultCount === 0);
    assert.equal(outcome.assessment.level, "hit");
    assert.ok(outcome.results.length >= 1);
  });

  it("评估只决定是否补检，不改变最终排序归属（结果仍来自统一重排）", async () => {
    const outcome = await executeReasonedSearch("k8s 集群部署", {
      limit: 2,
      search: async () => kubernetesDocs().concat([
        result("low", "某站 Kubernetes 集群部署转载", "https://content-farm.example.com/a")
      ])
    });

    assert.ok(outcome.results.length <= 2);
    assert.ok(outcome.results.every((item) => item.url.startsWith("https://")));
  });
});
