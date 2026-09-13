/**
 * 单色约束守卫 (Monochrome Contract Guardrail)
 *
 * 项目视觉约定**只有一层**：
 *
 *   【约束】界面（文字、底色、边框、分隔线、图标）只允许黑、白与中性灰。
 *   实现方式是 src/index.css 的 @theme 把 Tailwind 每一族色阶整体重映射到
 *   同一条纯中性灰阶。因此源码里 900+ 处 bg-blue-500 / text-emerald-600 之类的
 *   类名**是允许保留的** —— 它们会被令牌解析成灰色，手工改写既无必要也易漏改。
 *
 *   历史上曾有第二层【例外】：品牌 Logo 与约 50 个图标按语义保留彩色。
 *   该层已按 shadcn 画风收敛要求整层删除 —— 图标改走 currentColor，跟随所在
 *   文本的灰阶层级。故本守卫不再放行任何源码内彩色字面量。
 *
 * 本守卫做两件事：
 *   A. 逐一核对 22 族 × 11 档色阶令牌是否全部仍为纯中性灰 —— 防止有人把框架改回彩色；
 *   B. 扫描源码中的内联颜色字面量，任何带色相的值一律视为违规。
 *
 * 若将来确有需要保留的彩色字面量，用显式豁免标记登记：
 *   · 区间豁免：/* @monochrome-exempt:start *​/ ... /* @monochrome-exempt:end *​/
 *   · 行内豁免：在该行任意位置加 // @monochrome-exempt
 * 没有标记的彩色字面量一律视为违规。当前**无任何豁免项**。
 *
 * 运行：node scratch/guard_monochrome.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "server", "functions", "index.html"];
const EXTS = new Set([".ts", ".tsx", ".css", ".html"]);
const START = "@monochrome-exempt:start";
const END = "@monochrome-exempt:end";
const LINE = "@monochrome-exempt";

function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (EXTS.has(path.extname(p))) out.push(p);
    return out;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    walk(path.join(p, e.name), out);
  }
  return out;
}

const isGray = (r, g, b) => Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6 && Math.abs(r - b) <= 6;
const hexToRgb = (h) => {
  let s = h.slice(1);
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (s.length !== 6) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};

const violations = [];
const exempted = [];
let exemptLineCount = 0;

const files = ROOTS.filter((r) => fs.existsSync(r)).flatMap((r) => walk(r));

for (const f of files) {
  let inRegion = false;
  fs.readFileSync(f, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (line.includes(START)) inRegion = true;
      const selfExempt = line.includes(LINE);
      const exempt = inRegion || selfExempt;
      if (exempt && !line.includes(START)) exemptLineCount++;

      const record = (kind, val) =>
        (exempt ? exempted : violations).push(`${f}:${i + 1}  [${kind}]  ${val}`);

      for (const h of line.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
        if (h.length !== 4 && h.length !== 7) continue;
        const rgb = hexToRgb(h);
        if (rgb && !isGray(...rgb)) record("hex", h);
      }
      for (const m of line.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g) || []) {
        const n = m.match(/[\d.]+/g).map(Number);
        if (n.length >= 3 && !isGray(n[0], n[1], n[2])) record("rgb", m.replace(/\s+/g, ""));
      }
      for (const m of line.match(/hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%[^)]*\)/g) || []) {
        const n = m.match(/[\d.]+/g).map(Number);
        if (n.length >= 2 && n[1] > 12) record("hsl", m.replace(/\s+/g, ""));
      }
      for (const m of line.match(/oklch\([^)]*\)/g) || []) {
        const n = m.match(/[\d.]+/g).map(Number);
        if (n.length >= 2 && n[1] > 0.02) record("oklch", m);
      }

      if (line.includes(END)) inRegion = false;
    });
}

console.log(`扫描 ${files.length} 个源码文件`);

/* ---------- A. 令牌层：框架必须仍是纯中性灰 ---------- */
const css = fs.readFileSync("src/index.css", "utf8");
const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
const FAMILIES = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "slate", "gray", "zinc", "neutral", "stone"];
const missing = [];
const notGray = [];
for (const fam of FAMILIES) {
  for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
    const key = `--color-${fam}-${shade}`;
    const m = themeBlock?.[1]?.match(new RegExp(key.replace(/-/g, "\\-") + "\\s*:\\s*(#[0-9a-fA-F]{6})"));
    if (!m) missing.push(key);
    else {
      const rgb = hexToRgb(m[1]);
      if (!rgb || !isGray(...rgb)) notGray.push(`${key}=${m[1]}`);
    }
  }
}
const tokenTotal = FAMILIES.length * 11;
console.log(`\n[A] 框架令牌层：${FAMILIES.length} 族 × 11 档 = ${tokenTotal} 条`);
if (missing.length) console.log(`    缺失映射 ${missing.length} 条`);
if (notGray.length) console.log(`    未收敛为纯灰 ${notGray.length} 条: ${notGray.slice(0, 6).join(", ")}`);
const tokenOk = !missing.length && !notGray.length;
console.log(`    ${tokenOk ? "全部为纯中性灰 (R=G=B)" : "存在被改回彩色的框架色阶"}`);

/* ---------- B. 内联字面量：不允许任何带色相的值 ---------- */
console.log(`\n[B] 内联颜色字面量`);
console.log(`    已豁免（显式标记登记）: ${exempted.length} 处`);
console.log(`    未豁免的彩色字面量: ${violations.length} 处`);
for (const v of violations.slice(0, 30)) console.log("      " + v);

/* ---------- C. 彩色位图资产 ---------- */
console.log(`\n[C] 品牌位图资产（不参与源码扫描，仅登记存在性）`);
for (const a of ["public/logo.png", "public/favicon.png", "public/logo.jpg"]) {
  console.log(`    ${fs.existsSync(a) ? "存在" : "缺失"}  ${a}`);
}

const failed = (tokenOk ? 0 : 1) + (violations.length ? 1 : 0);
console.log(
  `\n单色约束: ${failed === 0 ? "PASSED" : "FAILED"}` +
    `（框架单色${tokenOk ? "保持" : "被破坏"} · 源码内彩色字面量 ${violations.length} 处）`
);
process.exit(failed === 0 ? 0 : 1);
