/**
 * 能力分类法回归护栏 (Capability Taxonomy Regression Guard)
 *
 * 校验 src/widgets/capabilityTaxonomy.ts 作为单一事实源是否被真正遵守。
 *
 * 断言项：
 *   A1 每个意图需求项都必须是规范能力 ID
 *   A2 每个意图需求项必须至少能被一个组件声明（否则该需求永远选不中组件）
 *   A3 每个别名映射的目标必须是规范能力 ID
 *   A4 每个规范能力必须至少被一个组件或一个卡片原型引用（消除孤儿能力）
 *   A5 归一化必须是幂等的（规范 ID 再归一化仍是自身）
 *
 * 用法：node scratch/guard_capability_taxonomy.mjs
 * 退出码 0 = 全部通过；1 = 存在违约（应阻断合并）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const taxonomySrc = read("src/widgets/capabilityTaxonomy.ts");
const analyzerSrc = read("server/widgetIntentAnalyzer.ts");
const plannerSrc = read("server/widgetPlanner.ts");

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);

// ─────────────── 解析规范能力全集 ───────────────
const canonicalBlock = taxonomySrc.slice(
  taxonomySrc.indexOf("export const CANONICAL_CAPABILITIES"),
  taxonomySrc.indexOf("] as const;", taxonomySrc.indexOf("export const CANONICAL_CAPABILITIES"))
);
const canonical = Array.from(canonicalBlock.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
const canonicalSet = new Set(canonical);
if (canonical.length < 50) fail(`规范能力全集解析异常，仅得到 ${canonical.length} 项`);

// ─────────────── 解析别名表 ───────────────
const aliasBlockStart = taxonomySrc.indexOf("export const CAPABILITY_ALIASES");
const aliasBlock = taxonomySrc.slice(
  aliasBlockStart,
  taxonomySrc.indexOf("\n};", aliasBlockStart)
);
const aliases = new Map();
for (const m of aliasBlock.matchAll(/([A-Za-z0-9_]+)\s*:\s*"([^"]+)"/g)) {
  aliases.set(m[1].toLowerCase(), m[2]);
}

// ─────────────── 解析意图能力表 ───────────────
const intentBlock = analyzerSrc.slice(
  analyzerSrc.indexOf("export const INTENT_CAPABILITIES_MAP"),
  analyzerSrc.indexOf("/**", analyzerSrc.indexOf("export const INTENT_CAPABILITIES_MAP"))
);
const intentMap = new Map();
for (const m of intentBlock.matchAll(/(\w+):\s*\[([\s\S]*?)\]/g)) {
  intentMap.set(m[1], Array.from(m[2].matchAll(/"([^"]+)"/g)).map((x) => x[1]));
}
if (intentMap.size === 0) fail("INTENT_CAPABILITIES_MAP 解析失败");

// ─────────────── 解析组件与原型注册表 ───────────────
const widgetBlock = plannerSrc.slice(
  plannerSrc.indexOf("const WIDGET_REGISTRY"),
  plannerSrc.indexOf("function resolveArchetypeFromCapabilities")
);

// 按条目切块解析，避免依赖 type 与 capabilities 字段相邻
// （组件条目里可能夹带注释，逐字段正则会被注释打断）
const widgetCaps = new Map(); // capability -> widget keys
const widgetEntries = widgetBlock.split(/(?=\n  \w+: \{\n)/).filter((chunk) => /\n\s*type:\s*"/.test(chunk));
for (const chunk of widgetEntries) {
  const keyMatch = chunk.match(/^\s*(\w+):\s*\{/);
  const capsMatch = chunk.match(/capabilities:\s*\[([\s\S]*?)\]/);
  if (!keyMatch || !capsMatch) continue;
  const widgetKey = keyMatch[1];
  for (const c of capsMatch[1].matchAll(/"([^"]+)"/g)) {
    const cap = c[1].toLowerCase();
    if (!widgetCaps.has(cap)) widgetCaps.set(cap, new Set());
    widgetCaps.get(cap).add(widgetKey);
  }
}
const widgetKeysParsed = new Set(widgetEntries.map((c) => c.match(/^\s*(\w+):\s*\{/)?.[1]).filter(Boolean));

const archBlock = plannerSrc.slice(
  plannerSrc.indexOf("const ARCHETYPE_REGISTRY"),
  plannerSrc.indexOf("const WIDGET_REGISTRY")
);
const archetypeCaps = new Set();
for (const m of archBlock.matchAll(/capabilities:\s*\[([\s\S]*?)\]/g)) {
  for (const c of m[1].matchAll(/"([^"]+)"/g)) archetypeCaps.add(c[1].toLowerCase());
}

if (widgetCaps.size === 0) fail("WIDGET_REGISTRY 解析失败");
// 防止解析遗漏组件条目后护栏"假通过"（曾经因条目内夹注释而漏掉整个 custom_cards）
const EXPECTED_WIDGET_COUNT = 17;
if (widgetKeysParsed.size !== EXPECTED_WIDGET_COUNT) {
  fail(
    `WIDGET_REGISTRY 解析出 ${widgetKeysParsed.size} 个组件，预期 ${EXPECTED_WIDGET_COUNT} 个（解析遗漏或注册表被改动未同步护栏）`
  );
}

// ─────────────── A3 别名目标必须是规范能力 ───────────────
for (const [from, to] of aliases) {
  if (!canonicalSet.has(to)) fail(`A3 别名 "${from}" -> "${to}"，但 "${to}" 不是规范能力 ID`);
}

// ─────────────── 归一化实现（与 TS 侧逻辑保持一致） ───────────────
const canonicalKey = (raw) => String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
const normalize = (raw) => {
  const key = canonicalKey(raw);
  if (canonicalSet.has(key)) return key;
  const alias = aliases.get(key);
  return alias && canonicalSet.has(alias) ? alias : null;
};

// ─────────────── A1 + A2 意图需求必须规范且可命中组件 ───────────────
console.log("=".repeat(92));
console.log("A1/A2  意图需求 -> 规范能力 -> 组件命中");
console.log("=".repeat(92));

let totalNeeds = 0;
let totalHits = 0;

for (const [intent, needs] of intentMap) {
  totalNeeds += needs.length;
  const rows = [];
  const hitWidgets = new Set();
  let hits = 0;

  for (const need of needs) {
    if (!canonicalSet.has(canonicalKey(need))) {
      fail(`A1 intent="${intent}" 的需求 "${need}" 不是规范能力 ID`);
      rows.push(`✗ ${need} (非规范)`);
      continue;
    }
    const widgets = widgetCaps.get(canonicalKey(need));
    if (!widgets || widgets.size === 0) {
      fail(`A2 intent="${intent}" 的需求 "${need}" 没有任何组件声明，永远无法命中`);
      rows.push(`✗ ${need} (无组件)`);
      continue;
    }
    hits += 1;
    widgets.forEach((w) => hitWidgets.add(w));
    rows.push(`✓ ${need} -> ${[...widgets].join(",")}`);
  }

  const pct = Math.round((hits / needs.length) * 100);
  console.log(`\n▸ ${intent.padEnd(20)} ${String(pct).padStart(3)}%  命中组件 ${hitWidgets.size} 个`);
  rows.forEach((r) => console.log(`    ${r}`));
  if (hitWidgets.size < 2) {
    warnings.push(`intent="${intent}" 仅能命中 ${hitWidgets.size} 个组件，桌面差异化不足`);
  }
}

// 重新统计总命中（上面的循环里 totalHits 逻辑冗余，这里一次性算准）
totalHits = 0;
for (const [, needs] of intentMap) {
  for (const need of needs) {
    const widgets = widgetCaps.get(canonicalKey(need));
    if (canonicalSet.has(canonicalKey(need)) && widgets && widgets.size > 0) totalHits += 1;
  }
}

// ─────────────── A4 规范能力不得是孤儿 ───────────────
for (const cap of canonical) {
  const inWidget = widgetCaps.has(cap);
  const inArchetype = archetypeCaps.has(cap);
  if (!inWidget && !inArchetype) {
    fail(`A4 规范能力 "${cap}" 既无组件也无原型引用（孤儿能力）`);
  } else if (!inWidget) {
    warnings.push(`规范能力 "${cap}" 仅被原型引用，无法直接参与组件选择`);
  }
}

// ─────────────── A5 归一化幂等 ───────────────
for (const cap of canonical) {
  const once = normalize(cap);
  const twice = once ? normalize(once) : null;
  if (once !== cap || twice !== once) {
    fail(`A5 能力 "${cap}" 归一化不幂等: ${cap} -> ${once} -> ${twice}`);
  }
}

// ─────────────── 汇总 ───────────────
console.log("\n" + "=".repeat(92));
console.log("汇总");
console.log("=".repeat(92));
console.log(`  规范能力全集          : ${canonical.length} 项`);
console.log(`  别名映射              : ${aliases.size} 项`);
console.log(`  组件声明的能力        : ${widgetCaps.size} 项 (来自 ${widgetKeysParsed.size} 个组件)`);
console.log(`  原型声明的能力        : ${archetypeCaps.size} 项`);
console.log(`  意图需求总数          : ${totalNeeds} 项`);
console.log(
  `  意图需求 -> 组件命中率: ${totalHits}/${totalNeeds} = ${Math.round((totalHits / totalNeeds) * 100)}%`
);

const orphanCanonical = canonical.filter((c) => !widgetCaps.has(c));
console.log(`  未被任何组件声明的规范能力: ${orphanCanonical.length} 项${orphanCanonical.length ? " (" + orphanCanonical.join(", ") + ")" : ""}`);

if (warnings.length > 0) {
  console.log(`\n⚠️  警告 ${warnings.length} 条:`);
  warnings.forEach((w) => console.log(`   - ${w}`));
}

if (failures.length > 0) {
  console.log(`\n❌ 护栏未通过，共 ${failures.length} 项违约:`);
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
}

console.log("\n✅ 护栏全部通过：意图 -> 能力 -> 组件链路一致。");
