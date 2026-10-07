/**
 * 临时脚本：把 MarkdownContent 用 dist 里真实编译出的 Tailwind CSS 渲染成
 * 一个自包含 HTML，用来看「信源卡穿插在正文里」到底长什么样。
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "../src/widgets/components/MarkdownContent.js";
import { SourcePreviewCard } from "../src/widgets/components/SourceLink.js";

const SOURCES = [
  {
    index: 1,
    title: "搜索 - 哔哩哔哩_bilibili",
    url: "https://search.bilibili.com/video",
    snippet:
      "bilibili是国内知名的视频弹幕网站，这里有及时的动漫新番，活跃的ACG氛围，有创意的Up主。大家可以在这里找到许多欢乐。"
  },
  {
    index: 2,
    title: "量子退火 - 维基百科",
    url: "https://zh.wikipedia.org/wiki/量子退火",
    snippet: "量子退火（Quantum annealing）是一种元启发式算法，用于在离散搜索空间中寻找最优解。"
  },
  {
    index: 3,
    title: "Quantum annealing - Wikipedia",
    url: "https://en.wikipedia.org/wiki/Quantum_annealing",
    snippet: "Quantum annealing is a metaheuristic for finding the global minimum of a given objective function."
  }
];

const ASSISTANT_ANSWER = `哔哩哔哩是国内知名的视频弹幕网站 [1]，其站内搜索入口见 [搜索页](https://search.bilibili.com/video)。

## 与量子退火的关系

- 量子退火属于元启发式算法 [2]
- 英文条目另见 [Quantum annealing](https://en.wikipedia.org/wiki/Quantum_annealing)

代码示例里的 \`[1]\` 不该长出信源卡，表格单元格里的也一样：

\`\`\`js
const arr = [1, 2, 3];
\`\`\`

| 维度 | 来源 |
| --- | --- |
| 视频 | [1] |
`;

const answerHtml = renderToStaticMarkup(
  React.createElement(MarkdownContent, { sources: SOURCES, language: "zh", children: ASSISTANT_ANSWER })
);

// 悬停浮层卡（variant 默认 popover）与「对不上信源」的形态
const popoverHtml = renderToStaticMarkup(
  React.createElement(SourcePreviewCard, { source: SOURCES[0], index: 1, language: "zh" })
);
const notFoundHtml = renderToStaticMarkup(
  React.createElement(SourcePreviewCard, {
    source: { title: "", url: "", snippet: "" },
    index: 7,
    language: "zh"
  })
);

const cssFile = fs
  .readdirSync(path.join("dist", "assets"))
  .find((f) => f.startsWith("index-") && f.endsWith(".css"));
if (!cssFile) throw new Error("dist/assets 里找不到编译后的 CSS，请先跑 vite build");
const css = fs.readFileSync(path.join("dist", "assets", cssFile), "utf8");

const panel = (theme: string) => `
<div class="${theme}" data-theme="${theme}" style="background: hsl(var(--background)); padding: 24px; border-radius: 12px;">
  <div class="wrap">
    <div class="self-end max-w-[70%] rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground">量子退火是什么？顺便给个 bilibili 的搜索入口</div>
    <div class="bg-background/50 rounded-xl border border-border/60 p-4 sm:p-5 text-foreground shadow-sm">
      ${answerHtml}
    </div>
    <div style="display:flex; gap:12px; align-items:flex-start;">
      ${popoverHtml}
      ${notFoundHtml}
    </div>
  </div>
</div>`;

const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<title>常显信源卡预览</title>
<style>${css}</style>
<style>body { margin: 0; padding: 24px; background: #666; }
.wrap { max-width: 760px; display: flex; flex-direction: column; gap: 14px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
</style>
</head>
<body>
<div class="grid">${panel("light")}${panel("dark")}</div>
</body>
</html>`;

fs.mkdirSync("tmp", { recursive: true });
fs.writeFileSync(path.join("tmp", "preview-inline-source-cards.html"), html, "utf8");
console.log("written:", path.resolve("tmp/preview-inline-source-cards.html"), "css:", cssFile);
