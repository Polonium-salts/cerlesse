/**
 * 搜索精准度基准 (Search Precision Benchmark)
 * ============================================================
 * 目的：把"结果准不准"从主观感受变成**可回归的数字**。
 *
 * 每条用例由一个「查询 + 人工标注的候选池」组成，标注 relevant=true/false。
 * 候选池是模拟搜索引擎真实返回的形态（含噪声：无关条目、权威站上的无关页、
 * 内容农场、同义变体、词形变化的官方文档）。
 *
 * 指标：
 *   P@1 / P@3 / P@5  —— 前 K 条中相关条目的比例（精确率）
 *   NDCG@5           —— 考虑排序位置的排序质量（二值相关性）
 *   Bad@5            —— 前 5 条中无关条目的数量（越低越好）
 *   Syn@5            —— 同义/词形变体条目能否进入前 5（召回，越高越好）
 *
 * 运行：npx tsx scratch/test_search_precision.ts
 */
import { rankSearchPools, type CandidatePool } from "../server/retrievalRanker.js";
import { SearchResult } from "../src/types.js";

interface Judge {
  /** 该条是否与查询真正相关（人工标注） */
  relevant: boolean;
  /** 该条是否为「同义/词形变体」形态（用于考察同义词与模糊匹配能力） */
  variant?: boolean;
  /** 该条是否属于「伪信源」：搜索结果页 / 站内搜索链接，绝不是内容页 */
  fake?: boolean;
  result: SearchResult;
}

const mk = (
  title: string,
  url: string,
  snippet: string,
  engine = "google",
  extra: Partial<SearchResult> = {}
): SearchResult => ({ id: url, title, url, snippet, engine, ...extra });

/* ============================================================
   标注用例集
   ============================================================ */
const CASES: Array<{ name: string; query: string; judged: Judge[] }> = [
  {
    name: "中文技术查询 · 同义变体（安装 / 部署 / Installation）",
    query: "docker 安装",
    judged: [
      { relevant: true, result: mk("Docker 安装指南", "https://docs.docker.com/engine/install/", "官方 Installation Guide：在 Linux/macOS/Windows 上安装 Docker Engine 的完整步骤") },
      { relevant: true, variant: true, result: mk("Install Docker Engine", "https://docs.docker.com/engine/install/ubuntu/", "Follow the installation steps to set up Docker on Ubuntu") },
      { relevant: true, variant: true, result: mk("如何用脚本一键部署 Docker", "https://juejin.cn/post/7", "本文介绍通过脚本快速安装与初始化 Docker 环境") },
      { relevant: true, result: mk("Ubuntu 上安装 Docker 的完整步骤", "https://linuxize.com/post/how-to-install-and-use-docker-on-ubuntu/", "手把手演示 apt 源安装 docker 与验证安装结果") },
      { relevant: true, result: mk("Docker 安装教程（含镜像加速配置）", "https://www.ruanyifeng.com/blog/docker-install.html", "从零开始安装 docker，并配置国内镜像源加速拉取") },
      { relevant: false, result: mk("Docker 是什么？三分钟科普", "https://baike.example.com/docker", "Docker 是一个开源的应用容器引擎，让开发者可以打包应用") },
      { relevant: false, result: mk("Docker Hub 镜像仓库使用说明", "https://hub.example.com/docs", "介绍如何在 Docker Hub 上拉取与推送镜像仓库") },
      { relevant: false, result: mk("Kubernetes 集群运维手册", "https://k8s-ops.example.com/handbook", "Kubernetes 集群的日常运维、节点扩缩容与故障处理") },
      { relevant: false, result: mk("容器编排方案横向评测", "https://compare.example.com/orchestration", "对比 Kubernetes、Nomad 与 Docker Swarm 的调度能力") },
      { relevant: false, fake: true, result: mk("docker 安装 官方权威入口与全景参考", "https://www.bing.com/search?q=docker", "为您汇总相关官方主页与最新发布动态") }
    ]
  },
  {
    name: "英文技术查询 · 词形变化（install / installation / installing）",
    query: "install postgres on macos",
    judged: [
      { relevant: true, result: mk("Install PostgreSQL on macOS", "https://www.postgresql.org/download/macosx/", "Download and install PostgreSQL on macOS using the official installer or Homebrew.") },
      { relevant: true, variant: true, result: mk("PostgreSQL Installation Guide for Mac OS X", "https://wiki.postgresql.org/wiki/Installation", "A complete installation walkthrough for PostgreSQL running on macOS.") },
      { relevant: true, variant: true, result: mk("Installing and configuring PostgreSQL locally", "https://dev.to/postgres-local", "Step by step: installing PostgreSQL on a Mac, creating a role and starting the service.") },
      { relevant: true, result: mk("Install Postgres on macOS with Homebrew", "https://brew.sh/postgresql", "Installation instructions for PostgreSQL via the Homebrew package manager on macOS.") },
      { relevant: true, result: mk("How to install PostgreSQL on a Mac (2024 guide)", "https://www.postgresqltutorial.com/postgresql-getting-started/install-postgresql-macos/", "Complete installation tutorial covering the macOS installer, Homebrew, and Postgres.app.") },
      { relevant: false, result: mk("PostgreSQL vs MySQL: which should you pick?", "https://compare.example.com/pg-vs-mysql", "A broad comparison of two popular relational databases.") },
      { relevant: false, result: mk("macOS Sonoma 新特性汇总", "https://news.example.com/sonoma", "苹果最新系统带来的桌面小组件与视频会议特性") },
      { relevant: false, result: mk("PostgreSQL 性能调优参数详解", "https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server", "shared_buffers、work_mem 等参数对查询性能的影响") },
      { relevant: false, result: mk("SQL 入门：从零学会关系型数据库", "https://sql-tutorial.example.com/", "关系模型、表设计、JOIN 与索引的基础教程") }
    ]
  },
  {
    name: "缩写与全称（k8s ↔ Kubernetes）",
    query: "k8s 集群部署",
    judged: [
      { relevant: true, result: mk("Kubernetes 集群部署指南", "https://kubernetes.io/docs/setup/", "官方文档：使用 kubeadm 部署生产级 Kubernetes 集群") },
      { relevant: true, variant: true, result: mk("Production cluster setup with kubeadm", "https://kubernetes.io/docs/setup/production-environment/", "Creating a Kubernetes cluster with kubeadm, covering nodes and networking.") },
      { relevant: true, variant: true, result: mk("Deploying a cluster with kubeadm step by step", "https://www.digitalocean.com/community/tutorials/how-to-create-a-kubernetes-cluster", "A hands-on walkthrough of deploying a Kubernetes cluster and joining worker nodes.") },
      { relevant: true, result: mk("从零部署 K8s 集群（kubeadm 方式）", "https://juejin.cn/post/deploy-k8s-cluster", "详解初始化控制平面、安装 CNI 插件与加入工作节点的完整流程") },
      { relevant: true, result: mk("Kubernetes 集群部署踩坑记录", "https://www.cnblogs.com/k8s-cluster-notes/", "部署 k8s 集群时遇到的镜像拉取与网络插件问题及解决办法") },
      { relevant: false, result: mk("Kubernetes 认证 CKA 考试报名", "https://exam.example.com/cka", "CKA 考试费用、报名流程与考点说明") },
      { relevant: false, result: mk("容器与虚拟机的区别", "https://blog.example.com/container-vm", "从隔离机制看容器与虚拟机的本质差异") },
      { relevant: false, result: mk("Kubernetes 网络模型深入解析", "https://blog.example.com/k8s-network", "CNI、Service 与 Ingress 的网络转发原理") },
      { relevant: false, result: mk("K8s 日志采集方案选型", "https://ops.example.com/k8s-logging", "对比 Fluent Bit、Filebeat 与 Vector 的采集性能") }
    ]
  },
  {
    name: "权威站上的无关页 vs 真正相关的小站",
    query: "python 装饰器 原理",
    judged: [
      { relevant: true, result: mk("Python 装饰器原理详解", "https://realpython.com/primer-on-python-decorators/", "深入讲解 Python 装饰器的实现原理、闭包与 functools.wraps") },
      { relevant: true, variant: true, result: mk("Decorators — Python 官方语言参考", "https://docs.python.org/3/glossary.html#term-decorator", "The official definition and mechanics of Python decorators.") },
      { relevant: true, result: mk("Python 装饰器的工作原理与实现", "https://www.cnblogs.com/python-decorator-principle/", "通过字节码与闭包机制剖析装饰器到底做了什么") },
      { relevant: true, result: mk("理解 Python 装饰器：从函数到高阶函数", "https://juejin.cn/post/python-decorators-explained", "从高阶函数与闭包出发，推导装饰器的实现原理") },
      { relevant: true, result: mk("Python Decorators Explained", "https://dev.to/python-decorators-explained", "How decorators work under the hood: closures, wrapping and metadata.") },
      { relevant: false, result: mk("Torvalds 谈 Linux 内核调度器", "https://github.com/torvalds/linux/issues/9", "内核调度相关讨论串，与 Python 无关") },
      { relevant: false, result: mk("Python 3.13 下载", "https://www.python.org/downloads/", "Download the latest Python release for all platforms") },
      { relevant: false, result: mk("Python 依赖管理工具对比", "https://compare.example.com/py-deps", "pip、poetry 与 uv 的依赖解析速度与锁文件对比") },
      { relevant: false, result: mk("异步编程原理：从回调到协程", "https://blog.example.com/async-principle", "梳理事件循环、Promise 与 async/await 的演进") },
      { relevant: false, fake: true, result: mk("python 装饰器 原理 开发者生态索引", "https://github.com/search?q=decorator", "探索相关的开源实现与工程落地参考方案") }
    ]
  },
  {
    name: "伪信源：搜索结果页 / 站内搜索链接必须被剔除",
    query: "react 状态管理方案对比",
    judged: [
      { relevant: true, result: mk("React 状态管理方案对比：Redux / Zustand / Jotai", "https://react.dev/learn/managing-state", "官方文档对比不同状态管理方案与适用场景") },
      { relevant: true, variant: true, result: mk("Choosing a state management library in 2024", "https://dev.to/react-state-2024", "A practical comparison of Redux Toolkit, Zustand, Jotai and Context.") },
      { relevant: true, result: mk("Redux vs Zustand vs Jotai: a comparison", "https://redux.js.org/usage/state-management-comparison", "Comparing popular state management approaches with trade-offs and use cases.") },
      { relevant: true, result: mk("React 状态管理该选谁？四方案横向评测", "https://juejin.cn/post/react-state-compare", "从包体积、学习曲线与类型支持三个维度对比主流状态管理库") },
      { relevant: true, result: mk("Zustand 与 Jotai 的设计哲学差异", "https://www.infoq.cn/article/react-state-philosophy", "对比可变 store 与原子化状态两种模型的取舍") },
      { relevant: false, fake: true, result: mk("react 状态管理方案对比 官方权威入口与全景参考", "https://www.bing.com/search?q=react", "为您汇总关于该主题的官方主页与最新动态") },
      { relevant: false, fake: true, result: mk("react 状态管理方案对比 开发者生态索引", "https://github.com/search?q=react", "探索相关的开源实现与工程落地参考方案") },
      { relevant: false, result: mk("Vue 3 组合式 API 入门", "https://vuejs.org/guide/extras/composition-api-faq.html", "Vue 组合式 API 的设计动机与用法") },
      { relevant: false, result: mk("Redux 中间件原理", "https://blog.example.com/redux-middleware", "applyMiddleware 的洋葱模型与 compose 实现") },
      { relevant: false, result: mk("前端构建工具选型：Vite 还是 Webpack", "https://compare.example.com/bundler", "从冷启动与 HMR 速度对比两款构建工具") }
    ]
  },
  {
    name: "内容农场围剿官方（中文长尾）",
    query: "Nginx 反向代理配置",
    judged: [
      { relevant: true, result: mk("Nginx Reverse Proxy 配置指南", "https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/", "官方文档：配置 Nginx 作为反向代理的完整指令说明") },
      { relevant: true, variant: true, result: mk("用 Nginx 做反向代理的常见坑与最佳实践", "https://juejin.cn/post/nginx-proxy", "proxy_pass 斜杠、header 透传与超时配置的实战经验") },
      { relevant: true, result: mk("Nginx 反向代理配置详解", "https://www.cnblogs.com/nginx-reverse-proxy-config/", "upstream、proxy_set_header 与负载均衡策略的完整配置示例") },
      { relevant: true, result: mk("How to configure Nginx as a reverse proxy", "https://www.digitalocean.com/community/tutorials/how-to-configure-nginx-as-a-reverse-proxy", "Step-by-step guide to setting up Nginx as a reverse proxy server.") },
      { relevant: true, result: mk("Nginx proxy_pass 路径匹配规则解析", "https://segmentfault.com/a/nginx-proxy-pass", "讲清 proxy_pass 带与不带结尾斜杠时 URI 的不同拼接行为") },
      { relevant: false, result: mk("Nginx 配置大全（免费下载）", "https://wenku.baidu.com/view/nginx", "免费下载 Nginx 配置大全文档，注册即可查看完整版") },
      { relevant: false, result: mk("Nginx 培训课程 限时优惠", "https://train.example.com/nginx", "限时抢购 Nginx 实战课程，加微信咨询最低价") },
      { relevant: false, result: mk("Apache 反向代理配置", "https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html", "Apache HTTP Server 的反向代理配置说明") },
      { relevant: false, result: mk("Nginx 负载均衡算法对比", "https://blog.example.com/nginx-lb", "轮询、加权与一致性哈希的适用场景分析") },
      { relevant: false, result: mk("从 Nginx 迁移到 Caddy 的体验", "https://blog.example.com/nginx-to-caddy", "自动 HTTPS 与配置简洁度方面的对比") }
    ]
  },
  {
    name: "多条件组合：技术 + 版本限定",
    query: "react 18 useEffect 执行两次",
    judged: [
      { relevant: true, result: mk("Why does useEffect run twice in React 18?", "https://react.dev/reference/react/useEffect#my-effect-runs-twice", "React 18 StrictMode intentionally double-invokes effects in development to surface bugs.") },
      { relevant: true, variant: true, result: mk("React 18 严格模式下副作用重复执行的原因与处理", "https://juejin.cn/post/react18-strictmode", "分析 useEffect 在 React 18 开发环境执行两次的机制与正确写法") },
      { relevant: true, result: mk("useEffect 为什么执行两次？StrictMode 双调用详解", "https://www.cnblogs.com/useeffect-twice/", "解释 React 18 StrictMode 下 effect 卸载重挂导致执行两次的原理") },
      { relevant: true, result: mk("React 18 useEffect double invocation explained", "https://dev.to/react18-useeffect-double", "Why React 18 runs effects twice in development and how to handle it correctly.") },
      { relevant: true, result: mk("解决 React 18 下 useEffect 重复请求接口", "https://segmentfault.com/a/react18-useeffect-twice", "用 AbortController 与依赖数组修正开发环境重复请求的问题") },
      { relevant: false, result: mk("React 19 新特性一览", "https://react.dev/blog/react-19", "React 19 引入 Actions、use() 等新 API") },
      { relevant: false, result: mk("useEffect 完全指南", "https://blog.example.com/useeffect", "从生命周期角度理解 useEffect 的依赖数组") },
      { relevant: false, result: mk("React 18 并发渲染原理", "https://blog.example.com/react18-concurrent", "Fiber 架构与时间切片如何实现可中断渲染") },
      { relevant: false, result: mk("useState 与 useReducer 的取舍", "https://blog.example.com/usestate-usereducer", "复杂状态应如何选择管理方式") },
      { relevant: false, result: mk("Vue 的 watch 与 watchEffect 差异", "https://vuejs.org/api/reactivity-core.html", "Vue 响应式 API 中两种侦听方式的执行时机") }
    ]
  },
  {
    name: "跨语言：中文查询应召回英文权威源",
    query: "什么是事件循环",
    judged: [
      { relevant: true, result: mk("事件循环（Event Loop）是什么", "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Event_loop", "MDN 中文文档：解释 JavaScript 事件循环的运行时模型与任务队列") },
      { relevant: true, variant: true, result: mk("The event loop — MDN Web Docs", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop", "The event loop concept, task queues and how JavaScript handles concurrency.") },
      { relevant: true, result: mk("JavaScript 事件循环机制详解", "https://www.cnblogs.com/js-event-loop/", "从宏任务与微任务的角度讲清事件循环的执行顺序") },
      { relevant: true, result: mk("搞懂事件循环：从 setTimeout 到微任务", "https://juejin.cn/post/event-loop-guide", "用大量示例演示事件循环如何调度回调") },
      { relevant: true, result: mk("What is the event loop?", "https://dev.to/what-is-the-event-loop", "A beginner-friendly explanation of the JavaScript event loop and its phases.") },
      { relevant: false, result: mk("Node.js 事件循环与性能调优", "https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick", "Node.js 事件循环各阶段与 setImmediate 的使用时机") },
      { relevant: false, result: mk("今天股市行情分析", "https://finance.example.com/today", "大盘走势与板块轮动分析") },
      { relevant: false, result: mk("CSS 动画性能优化", "https://blog.example.com/css-animation", "使用 transform 与 will-change 避免重排") },
      { relevant: false, result: mk("Promise 链式调用的错误处理", "https://blog.example.com/promise-catch", "catch 与 finally 在链式调用中的执行位置") }
    ]
  }
];

/* ============================================================
   指标计算
   ============================================================ */
const NDCG_K = 5;
const precisionAt = (rels: boolean[], k: number) => {
  const top = rels.slice(0, k);
  return top.length ? top.filter(Boolean).length / k : 0;
};
const ndcgAt = (rels: boolean[], k: number) => {
  const dcg = rels.slice(0, k).reduce((s, r, i) => s + (r ? 1 / Math.log2(i + 2) : 0), 0);
  const ideal = [...rels].sort((a, b) => Number(b) - Number(a)).slice(0, k)
    .reduce((s, r, i) => s + (r ? 1 / Math.log2(i + 2) : 0), 0);
  return ideal > 0 ? dcg / ideal : 1;
};

interface CaseMetric {
  name: string;
  p1: number; p3: number; p5: number; ndcg: number;
  bad5: number; syn: number; synTotal: number; fakeInTop: number;
}

const metrics: CaseMetric[] = [];

console.log(`\n${"=".repeat(100)}`);
console.log("搜索精准度基准");
console.log("=".repeat(100));

for (const c of CASES) {
  const byUrl = new Map(c.judged.map((j) => [j.result.url, j]));
  const pools: CandidatePool[] = [{ source: "main", results: c.judged.map((j) => j.result) }];

  const { results } = rankSearchPools(pools, { query: c.query, limit: 10, maxPerDomain: 3 });

  const rels = results.map((r) => byUrl.get(r.url)?.relevant === true);
  const top5 = results.slice(0, 5);
  const variantTotal = c.judged.filter((j) => j.variant && j.relevant).length;
  const variantHit = top5.filter((r) => byUrl.get(r.url)?.variant).length;
  const fakeInTop = top5.filter((r) => byUrl.get(r.url)?.fake).length;

  const m: CaseMetric = {
    name: c.name,
    p1: precisionAt(rels, 1),
    p3: precisionAt(rels, 3),
    p5: precisionAt(rels, 5),
    ndcg: ndcgAt(rels, NDCG_K),
    bad5: top5.filter((r) => !byUrl.get(r.url)?.relevant).length,
    syn: variantHit,
    synTotal: variantTotal,
    fakeInTop
  };
  metrics.push(m);

  console.log(`\n▌ ${c.name}`);
  console.log(`  query: "${c.query}"`);
  results.slice(0, 5).forEach((r, i) => {
    const j = byUrl.get(r.url);
    const tag = j?.fake ? "伪信源" : j?.relevant ? (j.variant ? "相关·变体" : "相关") : "无关";
    console.log(`   ${i + 1}. [${String(r.relevanceScore).padStart(5)}] ${tag.padEnd(9)} ${r.title.slice(0, 46)}`);
  });
  console.log(
    `  → P@1=${m.p1.toFixed(2)} P@3=${m.p3.toFixed(2)} P@5=${m.p5.toFixed(2)}` +
      ` NDCG@5=${m.ndcg.toFixed(3)} Bad@5=${m.bad5} 变体命中=${m.syn}/${m.synTotal} 伪信源进Top5=${m.fakeInTop}`
  );
}

/* ============================================================
   汇总
   ============================================================ */
const avg = (f: (m: CaseMetric) => number) => metrics.reduce((s, m) => s + f(m), 0) / metrics.length;
const summary = {
  p1: avg((m) => m.p1),
  p3: avg((m) => m.p3),
  p5: avg((m) => m.p5),
  ndcg: avg((m) => m.ndcg),
  bad5: metrics.reduce((s, m) => s + m.bad5, 0),
  fake: metrics.reduce((s, m) => s + m.fakeInTop, 0),
  synHit: metrics.reduce((s, m) => s + m.syn, 0),
  synTotal: metrics.reduce((s, m) => s + m.synTotal, 0)
};

console.log(`\n${"=".repeat(100)}`);
console.log("汇总（所有用例平均）");
console.log("=".repeat(100));
console.log(`  P@1 ................ ${summary.p1.toFixed(3)}`);
console.log(`  P@3 ................ ${summary.p3.toFixed(3)}`);
console.log(`  P@5 ................ ${summary.p5.toFixed(3)}`);
console.log(`  NDCG@5 ............. ${summary.ndcg.toFixed(3)}`);
console.log(`  无关条目进 Top5 .... ${summary.bad5} 条（越低越好）`);
console.log(`  伪信源进 Top5 ...... ${summary.fake} 条（必须为 0）`);
console.log(`  同义/词形变体命中 .. ${summary.synHit}/${summary.synTotal}（越高越好）`);

/* ============================================================
   验收阈值（可验证标准）
   ============================================================ */
let failed = 0;
const assert = (name: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
};

console.log(`\n${"=".repeat(100)}`);
console.log("验收标准");
console.log("=".repeat(100));
assert("P@1 ≥ 0.75（首条必须准）", summary.p1 >= 0.75, summary.p1.toFixed(3));
assert("P@3 ≥ 0.65", summary.p3 >= 0.65, summary.p3.toFixed(3));
assert("P@5 ≥ 0.60", summary.p5 >= 0.6, summary.p5.toFixed(3));
assert("NDCG@5 ≥ 0.75", summary.ndcg >= 0.75, summary.ndcg.toFixed(3));
assert("伪信源绝不进入 Top5", summary.fake === 0, `${summary.fake} 条`);
assert("无关条目进 Top5 ≤ 3 条（共 8 用例 × 5 位 = 40 位）", summary.bad5 <= 3, `${summary.bad5} 条`);
assert(
  "同义/词形变体召回率 ≥ 0.6",
  summary.synTotal === 0 || summary.synHit / summary.synTotal >= 0.6,
  `${summary.synHit}/${summary.synTotal}`
);

console.log(`\n搜索精准度基准: ${failed === 0 ? "PASSED" : `FAILED (${failed} 项未达标)`}\n`);
process.exit(failed === 0 ? 0 : 1);
