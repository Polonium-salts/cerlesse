/**
 * 图标彩色层生成器 (Icon Accent Layer Generator)
 *
 * 背景：全局视觉约束是「界面框架只允许黑、白与中性灰」，但 Logo 与图标是
 * 已批准的例外（颜色在此承担语义编码而非装饰）。图标的语义色写在
 * src/index.css 末尾的「品牌与图标的彩色例外层」里。
 *
 * 本脚本负责生成那一段 CSS：扫描项目实际 import 了哪些 lucide 图标，
 * 从 lucide 自己的 barrel 文件里取**权威 kebab 类名**（而非自行猜测
 * PascalCase -> kebab 的转换规则，那会在 CheckCircle2 这类名字上出错），
 * 再按语义分组套上配色，最后打印可直接粘贴的 CSS。
 *
 * 用法：
 *   node scratch/gen_icon_colors.mjs            # 打印生成的 CSS
 *   node scratch/gen_icon_colors.mjs --check    # 只报告覆盖情况（CI 用）
 *
 * 注意：生成的 CSS 必须放在所有 @layer 之外，否则会被 Tailwind 的
 *      @layer utilities 压制而失效 —— 详见 index.css 中的说明。
 */
import fs from "node:fs";
import path from "node:path";

const CHECK_ONLY = process.argv.includes("--check");
const ICON_DIR = "node_modules/lucide-react/dist/esm/icons";
const BARRELS = [
  "node_modules/lucide-react/dist/esm/lucide-react.js",
  "node_modules/lucide-react/dist/esm/index.js"
];

/* ---------- 1. 扫描项目实际用到的图标 ---------- */
function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if ([".ts", ".tsx"].includes(path.extname(p))) out.push(p);
    return out;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    walk(path.join(p, e.name), out);
  }
  return out;
}

const used = new Set();
for (const f of walk("src")) {
  const src = fs.readFileSync(f, "utf8");
  // [^}]* 不跨花括号：避免匹配到相邻的 import 语句
  const re = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']lucide-react["']/g;
  let m;
  while ((m = re.exec(src))) {
    for (const raw of m[1].split(",")) {
      const t = raw.replace(/\btype\b/, "").trim();
      if (!t) continue;
      const orig = t.split(/\s+as\s+/)[0].trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(orig)) used.add(orig);
    }
  }
}

/* ---------- 2. 组件名 -> 权威 kebab 类名 ---------- */
const fileToKebab = new Map();
for (const file of fs.readdirSync(ICON_DIR)) {
  if (!file.endsWith(".js")) continue;
  const m = fs.readFileSync(path.join(ICON_DIR, file), "utf8").match(/createLucideIcon\(\s*["']([^"']+)["']/);
  if (m) fileToKebab.set(file.replace(/\.js$/, ""), m[1]);
}

// barrel 里多个别名共用一条 export 语句：
//   export { default as AlertCircle, default as CircleAlert, ... } from './icons/circle-alert.js';
const pascalToKebab = new Map();
const barrel = BARRELS.find((p) => fs.existsSync(p));
if (barrel) {
  const src = fs.readFileSync(barrel, "utf8");
  const re = /export\s*\{([^}]*)\}\s*from\s*["']\.\/icons\/([\w.-]+)\.js["']/g;
  let m;
  while ((m = re.exec(src))) {
    const kebab = fileToKebab.get(m[2]) || m[2];
    for (const part of m[1].split(",")) {
      const a = part.match(/default\s+as\s+(\w+)/);
      if (a) pascalToKebab.set(a[1], kebab);
    }
  }
}

/* ---------- 3. 语义配色目录 ---------- */
const C = {
  blue: "#4285F4", blueDeep: "#1A73E8", sky: "#38BDF8", cyan: "#06B6D4",
  teal: "#14B8A6", emerald: "#10B981", green: "#34A853", lime: "#84CC16",
  amber: "#FBBC05", amberDeep: "#F59E0B", orange: "#F97316",
  red: "#EA4335", rose: "#F43F5E", pink: "#EC4899",
  violet: "#8B5CF6", purple: "#A855F7", indigo: "#6366F1",
  gray: "#94A3B8"
};

// 同族功能同色，避免变成无逻辑的彩虹。顺序即优先级。
const GROUPS = [
  { color: C.blue, label: "检索 · 导航 · 探索", icons: ["Search", "Compass", "Navigation", "Globe", "Send", "ArrowRight", "ArrowDownRight", "ArrowRightLeft", "ArrowUpRight", "CornerDownLeft", "ZoomIn", "ZoomOut", "History", "RefreshCw"] },
  { color: C.blueDeep, label: "文档 · 外链", icons: ["ExternalLink", "FileText", "BookOpen", "Library"] },
  { color: C.violet, label: "AI 生成 · 智能编排", icons: ["Sparkles", "Bot", "LayoutGrid", "Columns3", "Columns4", "Blocks", "Boxes", "Store"] },
  { color: C.purple, label: "推理 · 深加工", icons: ["Wand2", "BrainCircuit", "Dices", "Quote"] },
  { color: C.green, label: "校验 · 可信", icons: ["Check", "CheckCheck", "CheckCircle2", "ShieldCheck", "UserCheck", "FileCheck", "ThumbsUp", "BookmarkCheck", "ListChecks", "ListOrdered"] },
  { color: C.cyan, label: "指标 · 数据可视化", icons: ["Activity", "BarChart2", "BarChart3", "Layers", "Workflow", "ListTree"] },
  { color: C.emerald, label: "上行 · 正向", icons: ["TrendingUp", "Shield", "Download", "Power"] },
  { color: C.red, label: "下行 · 警示 · 危险", icons: ["TrendingDown", "ShieldAlert", "Lock", "AlertCircle", "AlertTriangle", "Flag", "Target", "X", "Trash2"] },
  { color: C.amberDeep, label: "时效 · 收藏 · 分类", icons: ["Clock", "Calendar", "Ticket", "Tag", "Bookmark", "FolderOpen", "FolderMinus"] },
  { color: C.amber, label: "荣誉 · 评分 · 能量", icons: ["Award", "Crown", "Star", "Lightbulb", "Sun", "Zap"] },
  { color: C.indigo, label: "数据存储 · 基建", icons: ["Database", "Server", "Copy", "Share2", "Terminal", "Code", "Cpu", "Volume2", "QrCode", "Moon", "Play", "PlayCircle"] },
  { color: C.teal, label: "设备 · 归档", icons: ["Smartphone", "Laptop", "Cloud", "Wrench", "FileDown"] },
  { color: C.orange, label: "地点 · 行程 · 分支", icons: ["MapPin", "Pin", "Luggage", "GitFork"] },
  { color: C.rose, label: "对比 · 参数 · 审视", icons: ["Scale", "Filter", "SlidersHorizontal"] },
  { color: C.pink, label: "创意 · 主题", icons: ["Palette"] },
  { color: C.lime, label: "金额 · 商务", icons: ["DollarSign"] },
  { color: C.sky, label: "信息 · 交互辅助", icons: ["Info", "HelpCircle", "MessageSquare", "Maximize2", "Minimize2", "Loader2", "Plus"] },
  { color: C.gray, label: "纯功能性符号", icons: ["ChevronDown", "ChevronUp", "ChevronRight", "Circle", "RotateCcw", "RefreshCcw"] }
];

const colorOf = new Map();
for (const g of GROUPS) for (const n of g.icons) if (!colorOf.has(n)) colorOf.set(n, g.color);

/* ---------- 4. 统计覆盖 ---------- */
const items = [];
const unresolved = [];
const uncategorized = [];
for (const pascal of [...used].sort()) {
  const kebab = pascalToKebab.get(pascal);
  if (!kebab) {
    unresolved.push(pascal);
    continue;
  }
  const color = colorOf.get(pascal);
  if (!color) uncategorized.push(pascal);
  items.push({ pascal, kebab, color: color || C.gray });
}

console.log(`项目实际使用 lucide 图标: ${used.size} 个`);
console.log(`  已归入语义配色: ${items.length - uncategorized.length}`);
console.log(`  未分类（回落柔和蓝灰）: ${uncategorized.length}${uncategorized.length ? " -> " + uncategorized.join(", ") : ""}`);
console.log(`  lucide 中无法解析: ${unresolved.length}${unresolved.length ? " -> " + unresolved.join(", ") : ""}`);

if (CHECK_ONLY) {
  const ok = unresolved.length === 0 && uncategorized.length === 0;
  console.log(`\n覆盖检查: ${ok ? "PASSED（全部图标均已显式分色）" : "FAILED（存在未分色或无法解析的图标）"}`);
  process.exit(ok ? 0 : 1);
}

/* ---------- 5. 输出 CSS ---------- */
const byColor = new Map();
for (const it of items) {
  if (!byColor.has(it.color)) byColor.set(it.color, []);
  byColor.get(it.color).push(it);
}

const out = [];
out.push("/* 检索 · 导航 · 探索 */");
const order = GROUPS.map((g) => g.color).filter((c, i, a) => a.indexOf(c) === i);
const emitted = new Set();
for (const g of GROUPS) {
  const bucket = (byColor.get(g.color) || []).filter((it) => !emitted.has(it.kebab));
  if (!bucket.length) continue;
  for (const it of bucket) emitted.add(it.kebab);
  const selectors = [];
  for (const it of bucket) {
    selectors.push(`.lucide-${it.kebab}`);
    // v0.546 会同时输出两种类名形式，另一种形式在部分图标上才存在，必须一并覆盖
    const pascalKebab = it.pascal.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    if (pascalKebab !== it.kebab) selectors.push(`.lucide-${pascalKebab}`);
  }
  out[out.length - 1] = `/* ${g.label} */`;
  out.push(`${[...new Set(selectors)].join(", ")} { --icon-accent: ${g.color}; }`);
  out.push("");
}
void order;

console.log("\n" + "=".repeat(80));
console.log("以下内容粘贴到 src/index.css 的「品牌与图标的彩色例外层」内（@layer 之外）：");
console.log("=".repeat(80) + "\n");
console.log(out.join("\n").trimEnd());
