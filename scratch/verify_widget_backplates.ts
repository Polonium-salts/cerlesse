/**
 * 小组件背板验证 (Widget Backplate Verification)
 *
 * 背景：磁贴外层容器并不绘制背景，背板由各组件自己提供
 * （标准做法是套一层 IOSWidget，它带 bg-white/95 + border + shadow + rounded）。
 * 一旦某个组件忘了画背板，它就会裸露在页面底色上；若其内部还使用深色主题文字，
 * 就会出现"看不见内容"的观感 —— 即用户反馈的"有一个小组件没有背板"。
 *
 * 判定规则：
 *   把每个组件真实 SSR 渲染出来，扫描最外层前 N 个元素的开标签，
 *   要求其中至少有一个绘制了"不透明背板"背景类（bg-* 且不透明度 >= 90 或无透明度修饰符）。
 *   半透明叠加层（bg-white/5、bg-zinc-900/40、bg-blue-500/20）不算背板。
 *
 * 用法: node ./node_modules/tsx/dist/cli.mjs scratch/verify_widget_backplates.ts
 * 退出码 0 = 全部有背板；1 = 存在缺失
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ── SSR 环境桩：组件里会访问 document / localStorage ──
(globalThis as any).document = {
  documentElement: { classList: { contains: () => false, add: () => {}, remove: () => {} } }
};
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
// navigator 在 Node 24 中是只读 getter，无需桩（已内置）

import { WidgetRuntime } from "../src/widgets/runtime.js";
import {
  registerAllOfficialWidgets,
  OFFICIAL_WIDGET_MODULES
} from "../src/widgets/official/index.js";
import { WidgetBlueprintRenderer } from "../src/widgets/blueprintRenderer.js";
import type { SearchSynthesisResult, WidgetBlueprint } from "../src/types.js";

registerAllOfficialWidgets();

/** 覆盖各组件所需字段的通用 mock 结果 */
const mockResult = {
  query: "下载 Blender 4.2",
  summary: "Blender 是一款开源三维创作套件，支持建模、渲染、动画与视频剪辑全流程。",
  modelUsed: "test-model",
  detectedLanguage: "zh",
  rawResultCount: 12,
  keyTakeaways: ["完全免费且开源", "内置 Cycles 光追渲染器", "跨平台支持 Windows / macOS / Linux"],
  filteredResults: [
    {
      id: "s1",
      title: "Blender 官方下载页",
      url: "https://www.blender.org/download/",
      snippet: "Download Blender for Windows, macOS and Linux.",
      isOfficial: true
    },
    {
      id: "s2",
      title: "Blender 4.2 发行说明",
      url: "https://docs.blender.org/manual/en/latest/",
      snippet: "Release notes for Blender 4.2 LTS."
    }
  ],
  // ComparisonMatrixWidget 期望的是维度数组（会对它调用 .slice）
  comparisonTable: [
    { name: "授权模式", values: ["开源免费", "订阅制"] },
    { name: "平台支持", values: ["全平台", "全平台"] },
    { name: "学习曲线", values: ["中等", "陡峭"] }
  ],
  mindMap: {
    title: "Blender 知识体系",
    children: [
      { title: "建模", children: [{ title: "多边形建模" }, { title: "雕刻" }] },
      { title: "渲染", children: [{ title: "Cycles" }] }
    ]
  },
  followUpQuestions: ["Blender 和 Maya 哪个更适合初学者？", "Blender 的插件生态如何？"],
  sources: [],
  steps: [],
  customCards: []
} as unknown as SearchSynthesisResult;

/**
 * 不透明背板判定
 * 接受: bg-white/95, bg-[#161619]/95, bg-zinc-900, bg-zinc-950
 * 拒绝: bg-white/5, bg-zinc-900/40, bg-blue-500/20 （半透明叠加层）
 */
function hasOpaquePanel(classAttr: string): boolean {
  if (!classAttr) return false;
  const tokens = classAttr.split(/\s+/).filter((t) => t.startsWith("bg-"));
  for (const token of tokens) {
    if (token.includes("gradient")) continue;
    const m = token.match(/^(bg-[a-z0-9#\[\]_.-]+?)(?:\/(\d+))?$/i);
    if (!m) continue;
    const opacity = m[2] ? Number(m[2]) : 100;
    if (opacity >= 90) return true;
  }
  return false;
}

/** 判断根节点是否为"翻转容器"（背板在正面/背面子元素上，而非容器本身） */
function isFlipContainer(classAttr: string): boolean {
  return classAttr.includes("group/livetile") || classAttr.includes("perspective");
}

interface ScanResult {
  ok: boolean;
  reason: string;
  firstTags: string[];
}

/**
 * 扫描渲染结果最外层前 N 个开标签，寻找背板。
 *
 * depth 默认 24：带 renderBack 的组件会被 WidgetRuntime 包进 3D 翻转容器
 * （翻转容器 → 按钮 → svg → path... → 变换层 → 正面包层 → 组件背板），
 * 背板可能落在第 9~10 层，窗口太浅会产生误报。
 */
function scanBackplate(html: string, depth = 24): ScanResult {
  const tagRe = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const firstTags: string[] = [];
  let m: RegExpExecArray | null;
  let count = 0;

  // 收集前 depth 个"元素"开标签（跳过 svg/path 等图标细节不计入判定但保留展示）
  const collected: Array<{ tag: string; cls: string }> = [];
  while ((m = tagRe.exec(html)) && count < depth * 3) {
    const tag = m[1];
    const attrs = m[2] || "";
    const clsMatch = attrs.match(/class="([^"]*)"/);
    const cls = clsMatch ? clsMatch[1] : "";
    if (/^(br|img|input|hr|meta|link)$/i.test(tag)) continue;
    collected.push({ tag, cls });
    firstTags.push(`<${tag} class="${cls.slice(0, 110)}">`);
    count++;
  }

  for (const el of collected.slice(0, depth)) {
    if (hasOpaquePanel(el.cls)) {
      return { ok: true, reason: `<${el.tag}> 绘制了不透明背板`, firstTags };
    }
    // 翻转容器本身不需要背板，其正/背面子元素会提供
    void isFlipContainer(el.cls);
  }

  return {
    ok: false,
    reason: `最外层 ${depth} 个元素中没有任何不透明背板背景类`,
    firstTags
  };
}

async function main() {
  console.log("=".repeat(96));
  console.log("官方组件背板验证 (SSR 真实渲染)");
  console.log("=".repeat(96));

  const failures: string[] = [];

  const modules = OFFICIAL_WIDGET_MODULES.filter((m) => m.id !== "custom_cards");
  for (const mod of modules) {
    let html = "";
    let err: string | null = null;
    try {
      html = renderToStaticMarkup(
        React.createElement(WidgetRuntime, {
          module: mod,
          activeResult: mockResult,
          size: mod.defaultSize || "medium"
        })
      );
    } catch (e: any) {
      err = e?.message || String(e);
    }

    if (err) {
      console.log(`\n▸ ${String(mod.id).padEnd(22)} ⚠️  渲染异常: ${err}`);
      failures.push(`${mod.id}: SSR 渲染抛出异常 (${err})`);
      continue;
    }
    if (!html || html.trim() === "") {
      console.log(`\n▸ ${String(mod.id).padEnd(22)} ⚠️  渲染为空（无可判定内容）`);
      continue;
    }

    const scan = scanBackplate(html, 24);
    console.log(`\n▸ ${String(mod.id).padEnd(22)} ${scan.ok ? "✅ 有背板" : "❌ 缺背板"}  — ${scan.reason}`);
    if (!scan.ok) {
      scan.firstTags.slice(0, 12).forEach((t) => console.log(`      ${t}`));
      failures.push(`${mod.id}: ${scan.reason}`);
    }
  }

  // ── 复合蓝图组件（Server-Driven UI Blueprint）──
  console.log("\n" + "-".repeat(96));
  console.log("复合蓝图组件 (blueprintRenderer)");
  console.log("-".repeat(96));

  const mockBlueprint: WidgetBlueprint = {
    blueprintId: "bp_test",
    title: "Blender 4.2 官方软件与下载枢纽",
    subtitle: "多维信息聚合 · 极速直达安装",
    entity: "Blender",
    intent: "software_download",
    goal: "download",
    layout: "composite_card",
    size: "large",
    themeColor: "blue",
    components: [
      {
        capability: "software_info",
        type: "software_info",
        data: { name: "Blender", version: "4.2 LTS", description: "开源三维创作套件", icon: "Box" }
      },
      {
        capability: "download_button",
        type: "download_action",
        data: { primaryUrl: "https://www.blender.org/download/", label: "一键下载 Blender", fileSize: "~320MB" }
      },
      {
        capability: "install_command",
        type: "quick_action",
        data: { label: "命令行安装", command: "winget install BlenderFoundation.Blender", shell: "powershell" }
      }
    ]
  };

  try {
    const html = renderToStaticMarkup(
      React.createElement(WidgetBlueprintRenderer, { blueprint: mockBlueprint, size: "large" })
    );
    const scan = scanBackplate(html, 24);
    console.log(`\n▸ ${"blueprint (复合蓝图)".padEnd(20)} ${scan.ok ? "✅ 有背板" : "❌ 缺背板"}  — ${scan.reason}`);
    if (!scan.ok) {
      console.log("   最外层标签:");
      scan.firstTags.slice(0, 12).forEach((t) => console.log(`      ${t}`));
      failures.push(`blueprint: ${scan.reason}`);
    }
  } catch (e: any) {
    console.log(`\n▸ blueprint 渲染异常: ${e?.message || e}`);
    failures.push(`blueprint: SSR 渲染抛出异常`);
  }

  console.log("\n" + "=".repeat(96));
  console.log("汇总");
  console.log("=".repeat(96));
  console.log(`  受检组件: ${modules.length + 1} 个`);

  if (failures.length > 0) {
    console.log(`\n❌ 存在 ${failures.length} 个背板缺失/异常:`);
    failures.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  }

  console.log("\n✅ 全部组件都绘制了背板。");
}

main().catch((e) => {
  console.error("验证器自身失败:", e);
  process.exit(1);
});
