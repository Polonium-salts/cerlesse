/**
 * 检索相关性重排内核回归测试
 * 运行：npx tsx scratch/test_retrieval_ranker.ts
 */
import {
  buildQueryProfile,
  mergeCandidatePools,
  rankSearchPools,
  normalizeUrlKey,
  authorityPrior
} from "../server/retrievalRanker.js";
import { planRetrievalRoutes } from "../server/retrievalAgent.js";
import { SearchResult } from "../src/types.js";

let passed = true;
const check = (name: string, condition: boolean, extra = "") => {
  if (condition) {
    console.log(`  OK   ${name}${extra ? ` (${extra})` : ""}`);
  } else {
    passed = false;
    console.log(`  FAIL ${name}${extra ? ` (${extra})` : ""}`);
  }
};

const mk = (title: string, url: string, snippet: string, engine = "google", extra: Partial<SearchResult> = {}): SearchResult => ({
  id: url,
  title,
  url,
  snippet,
  engine,
  ...extra
});

console.log("\n=== 1. 查询画像：实体与意图修饰词分离 ===");
{
  const p = buildQueryProfile("React 状态管理的优缺点对比");
  check("核心实体保留", p.entityPhrase.includes("React") || p.entityPhrase.includes("react"), p.entityPhrase);
  check("剔除'优缺点/对比'意图词", !/优缺点|对比/.test(p.entityPhrase), p.entityPhrase);
  check("切出词项", p.terms.length > 0, `${p.terms.length} 项`);
  check("CJK 二元组生效", p.terms.includes("状态") && p.terms.includes("管理"));

  const en = buildQueryProfile("how to install docker on ubuntu");
  check("英文实体短语", en.entityPhrase.toLowerCase().includes("docker"), en.entityPhrase);
  check("英文停用词剔除", !en.terms.includes("how") && !en.terms.includes("the"));
}

console.log("\n=== 2. 域名权威先验 ===");
{
  check("GitHub 高信任", authorityPrior("github.com") >= 18);
  check("MDN 高信任", authorityPrior("developer.mozilla.org") >= 18);
  check("政府站高信任", authorityPrior("www.nasa.gov") >= 18);
  check("文库站降权", authorityPrior("wenku.baidu.com") < 0);
  check("CSDN 下载站降权", authorityPrior("download.csdn.net") < 0);
}

console.log("\n=== 3. URL 归一化去重 ===");
{
  const a = normalizeUrlKey("https://www.Example.com/docs/?x=1#hash");
  const b = normalizeUrlKey("http://example.com/docs?x=1");
  check("不同写法归一为同一 key", a === b, `${a} vs ${b}`);
}

console.log("\n=== 4. 多路共识统计 ===");
{
  const pools = [
    { source: "q0", results: [mk("Docker 官方安装文档", "https://docs.docker.com/engine/install/ubuntu/", "Ubuntu 上安装 Docker Engine 的官方步骤与命令", "google")] },
    { source: "q1", results: [mk("Install Docker Engine on Ubuntu", "https://docs.docker.com/engine/install/ubuntu", "Official instructions to install Docker Engine on Ubuntu", "bing")] },
    { source: "q2", results: [mk("docker ubuntu 安装教程", "https://www.example-blog.com/docker-ubuntu", "某博客的 docker 安装教程，仅供参考")] }
  ];
  const merged = mergeCandidatePools(pools);
  check("三条候选合并为两条（去重生效）", merged.length === 2, `${merged.length} 条`);
  const official = merged.find((m) => m.result.url.includes("docs.docker.com"))!;
  check("共识计数 ≥ 2", official.hits >= 2, `hits=${official.hits}`);
  check("引擎集合 ≥ 2", official.engines.size >= 2, `engines=${official.engines.size}`);
}

console.log("\n=== 5. 重排结果：权威与相关性应压倒内容农场 ===");
{
  const pools = [
    {
      source: "main",
      results: [
        mk("Docker 安装教程（超详细）", "https://wenku.baidu.com/view/abc123", "免费下载 docker 安装教程文档，注册即可查看完整版"),
        mk("Install Docker Engine on Ubuntu", "https://docs.docker.com/engine/install/ubuntu/", "Official step-by-step instructions to install Docker Engine on Ubuntu, including prerequisites and verification."),
        mk("docker 优惠券限时抢购", "https://spam-promo.top/coupon/docker", "免费下载破解版 docker 注册码，加微信领取最低价"),
        mk("Ubuntu 上安装 Docker 的最佳实践", "https://juejin.cn/post/123456", "完整梳理 Ubuntu 安装 docker 的步骤、镜像加速与常见报错排查")
      ]
    },
    {
      source: "en",
      results: [
        mk("Install Docker Engine on Ubuntu", "https://docs.docker.com/engine/install/ubuntu", "Official instructions to install Docker Engine on Ubuntu.", "bing")
      ]
    }
  ];

  const { results, totalCandidates, uniqueCandidates } = rankSearchPools(pools, {
    query: "how to install docker on ubuntu",
    limit: 10
  });

  check("候选总数统计", totalCandidates === 5, `${totalCandidates}`);
  check("去重后唯一候选", uniqueCandidates === 4, `${uniqueCandidates}`);
  check("垃圾导流站被剔除", !results.some((r) => r.url.includes("spam-promo.top")));
  check("官方文档排第一", results[0]?.url.includes("docs.docker.com"), results[0]?.url);
  check("第一名的相关度分数显著高于末尾", results[0].relevanceScore > results[results.length - 1].relevanceScore,
    `${results[0].relevanceScore} > ${results[results.length - 1].relevanceScore}`);
  check("打分了依据可供前端展示", results.every((r) => r.relevanceReason.length > 0));

  console.log("  排序结果：");
  results.forEach((r, i) => {
    console.log(`    ${i + 1}. [${r.relevanceScore}] ${r.title.slice(0, 38)}  <- ${r.relevanceReason}`);
  });
}

console.log("\n=== 6. 相关性：无关条目必须被压到后面 ===");
{
  const pools = [
    {
      source: "main",
      results: [
        mk("今天天气不错适合出门散步", "https://weather-blog.com/post/1", "记录一下周末的天气和心情，顺便聊聊生活"),
        mk("量子纠缠的物理机制与实验验证", "https://arxiv.org/abs/1234.5678", "本文系统阐述了量子纠缠的非定域性机制与贝尔不等式实验验证"),
        mk("量子计算入门", "https://zhuanlan.zhihu.com/p/999", "量子比特、量子门与量子纠缠是量子计算的核心概念")
      ]
    }
  ];
  const { results } = rankSearchPools(pools, { query: "量子纠缠 原理", limit: 10 });
  check("完全无关的条目被质量地板剔除", !results.some((r) => r.url.includes("weather-blog")),
    results.map((r) => r.url).join(" | "));
  check("学术信源排在首位", results[0].url.includes("arxiv.org"), results[0]?.url);
  check("相关信源全部保留", results.length === 2, `${results.length} 条`);
  check("相关度单调不增", results.every((r, i) => i === 0 || results[i - 1].relevanceScore >= r.relevanceScore));
}

console.log("\n=== 7. 多样性：单域名配额生效 ===");
{
  // 7a 信源充足时，单域名不得超过配额
  const mixed = [0, 1, 2, 3, 4].flatMap((d) =>
    Array.from({ length: 3 }, (_, i) =>
      mk(`Docker 安装教程 ${d}-${i}`, `https://site-${d}.com/post-${i}`, "docker 安装教程 ubuntu 完整步骤说明", "google")
    )
  );
  const mixedRes = rankSearchPools([{ source: "main", results: mixed }], {
    query: "docker 安装教程",
    limit: 10,
    maxPerDomain: 2
  }).results;
  const counts = new Map<string, number>();
  for (const r of mixedRes) {
    const host = new URL(r.url).hostname;
    counts.set(host, (counts.get(host) || 0) + 1);
  }
  check("信源充足时单域名不超配额", Array.from(counts.values()).every((c) => c <= 2), JSON.stringify(Object.fromEntries(counts)));
  check("覆盖多家不同域名", counts.size >= 5, `${counts.size} 个域名`);

  // 7b 全网只有单一域名时，兜底补位必须保证下游有料可用
  const single = Array.from({ length: 8 }, (_, i) =>
    mk(`Docker 教程第 ${i + 1} 篇`, `https://only-source.com/article-${i}`, "docker 安装教程 ubuntu 步骤说明", "google")
  );
  const singleRes = rankSearchPools([{ source: "main", results: single }], {
    query: "docker 安装教程",
    limit: 10,
    maxPerDomain: 2
  }).results;
  check("单一信源兜底补位", singleRes.length >= 6, `${singleRes.length} 条`);
}

console.log("\n=== 8. 确定性：同一输入必须给出同一输出 ===");
{
  const pools = [
    { source: "a", results: [mk("A 页面", "https://a.com/1", "关于 A 的内容说明"), mk("B 页面", "https://b.com/1", "关于 B 的内容说明")] },
    { source: "b", results: [mk("C 页面", "https://c.com/1", "关于 C 的内容说明")] }
  ];
  const one = rankSearchPools(pools, { query: "内容说明", limit: 10 }).results.map((r) => r.url);
  const two = rankSearchPools(pools, { query: "内容说明", limit: 10 }).results.map((r) => r.url);
  check("两次结果完全一致", JSON.stringify(one) === JSON.stringify(two));
}

console.log("\n=== 9. 查询规划：多路由必须覆盖不同检索视角 ===");
{
  const plan = {
    originalQuery: "如何安装 docker on ubuntu",
    intent: "技术实现细节",
    subQueries: ["如何安装 docker on ubuntu", "如何安装 docker on ubuntu 架构解析与底层原理", "如何安装 docker on ubuntu 最佳实践与避坑"],
    comparisonDimensions: []
  };
  const routes = planRetrievalRoutes(
    "如何安装 docker on ubuntu",
    plan as any,
    { code: "zh", name: "中文", flag: "🇨🇳" } as any,
    5
  );

  check("主查询永远排第一", routes[0].query === "如何安装 docker on ubuntu", routes[0]?.query);
  check("路由数量受上限约束", routes.length <= 5, `${routes.length} 条`);
  check("路由之间互不重复", new Set(routes.map((r) => r.query)).size === routes.length);
  check("包含权威路由", routes.some((r) => r.purpose.includes("权威")), routes.map((r) => r.purpose).join(" | "));
  check("包含实操路由", routes.some((r) => r.purpose.includes("实操")));
  check("每条路由都带用途说明（可解释）", routes.every((r) => r.purpose.length > 0));

  const comparable = planRetrievalRoutes("react vs vue", {
    originalQuery: "react vs vue",
    intent: "对比",
    subQueries: ["react vs vue"],
    comparisonDimensions: []
  } as any, { code: "en", name: "English", flag: "🇺🇸" } as any, 4);
  check("英文查询使用英文检索式",
    comparable.some((r) => /official documentation|best practices/.test(r.query)),
    comparable.map((r) => r.query).join(" | "));

  // 回归：名额被计划自带的子查询占满时，设计路由不允许被挤掉。
  // 这正是"权威路由（官方文档）"从未真正下发过的原始缺陷 —— 通用意图查询（docker 安装）
  // 的计划子查询数恰好等于 maxRoutes，先进先出的截断把它们全部吃光。
  const crowded = planRetrievalRoutes(
    "docker 安装",
    {
      originalQuery: "docker 安装",
      intent: "综合",
      subQueries: [
        "docker 安装",
        "docker 安装 documentation official overview",
        "docker 安装 latest updates architecture",
        "docker official docs release"
      ],
      comparisonDimensions: []
    } as any,
    { code: "zh", name: "中文", flag: "🇨🇳" } as any,
    4
  );
  const crowdedPurposes = crowded.map((r) => r.purpose).join(" | ");
  check("计划子查询占满名额时权威路由仍在下发", crowded.some((r) => r.purpose.includes("权威")), crowdedPurposes);
  check("计划子查询占满名额时实操路由仍在下发", crowded.some((r) => r.purpose.includes("实操")), crowdedPurposes);
  check("四条路由覆盖四种不同检索视角", new Set(crowded.map((r) => r.purpose)).size === crowded.length, crowdedPurposes);

  // 回归：混排子查询（中文主体 + 英文意图尾巴）必须拉丁化，并把检索语言切到 en
  const crossLingual = crowded.find((r) => r.language === "en");
  check("混排子查询被拉丁化并切到英文检索", Boolean(crossLingual) && /^[\x20-\x7E]+$/.test(crossLingual!.query), crossLingual?.query);

  // 回归：`k8s` 这类「字母 + 数字」的缩写主体也要能触发跨语言路由
  const kb = planRetrievalRoutes(
    "k8s 集群部署",
    { originalQuery: "k8s 集群部署", intent: "技术", subQueries: ["k8s 集群部署"], comparisonDimensions: [] } as any,
    { code: "zh", name: "中文", flag: "🇨🇳" } as any,
    5
  );
  check("缩写主体词也能触发跨语言英文路由",
    kb.some((r) => r.language === "en" && /k8s/i.test(r.query)),
    kb.map((r) => `[${r.language || "zh"}] ${r.query}`).join(" | "));
}

console.log(`\n检索内核（重排 + 规划）: ${passed ? "PASSED" : "FAILED"}\n`);
if (!passed) process.exit(1);
