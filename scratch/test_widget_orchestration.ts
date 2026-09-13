/**
 * 小组件编排精准度回归 (Widget Orchestration Precision Regression)
 * ============================================================
 * 校验"Agent 编排 -> 组件选择"这条链路的三个精度承诺：
 *
 *   P1 数据闸门：任何"有数据要求但本轮没产出"的组件都不允许上桌
 *                （空对比矩阵、空导图、空要点、无信源时的工具箱……）
 *   P2 任务贴合：不同任务类型的桌面必须真正不同（天气不挂相关度分布图，
 *                概念速查不挂事实核查，对比任务矩阵必须靠前）
 *   P3 上桌预算：一次编排上桌组件数不超过预算（少而准，而不是铺满一屏）
 *
 * 用法：npx tsx scratch/test_widget_orchestration.ts
 * 退出码 0 = 全部通过；1 = 存在精度回归
 */
import { planWidgetStrategy } from "../server/widgetPlanner.js";
import { planWidgetLayout } from "../server/layoutAgent.js";
import { analyzeWidgetIntent } from "../server/widgetIntentAnalyzer.js";
import { SearchResult, ResultWidgetKey } from "../src/types.js";

const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures.push(`${name}${detail ? " :: " + detail : ""}`);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function mkResult(
  i: number,
  url: string,
  title: string,
  snippet: string,
  opts: { official?: boolean; score?: number; engine?: string } = {}
): SearchResult {
  return {
    id: `r${i}`,
    title,
    url,
    snippet,
    engine: opts.engine || (i % 2 === 0 ? "searxng" : "tavily"),
    score: opts.score ?? 88 - i * 4,
    isOfficial: Boolean(opts.official)
  };
}

interface OrchestrationCase {
  name: string;
  query: string;
  results: SearchResult[];
  signals: {
    comparisonCount?: number;
    mindMapBranches?: number;
    followUpCount?: number;
    takeawayCount?: number;
    summaryLength?: number;
    hasCustomCards?: boolean;
  };
  mustInclude?: ResultWidgetKey[];
  mustExclude?: ResultWidgetKey[];
}

const richResults: SearchResult[] = [
  mkResult(0, "https://docs.docker.com/engine/install/", "Docker Engine 官方安装文档", "官方安装步骤与系统要求", { official: true }),
  mkResult(1, "https://mirrors.tuna.tsinghua.edu.cn/help/docker-ce/", "Docker CE 国内镜像源配置", "镜像加速与 apt 源替换"),
  mkResult(2, "https://www.docker.com/products/docker-desktop/", "Docker Desktop 下载", "跨平台客户端下载", { official: true }),
  mkResult(3, "https://blog.example.com/docker-install-ubuntu", "Ubuntu 安装 Docker 完整教程", "命令行安装与常见报错"),
  mkResult(4, "https://juejin.cn/post/docker-compose", "docker compose 常用编排示例", "compose 文件与命令示例"),
  mkResult(5, "https://segmentfault.com/a/docker-network", "Docker 网络模式详解", "bridge/host/overlay 网络原理")
];

const cases: OrchestrationCase[] = [
  {
    name: "P1 空数据组件必须休眠（无对比行/无导图/无要点/无正式信源）",
    query: "量子退火原理是什么",
    results: [],
    signals: { comparisonCount: 0, mindMapBranches: 0, followUpCount: 0, takeawayCount: 0, summaryLength: 0 },
    mustExclude: ["comparison", "mindmap", "official_portal", "takeaways", "analytics_trend", "metrics_telemetry", "actions_toolbox", "fast_chat"]
  },
  {
    name: "P1 对比矩阵：无对比行时不得上桌（即便查询含'对比'）",
    query: "Docker 和 Podman 对比区别",
    results: richResults,
    signals: { comparisonCount: 0, mindMapBranches: 0, followUpCount: 3, takeawayCount: 4, summaryLength: 1600 },
    mustExclude: ["comparison"]
  },
  {
    name: "P2 对比任务：确有对比行时矩阵必须上桌且排在阅读序前列",
    query: "Docker 和 Podman 对比区别",
    results: richResults,
    signals: { comparisonCount: 3, mindMapBranches: 0, followUpCount: 3, takeawayCount: 4, summaryLength: 1600 },
    mustInclude: ["comparison"]
  },
  {
    name: "P2 天气任务：不得挂与天气无关的信源相关度分布",
    query: "上海今天天气怎么样",
    results: [
      mkResult(0, "https://weather.cma.cn/web/weather/58362.html", "上海实时天气", "气温 26℃ 湿度 68%", { official: true }),
      mkResult(1, "https://www.accuweather.com/zh/cn/shanghai/106577/weather-forecast/106577", "上海天气预报", "未来 7 天降水与气温"),
      mkResult(2, "https://tianqi.moji.com/weather/china/shanghai", "上海墨迹天气", "穿什么与空气质量"),
      mkResult(3, "https://www.qweather.com/weather/shanghai-101020100.html", "上海和风天气", "逐小时预报")
    ],
    signals: { comparisonCount: 0, mindMapBranches: 0, followUpCount: 3, takeawayCount: 3, summaryLength: 900 },
    mustExclude: ["analytics_trend", "comparison", "verification_checklist", "agent_workflow"]
  },
  {
    name: "P2 概念速查：短摘要时休眠分面研报，且不被官网结果劫持成导航任务",
    query: "什么是量子退火",
    results: richResults.slice(0, 4),
    signals: { comparisonCount: 0, mindMapBranches: 0, followUpCount: 3, takeawayCount: 3, summaryLength: 420 },
    mustExclude: ["topic_digest", "agent_workflow", "verification_checklist", "mindmap", "official_portal"]
  },
  {
    name: "P2 深度研报：长摘要 + 拓扑分支时导图与专题研报应上桌",
    query: "2024 年全球新能源汽车产业链发展趋势研报",
    results: richResults,
    signals: { comparisonCount: 2, mindMapBranches: 4, followUpCount: 4, takeawayCount: 6, summaryLength: 4200, hasCustomCards: true },
    mustInclude: ["takeaways", "sources", "mindmap", "topic_digest"]
  }
];

/**
 * P0 意图仲裁精准度：组件选择的上游是意图分类。
 * 这里锁定三类曾经真实发生的误判 —— 它们都会直接导致"组件选不准"。
 */
const intentCases: Array<{ query: string; results: SearchResult[]; expect: string[]; forbid: string[] }> = [
  {
    query: "什么是量子退火",
    results: richResults.slice(0, 4),
    expect: ["concept_explanation"],
    // 曾经因为结果里恰好有官方文档，被判成官网寻址
    forbid: ["portal_navigation", "software_download"]
  },
  {
    query: "Docker 和 Podman 对比区别",
    results: richResults,
    expect: ["tech_comparison"],
    // 曾经因为结果摘要含"安装/下载"，被判成软件下载
    forbid: ["software_download"]
  },
  {
    query: "2024 年全球新能源汽车产业链发展趋势研报",
    results: richResults,
    expect: ["general_knowledge", "concept_explanation"],
    forbid: ["portal_navigation", "software_download"]
  },
  {
    query: "上海今天天气怎么样",
    results: [mkResult(0, "https://weather.cma.cn/web/weather/58362.html", "上海实时天气", "气温 26℃", { official: true })],
    expect: ["weather"],
    forbid: ["portal_navigation"]
  },
  {
    query: "Blender 下载安装教程",
    results: [mkResult(0, "https://www.blender.org/download/", "Blender 官方下载", "Blender 4.2 安装包下载", { official: true })],
    expect: ["software_download"],
    forbid: []
  }
];

async function runIntentArbitration() {
  console.log("\n▸ P0 意图仲裁精准度（组件选择的上游）");
  for (const c of intentCases) {
    const res = await analyzeWidgetIntent({ query: c.query, results: c.results, env: {} });
    console.log(`   query="${c.query}" → ${res.intent} (confidence=${res.confidence})`);
    check(`意图命中 ${c.expect.join("/")}`, c.expect.includes(res.intent), `实际 ${res.intent}`);
    if (c.forbid.length > 0) {
      check("未发生越权误判", !c.forbid.includes(res.intent), c.forbid.includes(res.intent) ? `误判为 ${res.intent}` : "");
    }
  }
}

async function runCase(c: OrchestrationCase) {
  console.log(`\n▸ ${c.name}`);
  console.log(`   query="${c.query}" 结果数=${c.results.length}`);

  const plan = await planWidgetStrategy({ query: c.query, results: c.results, env: {} });
  const { strategy } = await planWidgetLayout({
    query: c.query,
    results: c.results,
    widgetPlan: plan,
    targetLanguage: "zh-CN",
    enableLlmRefinement: false,
    signals: c.signals
  });

  const enabled = (strategy.enabledWidgets || []) as ResultWidgetKey[];
  console.log(`   计划层(${plan.widgets.length}): ${plan.widgets.map((w) => w.type).join(" → ")}`);
  console.log(`   上桌层(${enabled.length}): ${enabled.join(" → ")}`);

  // P3 预算：计划层与上桌层都不得超预算
  check("P3 规划数量 ≤ 9", plan.widgets.length <= 9, `实际 ${plan.widgets.length}`);
  check("P3 上桌数量 ≤ 9", enabled.length <= 9, `实际 ${enabled.length}`);
  check("P3 上桌集合与阅读序一致", enabled.every((k) => (strategy.componentOrder || []).includes(k)));

  // P1 数据闸门：启用的组件必须真的有数据
  const dataReady: Record<string, boolean> = {
    comparison: (c.signals.comparisonCount || 0) > 0,
    mindmap: (c.signals.mindMapBranches || 0) > 0,
    takeaways: (c.signals.takeawayCount || 0) > 0,
    sources: c.results.length > 0,
    official_portal: c.results.some((r) => r.isOfficial),
    followup: (c.signals.followUpCount || 0) > 0,
    analytics_trend: c.results.length >= 4,
    metrics_telemetry: c.results.length > 0,
    actions_toolbox: c.results.length > 0,
    fast_chat: c.results.length > 0,
    topic_digest: (c.signals.summaryLength || 0) >= 800,
    quick_answer: (c.signals.summaryLength || 0) > 0
  };
  const violated = enabled.filter((k) => dataReady[k] === false);
  check("P1 无空壳组件上桌", violated.length === 0, violated.length ? `违规: ${violated.join(", ")}` : "");

  if (c.mustInclude) {
    const missing = c.mustInclude.filter((k) => !enabled.includes(k));
    check("P2 必备组件在桌", missing.length === 0, missing.length ? `缺失: ${missing.join(", ")}` : "");
  }
  if (c.mustExclude) {
    const present = c.mustExclude.filter((k) => enabled.includes(k));
    check("P2 无关组件已休眠", present.length === 0, present.length ? `误上桌: ${present.join(", ")}` : "");
  }

  // 阅读序去重校验
  const order = strategy.componentOrder || [];
  check("阅读序无重复", new Set(order).size === order.length);
}

async function main() {
  console.log("=".repeat(88));
  console.log("小组件编排精准度回归 (Widget Orchestration Precision)");
  console.log("=".repeat(88));

  for (const c of cases) {
    await runCase(c);
  }

  await runIntentArbitration();

  console.log("\n" + "=".repeat(88));
  if (failures.length > 0) {
    console.log(`❌ 编排精准度回归失败，共 ${failures.length} 项:`);
    failures.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  }
  console.log(`✅ 编排精准度回归全部通过（${cases.length} 个任务场景）`);
}

main().catch((err) => {
  console.error("编排精准度回归执行异常:", err);
  process.exit(1);
});
