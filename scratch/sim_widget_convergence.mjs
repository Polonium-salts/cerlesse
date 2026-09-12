/**
 * 组件选择收敛性仿真 (Widget Selection Convergence Simulation)
 *
 * 复刻 widgetPlanner.resolveWidgetsFromCapabilities 的打分逻辑，
 * 验证：面对语义完全不同的搜索词，最终选出的组件集是否被真正区分开。
 *
 * 数据全部从真实源码解析，不硬编码能力清单：
 *   - 意图能力表: server/widgetIntentAnalyzer.ts  INTENT_CAPABILITIES_MAP
 *   - 组件注册表: server/widgetPlanner.ts         WIDGET_REGISTRY
 *
 * 用法：node scratch/sim_widget_convergence.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// ─────────────── 解析意图能力表 ───────────────
const analyzerSrc = read("server/widgetIntentAnalyzer.ts");
const intentBlock = analyzerSrc.slice(
  analyzerSrc.indexOf("export const INTENT_CAPABILITIES_MAP"),
  analyzerSrc.indexOf("/**", analyzerSrc.indexOf("export const INTENT_CAPABILITIES_MAP"))
);
const intentMap = new Map();
for (const m of intentBlock.matchAll(/(\w+):\s*\[([\s\S]*?)\]/g)) {
  intentMap.set(m[1], Array.from(m[2].matchAll(/"([^"]+)"/g)).map((x) => x[1]));
}

// ─────────────── 解析组件注册表（按条目切块，容忍条目内注释） ───────────────
const plannerSrc = read("server/widgetPlanner.ts");
const widgetBlock = plannerSrc.slice(
  plannerSrc.indexOf("const WIDGET_REGISTRY"),
  plannerSrc.indexOf("function resolveArchetypeFromCapabilities")
);
const registry = [];
for (const chunk of widgetBlock.split(/(?=\n  \w+: \{\n)/)) {
  if (!/\n\s*type:\s*"/.test(chunk)) continue;
  const type = chunk.match(/^\s*(\w+):\s*\{/)?.[1];
  const caps = chunk.match(/capabilities:\s*\[([\s\S]*?)\]/)?.[1];
  const basePriority = chunk.match(/basePriority:\s*(\d+)/)?.[1];
  const defaultSize = chunk.match(/defaultSize:\s*"(\w+)"/)?.[1];
  if (!type || !caps || !basePriority || !defaultSize) continue;
  registry.push({
    type,
    capabilities: Array.from(caps.matchAll(/"([^"]+)"/g)).map((x) => x[1]),
    basePriority: Number(basePriority),
    defaultSize
  });
}

const EXPECTED_WIDGET_COUNT = 17;
if (registry.length !== EXPECTED_WIDGET_COUNT) {
  console.error(
    `❌ 组件注册表解析出 ${registry.length} 个组件，预期 ${EXPECTED_WIDGET_COUNT} 个，仿真结果不可信。`
  );
  process.exit(1);
}

// ─────────────── 复刻 resolveWidgetsFromCapabilities 打分 ───────────────
const ANCHORS = ["quick_answer", "takeaways", "sources", "custom_cards", "actions_toolbox"];

function resolveWidgets(capabilities) {
  const capSet = new Set(capabilities.map((c) => c.toLowerCase()));

  const scored = registry.map((def) => {
    const matchedCaps = def.capabilities.filter((c) => capSet.has(c.toLowerCase()));
    let score = def.basePriority;

    if (matchedCaps.length > 0) score += matchedCaps.length * 12;
    if (def.type === "custom_cards") score += 20;
    if (
      def.type === "actions_toolbox" &&
      (capSet.has("install_command") || capSet.has("download") || capSet.has("fix_command"))
    )
      score += 25;
    if (
      def.type === "official_portal" &&
      (capSet.has("official_site") || capSet.has("official_url") || capSet.has("official_portal"))
    )
      score += 20;
    if (def.type === "comparison" && (capSet.has("compare_table") || capSet.has("feature_matrix")))
      score += 25;
    if (
      def.type === "verification_checklist" &&
      (capSet.has("install_step") || capSet.has("checklist") || capSet.has("troubleshooting_audit"))
    )
      score += 18;

    return {
      type: def.type,
      score,
      // 与 widgetPlanner 一致：命中能力的组件抬升一个层级
      priority: matchedCaps.length > 0 ? score + 100 : score,
      matchedCaps
    };
  });

  const kept = scored.filter((s) => s.matchedCaps.length > 0 || ANCHORS.includes(s.type));
  // 下游排版引擎按 priority 降序重排，这里同样以 priority 为准
  kept.sort((a, b) => b.priority - a.priority);
  return kept;
}

// 每个意图的代表性搜索词
const SCENARIO_LABELS = {
  software_download: "下载 Photoshop",
  weather: "上海天气",
  resource_search: "找一个B站视频素材库",
  tech_comparison: "Vue vs React 选哪个",
  study_tutorial: "学习 Python",
  github_project: "GitHub 上热门的 Vue 仓库",
  troubleshooting: "npm install 报错 EACCES",
  portal_navigation: "少数派官网",
  concept_explanation: "什么是量子退火",
  general_knowledge: "最近有什么科技新闻"
};

console.log("=".repeat(96));
console.log("不同搜索词 -> 实际选中的组件集合 (按得分降序)");
console.log("=".repeat(96));

const topSets = {};
const coverage = {};

for (const [intent, caps] of intentMap) {
  const label = SCENARIO_LABELS[intent] || intent;
  const kept = resolveWidgets(caps);
  const top5 = kept.slice(0, 5).map((k) => k.type);
  topSets[label] = top5;

  const hitWidgets = kept.filter((k) => k.matchedCaps.length > 0);
  coverage[intent] = hitWidgets.length;

  console.log(`\n▸ "${label}"  (intent=${intent})`);
  console.log(`  命中能力的组件: ${hitWidgets.length} / ${registry.length}`);
  kept.slice(0, 6).forEach((k, i) => {
    const tag =
      k.matchedCaps.length > 0
        ? `匹配[${k.matchedCaps.slice(0, 4).join(",")}${k.matchedCaps.length > 4 ? ",…" : ""}]`
        : "锚点兜底(无能力命中)";
    console.log(`   ${String(i + 1).padStart(2)}. ${k.type.padEnd(22)} priority=${String(k.priority).padStart(3)}  ${tag}`);
  });
}

// ─────────────── 收敛性度量 ───────────────
const labels = Object.keys(topSets);
const jaccard = (a, b) => {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  return inter / new Set([...sa, ...sb]).size;
};

let sum = 0;
let n = 0;
const identical = [];
for (let i = 0; i < labels.length; i++) {
  for (let j = i + 1; j < labels.length; j++) {
    const s = jaccard(topSets[labels[i]], topSets[labels[j]]);
    sum += s;
    n++;
    if (s === 1) identical.push([labels[i], labels[j]]);
  }
}
const avg = sum / n;

console.log("\n" + "=".repeat(96));
console.log("收敛性度量：Top-5 组件集合 两两 Jaccard 相似度 (1.0 = 完全相同)");
console.log("=".repeat(96));
console.log(`  平均相似度          : ${(avg * 100).toFixed(1)}%   对比组合数: ${n}`);
console.log(`  完全相同的搜索词对  : ${identical.length} 组`);
identical.slice(0, 10).forEach(([a, b]) => console.log(`    "${a}"  ≡  "${b}"`));

const zeroCoverage = Object.entries(coverage).filter(([, c]) => c < 2).map(([i]) => i);
console.log(`\n  命中组件 < 2 个的意图: ${zeroCoverage.length} 个 ${zeroCoverage.length ? "(" + zeroCoverage.join(", ") + ")" : ""}`);

// 本仿真内实测的意图需求覆盖率（与 guard 脚本口径一致）
const allWidgetCaps = new Set(registry.flatMap((r) => r.capabilities.map((c) => c.toLowerCase())));
const allNeeds = [...intentMap.values()].flat();
const needHitRate = Math.round(
  (allNeeds.filter((c) => allWidgetCaps.has(c.toLowerCase())).length / allNeeds.length) * 100
);

console.log("\n" + "=".repeat(96));
console.log("改造前后对比");
console.log("=".repeat(96));
console.log("  指标                            改造前     改造后");
console.log("  " + "-".repeat(56));
console.log(`  意图需求 -> 组件命中率          19%    ->  ${needHitRate}%`);
console.log(`  零命中(<2 组件)意图数           2 个   ->  ${zeroCoverage.length} 个`);
console.log(`  Top-5 平均 Jaccard 相似度       73.3%  ->  ${(avg * 100).toFixed(1)}%`);
console.log(`  完全相同的搜索词对              3 组   ->  ${identical.length} 组`);
