/**
 * 能力词表一致性审计 (Capability Vocabulary Consistency Audit)
 *
 * 纯 Node 实现：不编译 TS、不 spawn 子进程，直接正则解析源码。
 *
 * 目的：验证 widgetIntentAnalyzer 输出的 requiredCapabilities
 * 是否真的能匹配到 widgetPlanner 的 WIDGET_REGISTRY / ARCHETYPE_REGISTRY 能力。
 *
 * 若交集为空或很低，「意图 -> 能力 -> 组件」链路断裂，
 * 系统会静默退化为通用信息卡片（即"所有结果都是同一种卡片"）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const analyzerSrc = read("server/widgetIntentAnalyzer.ts");
const plannerSrc = read("server/widgetPlanner.ts");

// ---------- 1. 抽取 INTENT_CAPABILITIES_MAP ----------
const intentMapBlock = analyzerSrc.slice(
  analyzerSrc.indexOf("export const INTENT_CAPABILITIES_MAP"),
  analyzerSrc.indexOf("/**", analyzerSrc.indexOf("export const INTENT_CAPABILITIES_MAP"))
);
const intentMap = {};
const intentRe = /(\w+):\s*\[([\s\S]*?)\]/g;
let m;
while ((m = intentRe.exec(intentMapBlock))) {
  intentMap[m[1]] = Array.from(m[2].matchAll(/"([^"]+)"/g)).map((x) => x[1]);
}

// ---------- 2. 抽取 WIDGET_REGISTRY ----------
const registryBlock = plannerSrc.slice(
  plannerSrc.indexOf("const WIDGET_REGISTRY"),
  plannerSrc.indexOf("function resolveArchetypeFromCapabilities")
);
const widgetCaps = new Set();
const widgetEntries = [];
// 按条目切块解析（与 guard_capability_taxonomy.mjs 同口径）：
// 逐字段正则会被组件条目内的注释打断，曾漏掉整个 custom_cards 导致严重低估匹配率。
for (const chunk of registryBlock.split(/(?=\n  \w+: \{\n)/)) {
  if (!/\n\s*type:\s*"/.test(chunk)) continue;
  const name = chunk.match(/^\s*(\w+):\s*\{/)?.[1];
  const capsRaw = chunk.match(/capabilities:\s*\[([\s\S]*?)\]/)?.[1];
  if (!name || !capsRaw) continue;
  const caps = Array.from(capsRaw.matchAll(/"([^"]+)"/g)).map((x) => x[1]);
  widgetEntries.push({ name, caps });
  caps.forEach((c) => widgetCaps.add(c.toLowerCase()));
}

// ---------- 3. 抽取 ARCHETYPE_REGISTRY ----------
const archBlock = plannerSrc.slice(
  plannerSrc.indexOf("const ARCHETYPE_REGISTRY"),
  plannerSrc.indexOf("const WIDGET_REGISTRY")
);
const archetypeCaps = new Set();
const archRe = /capabilities:\s*\[([\s\S]*?)\]/g;
while ((m = archRe.exec(archBlock))) {
  Array.from(m[1].matchAll(/"([^"]+)"/g)).forEach((x) => archetypeCaps.add(x[1].toLowerCase()));
}

// ---------- 4. 抽取 src/widgets/capabilities.ts ----------
const clientCapSrc = read("src/widgets/capabilities.ts");
const clientCapsBlock = clientCapSrc.slice(
  clientCapSrc.indexOf("export const WIDGET_CAPABILITIES"),
  clientCapSrc.indexOf("export type WidgetCapabilityKey")
);
const clientCaps = new Set(
  Array.from(clientCapsBlock.matchAll(/:\s*"([^"]+)"/g)).map((x) => x[1].toLowerCase())
);

// ---------- 报告 ----------
console.log("=".repeat(84));
console.log("三套能力词表规模");
console.log("=".repeat(84));
console.log(`  A. widgetIntentAnalyzer.INTENT_CAPABILITIES_MAP   : ${new Set(Object.values(intentMap).flat()).size} 个能力 (${Object.keys(intentMap).length} 个意图)`);
console.log(`  B. widgetPlanner.WIDGET_REGISTRY                  : ${widgetCaps.size} 个能力 (${widgetEntries.length} 个组件)`);
console.log(`  C. widgetPlanner.ARCHETYPE_REGISTRY               : ${archetypeCaps.size} 个能力`);
console.log(`  D. src/widgets/capabilities.WIDGET_CAPABILITIES   : ${clientCaps.size} 个能力`);

const inter = (a, b) => [...a].filter((x) => b.has(x));
console.log(`\n  A ∩ B (意图需求 能匹配到 组件)   = ${inter(new Set(Object.values(intentMap).flat().map((c) => c.toLowerCase())), widgetCaps).length} 个`);
console.log(`  A ∩ D (意图需求 能匹配到 客户端词表) = ${inter(new Set(Object.values(intentMap).flat().map((c) => c.toLowerCase())), clientCaps).length} 个`);

console.log("\n" + "=".repeat(84));
console.log("【意图需求能力 -> 组件能力 匹配率】(决定组件是否会被选中)");
console.log("=".repeat(84));

let totalNeeded = 0;
let totalHit = 0;
for (const [intent, needed] of Object.entries(intentMap)) {
  const hits = needed.filter((c) => widgetCaps.has(c.toLowerCase()));
  const misses = needed.filter((c) => !widgetCaps.has(c.toLowerCase()));
  const pct = Math.round((hits.length / needed.length) * 100);
  totalNeeded += needed.length;
  totalHit += hits.length;
  const flag = hits.length === 0 ? "❌ 零命中" : pct < 50 ? "⚠️  低命中" : "✅";
  console.log(
    `  ${intent.padEnd(22)} ${String(pct).padStart(3)}%  ${hits.length}/${needed.length}  ${flag}  ${
      misses.length ? "未命中: " + misses.join(", ") : ""
    }`
  );
}
console.log("-".repeat(84));
console.log(`  总体匹配率: ${totalHit}/${totalNeeded} = ${Math.round((totalHit / totalNeeded) * 100)}%`);

console.log("\n" + "=".repeat(84));
console.log("【客户端 matchCapabilitiesScore 若真被调用，得分如何】");
console.log("=".repeat(84));
for (const [intent, needed] of Object.entries(intentMap)) {
  const hits = needed.filter((c) => clientCaps.has(c.toLowerCase()));
  console.log(`  ${intent.padEnd(22)} ${String(Math.round((hits.length / needed.length) * 100)).padStart(3)}%  (${hits.length}/${needed.length})`);
}

console.log("\n" + "=".repeat(84));
console.log("【孤儿能力】组件侧声明但从未被任何意图请求的前 25 个");
console.log("=".repeat(84));
const neededAll = new Set(Object.values(intentMap).flat().map((c) => c.toLowerCase()));
const orphan = [...widgetCaps].filter((c) => !neededAll.has(c));
console.log(`  共 ${orphan.length} / ${widgetCaps.size} 个能力是孤儿 (${Math.round((orphan.length / widgetCaps.size) * 100)}%)`);
console.log("  " + orphan.slice(0, 25).join(", "));

console.log("\n【零命中意图的后果推演】");
for (const [intent, needed] of Object.entries(intentMap)) {
  const hits = needed.filter((c) => widgetCaps.has(c.toLowerCase()));
  if (hits.length === 0) {
    console.log(`  ⚠️  intent="${intent}" 的 ${needed.length} 项需求能力无一命中任何组件`);
    console.log(`      => resolveWidgetsFromCapabilities 只能靠 isAnchorWidget 白名单兜底`);
    console.log(`      => 输出 (quick_answer, takeaways, sources, custom_cards, actions_toolbox) 千篇一律`);
  }
}
