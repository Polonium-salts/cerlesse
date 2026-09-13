import fs from "fs";
import path from "path";

const ROOT = process.cwd();

// Wu* -> { module, newName }
const MAP = {
  WuCardHeader: ["card", "CardHeader"],
  WuCardTitle: ["card", "CardTitle"],
  WuCardDescription: ["card", "CardDescription"],
  WuCardAction: ["card", "CardAction"],
  WuCardContent: ["card", "CardContent"],
  WuCardFooter: ["card", "CardFooter"],
  WuCard: ["card", "Card"],

  wuButtonVariants: ["button", "buttonVariants"],
  WuButton: ["button", "Button"],

  WuBadge: ["badge", "Badge"],

  WuTabsList: ["tabs", "TabsList"],
  WuTabsTrigger: ["tabs", "TabsTrigger"],
  WuTabs: ["tabs", "Tabs"],

  WuTableHeader: ["table", "TableHeader"],
  WuTableBody: ["table", "TableBody"],
  WuTableRow: ["table", "TableRow"],
  WuTableHead: ["table", "TableHead"],
  WuTableCell: ["table", "TableCell"],
  WuTable: ["table", "Table"],

  WuAlertTitle: ["alert", "AlertTitle"],
  WuAlertDescription: ["alert", "AlertDescription"],
  WuAlert: ["alert", "Alert"],

  WuTextarea: ["textarea", "Textarea"],
  WuInput: ["input", "Input"],
  WuProgress: ["progress", "Progress"],
  WuSwitch: ["switch", "Switch"],
  WuSkeleton: ["skeleton", "Skeleton"],
  WuSeparator: ["separator", "Separator"],
  WuLabel: ["label", "Label"],
  WuKbd: ["kbd", "Kbd"],

  // widget-specific composites (stay in widget-composites.tsx, names unchanged)
  WuStat: ["widget-composites", "WuStat"],
  WuBars: ["widget-composites", "WuBars"],
  WuArea: ["widget-composites", "WuArea"],
  WuField: ["widget-composites", "WuField"],
  WuEmpty: ["widget-composites", "WuEmpty"],
};

const IMPORT_RE =
  /import\s*\{([^}]*)\}\s*from\s*"([^"]*components\/ui\/widgetKit\.js)"\s*;?/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(path.join(ROOT, "src"));
let changed = 0;
const report = [];

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("widgetKit.js")) continue;

  let touched = false;

  src = src.replace(IMPORT_RE, (_m, namesRaw, spec) => {
    touched = true;
    const names = namesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const prefix = spec.slice(0, spec.indexOf("components/ui/widgetKit.js"));
    const groups = new Map();
    for (const n of names) {
      const entry = MAP[n];
      if (!entry) {
        report.push(`  !! UNMAPPED ${n} in ${path.relative(ROOT, file)}`);
        continue;
      }
      const [mod, newName] = entry;
      if (!groups.has(mod)) groups.set(mod, new Set());
      groups.get(mod).add(newName);
    }

    const lines = [...groups.keys()]
      .sort()
      .map((mod) => {
        const list = [...groups.get(mod)].sort().join(", ");
        return `import { ${list} } from "${prefix}components/ui/${mod}.js";`;
      });
    return lines.join("\n");
  });

  if (touched) {
    // rename identifiers everywhere (word-boundary safe)
    for (const [oldName, [, newName]] of Object.entries(MAP)) {
      if (oldName === newName) continue;
      src = src.replace(new RegExp(`\\b${oldName}\\b`, "g"), newName);
    }
    fs.writeFileSync(file, src);
    changed++;
    report.push(`  ok ${path.relative(ROOT, file)}`);
  }
}

console.log(`migrated ${changed} files`);
console.log(report.join("\n"));
