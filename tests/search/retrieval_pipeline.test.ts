import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  rankSearchPools,
  matchesSearchFilters,
  classifySourceType,
  normalizeUrlKey,
  isSearchEndpoint,
  type CandidatePool
} from "../../server/retrievalRanker.js";
import { normalizeSearchFilters } from "../../server/searchFilters.js";
import { resolveHitLevel, MIN_EVIDENCE_COUNT } from "../../server/services/searchService.js";
import type { SearchResult } from "../../src/types.js";

/**
 * 检索流水线行为回归测试
 * ============================================================
 * 覆盖本轮针对「智能体搜索」方案落地的四项能力：
 *   1. 结构化排序分项（scoreBreakdown）—— 分项之和必须等于原始分，可回溯可审计
 *   2. 分层去重与筛选的**真实**计数（RankingReport）—— 各层之和等于进入数减保留数，
 *      替代此前用固定系数估算的假数据
 *   3. 用户侧多条件筛选（时间窗 / 域名 / 来源类型 / 语言）—— 未指定即不介入
 *   4. 事件簇归并 —— 只归并、不淘汰，保证结果数量与多样性不受影响
 *
 * 以及命中级别判定（hit / partial / no_hit）这一「是否定位到目标」的显式契约。
 */

const LONG_SNIPPET = "这是一段足够长的摘要文本，用于满足最短摘要长度的校验要求。";

function makeResult(over: Partial<SearchResult> & { url: string; title: string }): SearchResult {
  return {
    id: over.url,
    snippet: LONG_SNIPPET,
    engine: "TestEngine",
    ...over
  } as SearchResult;
}

/** 构造一个混合候选池：既有高相关条目，也含必被硬剔除与必被去重的条目 */
function buildMixedPool(): CandidatePool {
  return {
    source: "main",
    results: [
      makeResult({
        title: "Docker 安装 官方文档",
        url: "https://docs.docker.com/engine/install/",
        snippet: "Docker 安装 官方文档 覆盖 各 平台 安装 步骤 与 依赖 说明。"
      }),
      makeResult({
        title: "Docker 安装 完整教程",
        url: "https://blog.example.com/docker-install-guide",
        snippet: "Docker 安装 完整 教程 含 环境 准备 与 验证 方法。"
      }),
      // 与上一条标题完全一致、仅域名不同 → 应计入 titleLevelRemoved
      makeResult({
        title: "Docker 安装 完整教程",
        url: "https://mirror.example.org/docker-install-guide",
        snippet: "Docker 安装 完整 教程 含 环境 准备 与 验证 方法。"
      }),
      // 以下三条属于硬剔除：未授权百科 / 搜索引擎结果页 / 破解营销标题
      makeResult({
        title: "Docker - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Docker",
        snippet: "Docker 安装 相关 的 百科 条目 说明。"
      }),
      makeResult({
        title: "docker 安装 - 搜索结果",
        url: "https://www.google.com/search?q=docker+%E5%AE%89%E8%A3%85",
        snippet: "Docker 安装 相关 搜索 结果 列表。"
      }),
      makeResult({
        title: "免费下载 Docker 安装 包",
        url: "https://wenku.baidu.com/view/docker-install",
        snippet: "Docker 安装 包 免费 下载 说明 文档。"
      })
    ]
  };
}

describe("排序分项 (scoreBreakdown)", () => {
  it("分项之和必须等于原始分，保证排序可逐项核对", () => {
    const { results } = rankSearchPools([buildMixedPool()], { query: "docker 安装", limit: 10 });

    assert.ok(results.length > 0, "混合池应至少产出若干条结果");

    for (const item of results) {
      const bd = item.scoreBreakdown;
      assert.ok(bd, `条目 ${item.url} 缺失 scoreBreakdown`);

      const sum =
        bd.titleCoverage +
        bd.snippetCoverage +
        bd.entityCoverage +
        bd.phraseHit +
        bd.proximity +
        bd.authority +
        bd.consensus +
        bd.engineConsensus +
        bd.recency +
        bd.penalties;

      assert.ok(
        Math.abs(sum - bd.rawScore) < 1e-9,
        `分项之和 ${sum} 与原始分 ${bd.rawScore} 不一致（${item.url}）`
      );
    }
  });

  it("惩罚项为负、且高权威官方文档拿到正向权威分", () => {
    const { results } = rankSearchPools([buildMixedPool()], { query: "docker 安装", limit: 10 });
    const official = results.find((r) => r.url.includes("docs.docker.com"));

    assert.ok(official, "官方文档应出现在结果中");
    assert.ok(official!.scoreBreakdown!.authority > 0, "官方文档的权威分应为正");
    assert.ok(official!.scoreBreakdown!.penalties <= 0, "惩罚项不应为正");
  });
});

describe("分层计数 (RankingReport)", () => {
  it("各层淘汰量之和 = 进入排序的候选数 - 最终保留数", () => {
    const pool = buildMixedPool();
    const { report, results } = rankSearchPools([pool], { query: "docker 安装", limit: 10 });

    const eliminated =
      report.hardRejected +
      report.userFiltered +
      report.belowQualityFloor +
      report.titleLevelRemoved +
      report.domainCapSkipped +
      report.capacitySkipped;

    assert.equal(
      report.candidatesEntered,
      eliminated + report.kept,
      "分层计数未能闭合：存在未归因的候选"
    );
    assert.equal(report.kept, results.length, "kept 应与实际返回条数一致");
  });

  it("真实统计硬剔除数量（不再使用估算系数）", () => {
    const { report } = rankSearchPools([buildMixedPool()], { query: "docker 安装", limit: 10 });

    // 池内明确有 3 条应被硬剔除：未授权百科 / 搜索结果页 / 破解营销标题
    assert.ok(
      report.hardRejected >= 3,
      `硬剔除数应 ≥ 3，实际为 ${report.hardRejected}`
    );
  });

  it("内容近重复应计入 titleLevelRemoved 而不是被静默丢弃", () => {
    const { report } = rankSearchPools([buildMixedPool()], { query: "docker 安装", limit: 10 });
    assert.ok(report.titleLevelRemoved >= 1, "同标题异域名的一条应被计入重复消除");
  });

  it("URL 归一化去重是独立一层，且候选数口径可核对", () => {
    const duplicated: CandidatePool = {
      source: "main",
      results: [
        makeResult({
          title: "Docker 安装 官方文档",
          url: "https://docs.docker.com/engine/install/?utm_source=twitter"
        }),
        makeResult({
          title: "Docker 安装 官方文档",
          url: "https://www.docs.docker.com/engine/install/"
        })
      ]
    };

    // 追踪参数 / www 差异必须归一到同一个 key
    assert.equal(
      normalizeUrlKey("https://docs.docker.com/engine/install/?utm_source=twitter"),
      normalizeUrlKey("https://www.docs.docker.com/engine/install/")
    );

    const { report, totalCandidates, uniqueCandidates } = rankSearchPools([duplicated], {
      query: "docker 安装",
      limit: 10
    });

    assert.equal(totalCandidates, 2, "原始候选数应如实为 2");
    assert.equal(uniqueCandidates, 1, "归一化后应只剩 1 个独立页面");
    assert.equal(report.candidatesEntered, 1, "进入排序的应是去重后的 1 条");
  });
});

describe("用户侧多条件筛选", () => {
  it("未指定任何条件时不参与淘汰（既有行为不漂移）", () => {
    const item = makeResult({ title: "任意标题", url: "https://example.com/a" });
    assert.deepEqual(matchesSearchFilters(item), { pass: true });
    assert.deepEqual(matchesSearchFilters(item, {}), { pass: true });
  });

  it("域名黑名单优先于白名单", () => {
    const item = makeResult({ title: "x", url: "https://wenku.baidu.com/view/a" });
    const verdict = matchesSearchFilters(item, {
      includeDomains: ["baidu.com"],
      excludeDomains: ["wenku.baidu.com"]
    });
    assert.equal(verdict.pass, false);
    assert.equal(verdict.reason, "excluded_domain");
  });

  it("域名白名单匹配子域", () => {
    const docs = makeResult({ title: "x", url: "https://docs.docker.com/engine/" });
    assert.equal(matchesSearchFilters(docs, { includeDomains: ["docker.com"] }).pass, true);
    assert.equal(
      matchesSearchFilters(docs, { includeDomains: ["nginx.com"] }).reason,
      "not_in_included_domains"
    );
  });

  it("来源类型筛选按分类结果生效", () => {
    const docs = makeResult({ title: "x", url: "https://docs.docker.com/engine/" });
    assert.equal(matchesSearchFilters(docs, { sourceTypes: ["documentation"] }).pass, true);
    assert.equal(
      matchesSearchFilters(docs, { sourceTypes: ["academic"] }).reason,
      "source_type_mismatch"
    );
  });

  it("缺少发布时间的条目不被时间条件误杀", () => {
    const noDate = makeResult({ title: "x", url: "https://example.com/a" });
    assert.equal(
      matchesSearchFilters(noDate, { publishedAfter: "2000-01-01T00:00:00.000Z" }).pass,
      true,
      "缺失发布时间不属于淘汰理由"
    );

    const old = makeResult({
      title: "x",
      url: "https://example.com/b",
      publishedDate: "2010-01-01"
    });
    assert.equal(
      matchesSearchFilters(old, { publishedAfter: "2020-01-01T00:00:00.000Z" }).reason,
      "published_before_range"
    );
  });

  it("语言筛选按文本脚本粗判", () => {
    const zh = makeResult({
      title: "Docker 安装教程",
      url: "https://example.com/zh",
      snippet: "这是中文摘要，用于脚本判定。"
    });
    const en = makeResult({
      title: "Docker installation guide",
      url: "https://example.com/en",
      snippet: "This is an English snippet used for script detection."
    });

    assert.equal(matchesSearchFilters(zh, { languages: ["zh"] }).pass, true);
    assert.equal(matchesSearchFilters(zh, { languages: ["en"] }).reason, "language_mismatch");
    assert.equal(matchesSearchFilters(en, { languages: ["en"] }).pass, true);
  });

  it("筛选条件经主入口生效，并计入 userFiltered", () => {
    const { results, report } = rankSearchPools([buildMixedPool()], {
      query: "docker 安装",
      limit: 10,
      filters: { includeDomains: ["docs.docker.com"] }
    });

    for (const item of results) {
      assert.ok(
        item.url.includes("docs.docker.com"),
        `白名单外的域名未被过滤：${item.url}`
      );
    }
  });

  it("maxResults 覆盖服务端默认条数", () => {
    const { results } = rankSearchPools([buildMixedPool()], {
      query: "docker 安装",
      filters: { maxResults: 1 }
    });
    assert.ok(results.length <= 1, "用户指定的条数上限必须生效");
  });
});

describe("来源类型分类", () => {
  it("按域名与路径特征分类，且顺序保证重叠域名归入更精确的类", () => {
    assert.equal(classifySourceType("arxiv.org", "https://arxiv.org/abs/1234"), "academic");
    assert.equal(classifySourceType("docs.docker.com", "https://docs.docker.com/x"), "documentation");
    assert.equal(classifySourceType("www.gov.cn", "https://www.gov.cn/x"), "official");
    assert.equal(classifySourceType("wenku.baidu.com", "https://wenku.baidu.com/x"), "aggregator");
    assert.equal(classifySourceType("stackoverflow.com", "https://stackoverflow.com/q/1"), "community");
    assert.equal(classifySourceType("techcrunch.com", "https://techcrunch.com/a"), "media");
  });
});

describe("事件簇归并", () => {
  it("同事件的改写转载归入同一簇，且两条都保留在结果里", () => {
    const pool: CandidatePool = {
      source: "main",
      results: [
        makeResult({
          title: "Docker 安装步骤",
          url: "https://alpha.example.com/docker-install",
          snippet: "Docker 安装的完整步骤说明，包含环境准备、依赖安装与验证方法。"
        }),
        makeResult({
          title: "Docker 安装流程",
          url: "https://beta.example.com/docker-install",
          snippet: "Docker 安装的完整步骤说明，包含环境准备、依赖安装与验证方法。"
        })
      ]
    };

    const { results, report } = rankSearchPools([pool], { query: "docker 安装", limit: 10 });

    assert.equal(results.length, 2, "簇归并不得淘汰任何条目");
    assert.equal(results[0].eventClusterId, results[1].eventClusterId, "两条应归入同一事件簇");
    assert.ok(report.semanticLevelMerged >= 1, "应记录被归并的条目数");
  });

  it("不同主题不应被误并进同一簇", () => {
    const pool: CandidatePool = {
      source: "main",
      results: [
        makeResult({
          title: "Docker 安装 官方文档",
          url: "https://a.example.com/1",
          snippet: "Docker 安装 官方文档 与 依赖 说明。"
        }),
        makeResult({
          title: "Kubernetes 集群 部署",
          url: "https://b.example.com/2",
          snippet: "Kubernetes 集群 部署 与 节点 管理 说明。"
        })
      ]
    };

    const { results } = rankSearchPools([pool], { query: "docker 安装", limit: 10 });
    if (results.length === 2) {
      assert.notEqual(results[0].eventClusterId, results[1].eventClusterId);
    }
  });
});

describe("筛选入参规范化", () => {
  it("完全无效的输入一律返回 undefined，不猜测默认值", () => {
    assert.equal(normalizeSearchFilters(undefined), undefined);
    assert.equal(normalizeSearchFilters(null), undefined);
    assert.equal(normalizeSearchFilters({}), undefined);
    assert.equal(normalizeSearchFilters("not-an-object"), undefined);
    assert.equal(normalizeSearchFilters({ publishedAfter: "不是日期" }), undefined);
  });

  it("支持数组与逗号分隔串两种写法", () => {
    assert.deepEqual(normalizeSearchFilters({ domains: "a.com, b.com" })?.includeDomains, [
      "a.com",
      "b.com"
    ]);
    assert.deepEqual(normalizeSearchFilters({ domains: ["a.com", "b.com"] })?.includeDomains, [
      "a.com",
      "b.com"
    ]);
  });

  it("域名会被剥掉协议、www 与路径并统一小写", () => {
    assert.deepEqual(normalizeSearchFilters({ domains: "https://www.A.com/path" })?.includeDomains, [
      "a.com"
    ]);
  });

  it("条数会被夹到合法区间", () => {
    assert.equal(normalizeSearchFilters({ limit: "10" })?.maxResults, 10);
    assert.equal(normalizeSearchFilters({ limit: 999 })?.maxResults, 100);
    assert.equal(normalizeSearchFilters({ limit: -5 }), undefined);
  });

  it("白名单外的来源类型被丢弃，有效值保留", () => {
    assert.deepEqual(
      normalizeSearchFilters({ sourceTypes: ["official", "bogus"] })?.sourceTypes,
      ["official"]
    );
    assert.equal(normalizeSearchFilters({ sourceTypes: ["bogus"] }), undefined);
  });

  it("语言标签只接受形如 zh / en-US 的值", () => {
    assert.deepEqual(normalizeSearchFilters({ lang: "zh,en-US" })?.languages, ["zh", "en-us"]);
    assert.equal(normalizeSearchFilters({ lang: "!!!" }), undefined);
  });

  it("时间别名与标准化", () => {
    const f = normalizeSearchFilters({ after: "2024-01-01" });
    assert.ok(f?.publishedAfter?.startsWith("2024-01-01"));
  });
});

describe("命中级别判定", () => {
  it("零证据判为 no_hit，不足最小证据数判为 partial，达标判为 hit", () => {
    assert.equal(resolveHitLevel(0), "no_hit");
    assert.equal(resolveHitLevel(1), "partial");
    assert.equal(resolveHitLevel(MIN_EVIDENCE_COUNT - 1), "partial");
    assert.equal(resolveHitLevel(MIN_EVIDENCE_COUNT), "hit");
    assert.equal(resolveHitLevel(100), "hit");
  });

  it("最小证据数门槛为 3（多源独立佐证的最低要求）", () => {
    assert.equal(MIN_EVIDENCE_COUNT, 3);
  });

  it("可通过 minResults 提高证据门槛，但不能被放宽", () => {
    assert.equal(resolveHitLevel(5), "hit");
    assert.equal(resolveHitLevel(5, 10), "partial", "提高门槛后应判为证据不足");
    assert.equal(resolveHitLevel(10, 10), "hit");
    // 门槛下限被夹到 1：传入 0 或负数不应把判定放宽成"任意一条都算 hit"
    assert.equal(resolveHitLevel(1, 0), "hit");
    assert.equal(resolveHitLevel(0, 0), "no_hit", "零证据永远判为 no_hit");
  });
});

describe("通用结构化官网识别与动态配额验证", () => {
  it("非 TIER1 白名单的小众品牌裸域名首页能够进入 Top 1 并被标记为官方", () => {
    const candidatePool: CandidatePool = {
      source: "test",
      results: [
        makeResult({
          title: "Acme 工具评测与使用体验总结",
          url: "https://tech-blog.example.com/acme-review",
          snippet: "Acme 是一个全新的小众开发工具，本文分享实际使用测评与指南。"
        }),
        makeResult({
          title: "Acme - Official Site | The Next Generation Tool",
          url: "https://acme.org/",
          snippet: "Welcome to Acme official site. Build faster with our modern developer tools."
        }),
        makeResult({
          title: "Acme 常见问题汇总与报错解决方案",
          url: "https://forum.example.com/topic/123",
          snippet: "社区收集整理的 Acme 常见报错排查与安装避坑指南说明。"
        })
      ]
    };

    const { results } = rankSearchPools([candidatePool], { query: "Acme 官网", limit: 5 });
    assert.ok(results.length > 0);
    assert.equal(results[0].url, "https://acme.org/");
    assert.equal(results[0].isOfficial, true);
  });

  it("精确区分搜索引擎搜索结果页与主站首页，避免根域名被误当成搜索端点剔除", () => {
    // 搜索结果页应被硬剔除
    assert.equal(isSearchEndpoint("https://www.google.com/search?q=docker"), true);
    assert.equal(isSearchEndpoint("https://www.bing.com/search?q=test"), true);
    assert.equal(isSearchEndpoint("https://www.baidu.com/s?wd=test"), true);
    assert.equal(isSearchEndpoint("https://duckduckgo.com/?q=test"), true);
    assert.equal(isSearchEndpoint("https://github.com/search?q=test"), true);

    // 主站根域名及主页绝不能被误判为搜索结果页
    assert.equal(isSearchEndpoint("https://www.google.com/"), false);
    assert.equal(isSearchEndpoint("https://google.com"), false);
    assert.equal(isSearchEndpoint("https://www.google.com/?hl=zh-CN"), false);
    assert.equal(isSearchEndpoint("https://www.google.com.tw/index.html"), false);
    assert.equal(isSearchEndpoint("https://www.bing.com/"), false);
    assert.equal(isSearchEndpoint("https://baidu.com/"), false);
  });

  it("搜索品牌词 google 时，google.com 根主页稳居 Rank #1 且被正确识别为官方", () => {
    const candidatePool: CandidatePool = {
      source: "web_search",
      results: [
        makeResult({
          title: "Sign in - Google Accounts",
          url: "https://accounts.google.com/",
          snippet: "Sign in to access your Google Account, services, and preferences."
        }),
        makeResult({
          title: "Google",
          url: "https://www.google.com/",
          snippet: "Search the world's information, including webpages, images, videos and more."
        }),
        makeResult({
          title: "Google Maps",
          url: "https://maps.google.com/",
          snippet: "Find local businesses, view maps and get driving directions in Google Maps."
        }),
        makeResult({
          title: "Google - Wikipedia",
          url: "https://en.wikipedia.org/wiki/Google",
          snippet: "Google LLC is an American multinational technology company focus on search..."
        })
      ]
    };

    const { results } = rankSearchPools([candidatePool], { query: "google", limit: 5 });
    assert.ok(results.length > 0);
    assert.equal(results[0].url, "https://www.google.com/");
    assert.equal(results[0].isOfficial, true);
  });
});
