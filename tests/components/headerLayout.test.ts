/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 移动端顶栏布局的耦合护栏。
 *
 * 布局本身（两行网格、sticky 偏移）没法在 node 里断言 —— 需要真实排版引擎，
 * 已在浏览器里逐档量过（320 / 390 / 1440）。这里只锁住两件**改坏了会静默出错**的事：
 *   1. 结果页次级导航条的 sticky 偏移必须取自 --app-header-offset，
 *      不能再硬写 top-16（移动端顶栏是两行、100px 高，写死会被顶栏盖住）；
 *   2. 顶栏右操作区是网格项，`ml-auto` 会让它按内容宽度收缩而脱离 1fr 轨道，
 *      320px 下把页面撑出横向滚动条 —— 所以它只能带 `sm:ml-auto`；
 *      模型选择器的外层也必须保留 min-w-0，否则窄屏下会去压左边的品牌。
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** 注释里会把这些类名当反面教材写出来，先剥掉注释再扫，否则护栏变成自我误报 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const read = (rel: string) => stripComments(fs.readFileSync(path.join(process.cwd(), rel), "utf8"));

test("顶栏高度定义在 index.css，且次级导航条用变量取偏移", () => {
  const css = read(path.join("src", "index.css"));
  assert.ok(css.includes("--app-header-height: 6.25rem"), "移动端两行顶栏高度应有定义");
  assert.ok(css.includes("--app-header-offset"), "偏移量变量应存在（含安全区内边距）");
  assert.ok(
    /@media\s*\(min-width:\s*640px\)/.test(css) && css.includes("--app-header-height: 4rem"),
    "sm 起应回落到单行的 4rem"
  );

  const app = read(path.join("src", "App.tsx"));
  assert.ok(
    app.includes("sticky top-[var(--app-header-offset)]"),
    "结果页次级导航条必须用变量偏移"
  );
  assert.equal(
    /\bsticky top-16\b/.test(app),
    false,
    "不能再硬写 top-16：移动端顶栏是两行，会被盖住"
  );
});

test("顶栏在移动端是两行网格，搜索独占第二行", () => {
  const header = read(path.join("src", "components", "Header.tsx"));
  assert.ok(
    header.includes("grid-cols-[auto_minmax(0,1fr)]"),
    "移动端应使用网格固定两列（品牌 / 操作），minmax(0,1fr) 才允许右列收缩"
  );
  assert.ok(/col-span-2[^"]*row-start-2/.test(header), "检索框应跨两列落在第二行");
  assert.equal(header.includes("flex-wrap"), false, "用网格就不用 flex-wrap（wrap 会把操作区顶到第三行）");
});

test("右操作区保留网格轨道约束，模型选择器保留 min-w-0", () => {
  const header = read(path.join("src", "components", "Header.tsx"));
  // 只允许 sm:ml-auto，禁止裸 ml-auto（裸 auto 外边距会让网格项按内容宽度收缩）
  const bareMlAuto = /className="[^"]*\bml-auto\b(?<!\bsm:ml-auto)/.test(header);
  assert.equal(bareMlAuto, false, "操作区不能带裸 ml-auto");
  assert.ok(header.includes("sm:ml-auto"), "桌面端仍需要 ml-auto 靠右");

  const dropdown = read(path.join("src", "components", "ModelSelectorDropdown.tsx"));
  assert.ok(
    dropdown.includes("relative flex min-w-0 text-left"),
    "模型选择器外层要 min-w-0 + flex，窄屏下才能被压缩而不是压住品牌"
  );
});
