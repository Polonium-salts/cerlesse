/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 顶部栏模型选择面板的纯函数契约：元数据解析、过滤、分组、计数。
 * 这些函数决定「用户看到的列表长什么样、能不能搜到想找的模型」，单独锁住。
 *
 * 最后一条用例是回归护栏：本项目是 Tailwind v3.4.17，
 * `h-8.5` / `pl-8.5` / `py-0.2` / `shadow-xs` 这些 v4 命名**不会生成任何 CSS**，
 * 写上去等于没写（按钮高度、搜索框内边距会静默失效）。这条测试盯着这个坑。
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  contextScaleK,
  extractContextBadge,
  filterModels,
  groupModelsByBrand,
  modelTabCounts,
  parseModelMetadata
} from "../../src/components/ModelSelectorDropdown.js";
import type { SelectableModelItem } from "../../src/components/ModelSelectorDropdown.js";

const MODELS: SelectableModelItem[] = [
  { id: "deepseek/deepseek-v4-flash:free", name: "DeepSeek V4 Flash (1000k)", description: "极速推理模型" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3 (Chat)", description: "64k 上下文与函数调用", contextLength: "64k" },
  { id: "openai/o1-mini", name: "o1 Mini", isRecommended: true },
  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", contextWindow: 200000 },
  { id: "x-ai/grok-3", name: "Grok 3" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B" },
  { id: "some-vendor/obscure-model", name: "Obscure" },
  { id: "vision/flux-schnell", name: "FLUX Schnell", pricing: "Free" }
];

test("parseModelMetadata：清洗展示名并识别免费模型", () => {
  const flash = parseModelMetadata(MODELS[0]);
  assert.equal(flash.cleanName, "DeepSeek V4 Flash");
  assert.equal(flash.isFree, true, ":free 后缀算免费");
  assert.equal(flash.contextBadge, "1000k");

  // pricing 写成 Free 也算（大小写无关）
  assert.equal(parseModelMetadata(MODELS[7]).isFree, true);
  // 付费模型不许被误判成免费
  assert.equal(parseModelMetadata(MODELS[1]).isFree, false);
  // 名字里的 :free 也要认
  assert.equal(parseModelMetadata({ id: "x/y", name: "Some Model:free" }).isFree, true);
});

test("parseModelMetadata：厂牌识别不吃错 token", () => {
  assert.equal(parseModelMetadata(MODELS[0]).brand, "DeepSeek");
  assert.equal(parseModelMetadata(MODELS[2]).brand, "OpenAI");
  assert.equal(parseModelMetadata(MODELS[3]).brand, "Anthropic");
  assert.equal(parseModelMetadata(MODELS[4]).brand, "xAI");
  assert.equal(parseModelMetadata(MODELS[5]).brand, "Qwen");
  assert.equal(parseModelMetadata(MODELS[7]).brand, "Vision/Art");
  // 兜底分组：认不出来就归「其他」，不乱贴厂牌
  assert.equal(parseModelMetadata(MODELS[6]).brand, "其他");
  // "o1" 这类短 token 必须落在边界上才认（"cogito" 里的 "o1" 不算 OpenAI）
  assert.equal(parseModelMetadata({ id: "vendor/cogito-8b" }).brand, "其他");
});

test("extractContextBadge / contextScaleK：从名称、ID 或结构化字段取上下文", () => {
  assert.equal(extractContextBadge({ id: "a/b", name: "Model (128k)" }), "128k");
  assert.equal(extractContextBadge({ id: "a/model-1049k" }), "1049k");
  assert.equal(extractContextBadge({ id: "a/c", contextLength: "200k" }), "200k");
  assert.equal(extractContextBadge({ id: "a/d", contextWindow: 200000 }), "200k");
  assert.equal(extractContextBadge({ id: "a/e", contextWindow: 1_000_000 }), "1M");
  assert.equal(extractContextBadge({ id: "a/f" }), "");

  assert.equal(contextScaleK("128k"), 128);
  assert.equal(contextScaleK("1M"), 1000);
  assert.equal(contextScaleK(""), 0);
  assert.equal(contextScaleK("不是长度"), 0);
});

test("filterModels：按关键词搜 ID / 名称 / 描述 / 厂牌，页签各自成立", () => {
  assert.deepEqual(
    filterModels(MODELS, "grok", "all").map((m) => m.id),
    ["x-ai/grok-3"]
  );
  // 描述参与搜索
  assert.deepEqual(
    filterModels(MODELS, "函数调用", "all").map((m) => m.id),
    ["deepseek/deepseek-chat"]
  );
  // 厂牌参与搜索
  assert.ok(filterModels(MODELS, "anthropic", "all").some((m) => m.id === "anthropic/claude-3.7-sonnet"));

  assert.deepEqual(filterModels(MODELS, "", "free").map((m) => m.id), [
    "deepseek/deepseek-v4-flash:free",
    "vision/flux-schnell"
  ]);
  assert.deepEqual(filterModels(MODELS, "", "recommended").map((m) => m.id), ["openai/o1-mini"]);
  // 长上下文线是 200k（含）：1000k / 1M 归一后等价，64k 不算
  assert.deepEqual(filterModels(MODELS, "", "large_ctx").map((m) => m.id), [
    "deepseek/deepseek-v4-flash:free",
    "anthropic/claude-3.7-sonnet"
  ]);

  assert.deepEqual(filterModels(MODELS, "没有这个模型", "all"), []);
});

test("groupModelsByBrand：按厂牌分组且顺序稳定（按首次出现）", () => {
  const groups = groupModelsByBrand(filterModels(MODELS, "", "all"));
  assert.deepEqual(
    groups.map((g) => g.brand),
    ["DeepSeek", "OpenAI", "Anthropic", "xAI", "Qwen", "其他", "Vision/Art"]
  );
  assert.equal(groups[0].items.length, 2, "同厂牌的模型必须归到同一组");
  // 分组不丢模型、不重复
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  assert.equal(total, MODELS.length);
});

test("modelTabCounts：页签角标与实际筛选结果一致", () => {
  const counts = modelTabCounts(MODELS);
  assert.equal(counts.all, MODELS.length);
  assert.equal(counts.free, filterModels(MODELS, "", "free").length);
  assert.equal(counts.recommended, filterModels(MODELS, "", "recommended").length);
  assert.equal(counts.large_ctx, filterModels(MODELS, "", "large_ctx").length);
});

test("回归护栏：组件源码里不许出现 Tailwind v3 生成不出来的间距 / 阴影类", () => {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "ModelSelectorDropdown.tsx"),
    "utf8"
  );
  // 注释里会把这些类名当反面教材写出来，先剥掉注释再扫，否则护栏变成自我误报
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  // 这些 v4 命名在 v3.4.17 下不会产出任何规则（已在 dist 产物里核对过）
  const forbidden = ["h-8.5", "pl-8.5", "pr-8.5", "py-0.2", "px-0.2", "shadow-xs", "backdrop-blur-xs"];
  for (const cls of forbidden) {
    assert.equal(
      source.includes(cls),
      false,
      `${cls} 在 Tailwind v3 不生成样式，写了等于没写，请换成 v3 存在的类名`
    );
  }
  // 自定义断点 xs 也没有在 tailwind.config.ts 里注册，用了同样会失效
  assert.equal(/\bxs:/.test(source), false, "tailwind.config.ts 没有定义 xs 断点");
});
