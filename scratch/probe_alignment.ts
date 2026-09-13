/**
 * 临时探针：验证「搜索路由 ↔ 小组件选取」在无 Key 确定性路径下的实际耦合程度。
 * 仅使用已导出函数，不联网。运行： npx tsx scratch/probe_alignment.ts
 */
import { generatePlanForQuery } from "../server/agent.js";
import { planRetrievalRoutes } from "../server/retrievalAgent.js";
import { detectQueryLanguage, resolveTargetLanguage } from "../server/language.js";
import { planWidgetStrategy } from "../server/widgetPlanner.js";
import { analyzeIntentAlgorithmically } from "../server/widgetIntentAnalyzer.js";
import { SearchResult } from "../src/types.js";

const mk = (title: string, url: string, snippet: string, extra: Partial<SearchResult> = {}): SearchResult => ({
  id: url, title, url, snippet, engine: "google", ...extra
});

const CASES: Array<{ q: string; results: SearchResult[] }> = [
  {
    q: "上海天气",
    results: [mk("上海天气预报", "https://weather.com.cn/shanghai", "上海今天多云，最高 25 度，最低 17 度，空气质量良", { isOfficial: true })]
  },
  {
    q: "下载 Photoshop",
    results: [mk("Download Photoshop", "https://www.adobe.com/products/photoshop.html", "Download the latest Photoshop 2025 release for Windows and macOS", { isOfficial: true })]
  },
  {
    q: "什么是量子退火",
    results: [mk("量子退火 - 维基百科", "https://zh.wikipedia.org/wiki/量子退火", "量子退火是一种利用量子涨落寻找函数全局最小值的元启发式算法")]
  },
  {
    q: "Vue vs React 对比",
    results: [mk("Vue vs React comparison 2025", "https://dev.to/vue-vs-react", "A detailed comparison of Vue and React performance, ecosystem and DX")]
  },
  {
    q: "npm install 报错 EACCES",
    results: [mk("Fix npm EACCES permission denied", "https://docs.npmjs.com/resolving-eacces-permissions-errors", "Resolve the EACCES error by fixing npm prefix and permissions")]
  },
  {
    q: "B站剪辑素材",
    results: [mk("免费视频素材下载 - 新片场", "https://www.xinpianchang.com/materials", "海量 4K 视频素材、转场动画、音效免费下载")]
  },
  {
    q: "学习 Python",
    results: [mk("Python 教程 - 官方文档", "https://docs.python.org/zh-cn/3/tutorial/", "Python 官方入门教程，涵盖语法、数据结构与模块")]
  }
];

import { detectBestArchetype } from "../server/cardForge.js";

(async () => {
  for (const c of CASES) {
    const lang = detectQueryLanguage(c.q);
    const target = resolveTargetLanguage(undefined, lang);
    const plan = generatePlanForQuery(c.q, lang, target);
    const routes = planRetrievalRoutes(c.q, plan, lang, 4);
    const algo = analyzeIntentAlgorithmically(c.q, c.results);
    const wp = await planWidgetStrategy({ query: c.q, results: c.results, env: {} });

    console.log(`\n${"=".repeat(88)}\n▌ "${c.q}"`);
    console.log(`  算法意图: ${algo.intent}  (confidence=${algo.confidence}, entity=${algo.entity})`);
    console.log(`  plan.subQueries: ${plan.subQueries.join(" | ")}`);
    console.log(`  检索路由:`);
    for (const r of routes) console.log(`    - [${r.purpose}] "${r.query}"${r.language ? ` lang=${r.language}` : ""}`);
    console.log(`  intentAgent 意图: ${wp.intent} (userGoal=${wp.userGoal})`);
    console.log(`  选中组件: ${wp.widgets.map(w => `${w.type}(${w.size})`).join(", ")}`);
    console.log(`  capabilities: [${wp.capabilities.join(", ")}]`);
    console.log(`  原型: ${wp.suggestedArchetype} · 兜底原型检测: ${detectBestArchetype(c.q, c.results)}`);
  }
})();
