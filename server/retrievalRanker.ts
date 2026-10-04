/**
 * Retrieval Relevance Ranker —— 检索相关性重排内核
 * ============================================================
 * 存在的意义：搜索引擎只负责「把可能相关的网页扔过来」，它并不知道
 * 用户这次到底想要什么。历史上这里只有一个 `domain.includes(query)`
 * 级别的粗糙过滤，导致真正权威的条目被内容农场挤掉。
 *
 * 本模块是一个纯函数内核（零 I/O、零副作用、结果可复现），负责把
 * 「多路检索回来的原始候选池」重排成「高相关性、高权威、去重、多样」的信源集。
 *
 * 打分维度（合计 100 分制，可正可负）：
 *   1. 标题词项加权覆盖度      —— 最强信号
 *   2. 摘要词项加权覆盖度
 *   3. 核心实体短语命中
 *   4. 域名权威先验（官方文档 / 规范仓库 / 学术 / 社区 / 内容农场）
 *   5. 多路共识（同一条 URL 被多个子查询或多个引擎同时命中）
 *   6. 时效性
 *   7. 垃圾与低质惩罚
 *
 * 之后再做三件事：URL 归一化去重 → 内容级（标题）相似度去重 → 域名配额与多样性保底。
 */

import { SearchFilters, SearchResult, SearchSourceType } from "../src/types.js";
import { OFFICIAL_DOMAIN_PATTERNS } from "./officialDomains.js";
import { isAdOrSpamResult } from "./searchFilters.js";

// ============================================================
// 1. 查询画像：把自然语言查询拆成「核心实体 + 意图修饰词」
// ============================================================

/** 意图修饰词：它们描述"想要什么"，而不是"关于什么"，打分时不应作为实体词项 */
const INTENT_MODIFIER_PATTERNS = [
  /(官网|官方网站|主页|网址|网站|入口|登录|平台|下载|文档|教程|指南|攻略|对比|比较|区别|差异|优缺点|优劣|哪个好|推荐|排行|评测|原理|架构|实现|最佳实践|避坑|排查|报错|修复|是什么|什么是|什么叫|啥是|为什么|为啥|为何|怎么样|如何|怎么|怎样|概念|入门|简介)/g,
  /\b(official|website|site|homepage|portal|login|signin|download|docs|documentation|tutorial|guide|howto|how to|compare|comparison|versus|vs|difference|differences|pros|cons|best|top|review|benchmark|architecture|internals|implementation|principle|principles|overview|introduction|intro|what is|how to|why|concept)\b/g,
  /(公式サイト|公式|ホームページ|ポータル|ダウンロード|ドキュメント|チュートリアル|比較|違い|メリット|デメリット|おすすめ|仕組み|原理|使い方)/g
];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "at", "is", "are", "was", "were",
  "be", "been", "with", "by", "from", "as", "that", "this", "these", "those", "it", "its", "into",
  "about", "how", "what", "why", "when", "where", "which", "who", "can", "could", "should", "would",
  "do", "does", "did", "my", "your", "our", "their", "his", "her", "not", "no", "yes", "you", "me",
  "的", "了", "是", "在", "和", "与", "或", "及", "对", "为", "把", "被", "让", "给", "从", "到",
  "我", "你", "他", "她", "它", "这", "那", "哪", "什", "么", "怎", "样", "如", "何", "一", "个",
  "什么", "怎么", "如何", "怎样", "为何", "为啥", "哪个", "哪里", "为什么", "是啥", "啥是"
]);

const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g;
const LATIN_TOKEN = /[a-z0-9][a-z0-9+#._-]*/g;

export interface QueryProfile {
  /** 原始查询（去首尾空白） */
  raw: string;
  /** 去掉意图修饰词后的核心实体短语，用于短语命中加权 */
  entityPhrase: string;
  /** 全部查询词项（已去停用词）—— 保留原始字面形式，用于展示与解释 */
  terms: string[];
  /**
   * 词项权重，**按规范词项（canonical）索引**。
   * 基础权重取词长（越具体越重），实际打分时再乘以 IDF（见 rankAndFilterResults）——
   * 仅靠词长会让"react"这种全网都在说的词与真正的关键词地位相当。
   */
  weights: Record<string, number>;
  /** 规范词项集合，打分时与文档的规范词项集合求交 */
  canonicalTerms: string[];
  /** 规范形 -> 用户原词，用于把匹配结果还原成用户看得懂的说法 */
  rawTermsByCanonical: Record<string, string[]>;
  /** 查询是否以拉丁字符为主（用于语言先验） */
  isLatin: boolean;
  /** 命中的短语规范形及其关联词项（用于跨语言短语覆盖度传导） */
  phraseCanonicalMap?: Map<string, Set<string>>;
}

/** 切词：拉丁按词，CJK 走「整串 + 二元组」，二元组是中文检索的事实标准 */
function splitTerms(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];

  for (const latin of lower.match(LATIN_TOKEN) || []) {
    if (latin.length < 2) continue;
    if (STOPWORDS.has(latin)) continue;
    out.push(latin);
  }

  for (const run of lower.match(CJK_RUN) || []) {
    if (run.length === 1) {
      if (!STOPWORDS.has(run)) out.push(run);
      continue;
    }
    // 短实体串整体保留（如「状态管理」「量子纠缠」），长串只保留二元组避免噪声
    if (run.length <= 6) out.push(run);
    for (let i = 0; i + 2 <= run.length; i++) {
      const bigram = run.slice(i, i + 2);
      if (STOPWORDS.has(bigram)) continue;
      if (STOPWORDS.has(bigram[0]) && STOPWORDS.has(bigram[1])) continue;
      out.push(bigram);
    }
  }

  return Array.from(new Set(out));
}

// ============================================================
// 1b. 词项归并：同义词 + 词形变化
// ============================================================

/**
 * 同义词归并组：把业界通行的等价写法收敛到同一词项。
 *
 * 为什么必须做：`splitTerms` 产出的是字面词项，于是「k8s 集群部署」永远匹配不上
 * 标题写着 "Kubernetes Cluster Setup" 的官方文档 —— 而那恰恰是最该被找到的一条。
 * 这类漏召回是"结果不精准"里最隐蔽的一类：用户看到的结果都不算错，但真正权威的
 * 那条根本没进来。
 *
 * 收敛方向统一取「更正式、更长」的那个写法（k8s → kubernetes）。
 */
const SYNONYM_GROUPS: string[][] = [
  ["k8s", "kubernetes"],
  ["js", "javascript"],
  ["ts", "typescript"],
  ["py", "python"],
  ["node", "nodejs"],
  ["react", "reactjs"],
  ["vue", "vuejs"],
  ["next", "nextjs"],
  ["nuxt", "nuxtjs"],
  ["postgres", "postgresql"],
  ["mongo", "mongodb"],
  ["es", "elasticsearch"],
  ["ml", "machinelearning"],
  ["llm", "largelanguagemodel"],
  ["npm", "nodepackagemanager"],
  ["golang", "go"],
  ["doc", "document", "documentation"],
  ["config", "configuration", "configure"],
  ["install", "installation", "installing", "installed", "installer"],
  ["deploy", "deployment", "deploying", "deployed"],
  ["migrate", "migration", "migrating"],
  ["optimize", "optimization", "optimizing"],
  ["troubleshoot", "troubleshooting"],
  ["setup", "setting"],
  ["error", "errors", "exception", "exceptions"],
  ["proxy", "proxying", "proxies"],
  ["cache", "caching"],
  ["authenticate", "authentication", "auth"],
  ["authorize", "authorization", "authz"],
  ["performance", "perf"],
  ["environment", "env"],
  ["repository", "repo"],
  ["application", "app"],
  ["directory", "dir", "folder"],
  ["两次", "重复", "双次", "twice", "double"]
];

/**
 * 跨语言技术术语映射。
 *
 * 为什么必须单独一组：中文用户查「k8s 集群部署」，最权威的答案往往是英文官方文档
 * （kubernetes.io/docs/setup/），标题写作 "Production cluster setup with kubeadm"。
 * 中文查询词与英文文档之间**没有任何字面重叠**，纯词项匹配下它会被判为"零命中"而
 * 直接淘汰 —— 这是"结果不精准"里最伤的一类漏召回：不是排错，是搜不到。
 *
 * 只收录「单词语义一一对应、且业界无歧义」的技术术语，避免过度泛化引入误召回。
 */
const CROSS_LINGUAL_GROUPS: string[][] = [
  ["install", "installation", "安装"],
  ["deploy", "deployment", "部署"],
  ["config", "configuration", "configure", "配置"],
  ["cluster", "clusters", "集群"],
  ["cache", "caching", "缓存"],
  ["proxy", "proxying", "代理"],
  ["decorator", "decorators", "装饰器"],
  ["performance", "perf", "性能"],
  ["environment", "env", "环境"],
  ["repository", "repo", "仓库"],
  ["application", "app", "应用"],
  ["directory", "dir", "folder", "目录"],
  ["document", "documentation", "docs", "文档"],
  ["tutorial", "tutorials", "教程"],
  ["principle", "principles", "原理"],
  ["comparison", "compare", "versus", "对比", "比较"],
  ["error", "errors", "exception", "报错", "异常"],
  ["authenticate", "authentication", "auth", "认证"],
  ["authorize", "authorization", "authz", "授权"],
  ["migrate", "migration", "迁移"],
  ["optimize", "optimization", "优化"],
  ["troubleshoot", "troubleshooting", "排查"],
  ["version", "versions", "版本"],
  ["security", "secure", "安全"],
  ["architecture", "架构"],
  ["workflow", "工作流"],
  ["template", "模板"],
  ["plugin", "plugins", "插件"],
  ["kernel", "内核"],
  ["compiler", "编译器"]
];

/** canonical 形式 -> 该词原始写法集合（用于把匹配结果还原成用户能看懂的原词） */
const CANONICAL_ALIASES = new Map<string, string[]>();
for (const group of [...SYNONYM_GROUPS, ...CROSS_LINGUAL_GROUPS]) {
  // 取组内最长者作为规范形，语义上更完整（kubernetes 优于 k8s；installation 优于 install）
  const canonical = group.reduce((best, cur) => (cur.length > best.length ? cur : best), group[0]);
  for (const alias of group) {
    if (!CANONICAL_ALIASES.has(canonical)) CANONICAL_ALIASES.set(canonical, []);
    if (!CANONICAL_ALIASES.get(canonical)!.includes(alias)) CANONICAL_ALIASES.get(canonical)!.push(alias);
  }
}
const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of CANONICAL_ALIASES) {
  for (const alias of aliases) ALIAS_TO_CANONICAL.set(alias, canonical);
}

/** 轻量英文词形还原：剥离常见后缀，让 install / installation / installing 收敛 */
const LATIN_SUFFIXES = [
  "izations", "ization", "isations", "isation", "ations", "ation",
  "ings", "ing", "ies", "ied", "ers", "er", "ed", "es", "s", "ments", "ment", "tions", "tion"
];

function stemLatinToken(word: string): string {
  if (word.length <= 4) return word; // 短词不动，避免 over-stemming（go / es / api）
  for (const suffix of LATIN_SUFFIXES) {
    const stem = word.slice(0, word.length - suffix.length);
    if (word.endsWith(suffix) && stem.length >= 3) return stem;
  }
  return word;
}

/**
 * 把单个词项归并到规范形。
 * 顺序很重要：先查同义词表（能处理不规则变化，如 k8s → kubernetes），
 * 再退回词形还原（能处理未穷举的规则变化）。
 */
export function canonicalizeTerm(term: string): string {
  const direct = ALIAS_TO_CANONICAL.get(term);
  if (direct) return direct;
  const stemmed = stemLatinToken(term);
  return ALIAS_TO_CANONICAL.get(stemmed) || stemmed;
}

/** 把一段文本归并为规范词项集合 */
export function canonicalTermSet(text: string): Set<string> {
  const out = new Set(splitTerms(text).map(canonicalizeTerm));
  // 追加短语级桥接词项（见 PHRASE_CANONICALS）
  for (const canonical of matchPhraseCanonicals(text)) out.add(canonical);
  return out;
}

/**
 * 短语级跨语言桥接表。
 *
 * 单词语义映射（CROSS_LINGUAL_GROUPS）解决不了「一个中文词 = 两个英文词」的情形：
 *   · 状态管理 ≠ "state" + "management"（两边永远碰不到一起）
 *   · 事件循环 ≠ "event" + "loop"
 * 于是中文查询「什么是事件循环」召回了英文权威文档 "The event loop"，重排时却因为
 * 零字面重叠被判为不相关而丢弃。
 *
 * 做法：把中英两种写法同时映射到一个不含空格的规范 token（eventloop）。
 * 注意是**追加**而非替换 —— 原有的中文二元组仍然保留，因此不会损伤中文文档的召回。
 */
interface PhraseCanonical {
  canonical: string;
  forms: string[];
}

const PHRASE_CANONICALS: PhraseCanonical[] = [
  { canonical: "statemanagement", forms: ["状态管理", "数据管理", "state management", "state-management"] },
  { canonical: "eventloop", forms: ["事件循环", "event loop", "eventloop"] },
  { canonical: "reverseproxy", forms: ["反向代理", "reverse proxy", "reverseproxy", "proxy_pass", "proxypass", "proxy pass"] },
  { canonical: "bestpractice", forms: ["最佳实践", "best practice", "best practices"] },
  { canonical: "dependencyinjection", forms: ["依赖注入", "dependency injection"] },
  { canonical: "unittest", forms: ["单元测试", "unit test", "unit tests"] },
  { canonical: "integrationtest", forms: ["集成测试", "integration test"] },
  { canonical: "continuousintegration", forms: ["持续集成", "continuous integration"] },
  { canonical: "continuousdelivery", forms: ["持续交付", "持续部署", "continuous delivery", "continuous deployment"] },
  { canonical: "designpattern", forms: ["设计模式", "design pattern", "design patterns"] },
  { canonical: "datastructure", forms: ["数据结构", "data structure", "data structures"] },
  { canonical: "machinelearning", forms: ["机器学习", "machine learning"] },
  { canonical: "deeplearning", forms: ["深度学习", "deep learning"] },
  { canonical: "neuralnetwork", forms: ["神经网络", "neural network"] },
  { canonical: "operatingsystem", forms: ["操作系统", "operating system"] },
  { canonical: "garbagecollection", forms: ["垃圾回收", "垃圾回收器", "garbage collection"] },
  { canonical: "loadbalancing", forms: ["负载均衡", "load balancing", "load balancer"] },
  { canonical: "containerorchestration", forms: ["容器编排", "container orchestration"] },
  { canonical: "messagequeue", forms: ["消息队列", "message queue"] },
  { canonical: "sourcecode", forms: ["源代码", "source code"] },
  { canonical: "typesystem", forms: ["类型系统", "type system"] },
  { canonical: "api", forms: ["接口", "api"] },
  { canonical: "vulnerability", forms: ["漏洞", "vulnerability", "cve"] },
  { canonical: "migration", forms: ["迁移", "数据迁移", "migration"] },
  { canonical: "serialization", forms: ["序列化", "serialization"] },
  { canonical: "concurrency", forms: ["并发", "concurrency", "concurrent"] },
  { canonical: "microservice", forms: ["微服务", "microservice", "microservices"] }
];

/** 返回文本中命中的短语规范形（中英两种写法都会命中同一个 canonical） */
export function matchPhraseCanonicals(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const entry of PHRASE_CANONICALS) {
    if (entry.forms.some((form) => lower.includes(form))) out.push(entry.canonical);
  }
  return out;
}

/** 返回文本中命中的短语规范形及其全部等价写法（用于跨语言短语命中） */
export function matchPhraseCanonicalForms(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const forms: string[] = [];
  for (const entry of PHRASE_CANONICALS) {
    if (entry.forms.some((form) => lower.includes(form))) {
      forms.push(...entry.forms);
    }
  }
  return Array.from(new Set(forms));
}

/** 规范形 -> 用户原词，用于向用户解释"命中了哪些词" */
export function rawFormsOf(canonical: string, profile: QueryProfile): string[] {
  return (profile.rawTermsByCanonical[canonical] || [canonical]).filter(Boolean);
}

/**
 * 构建查询画像：区分「实体词」与「意图修饰词」。
 * 例：「React 状态管理的优缺点对比」→ entityPhrase = "react 状态管理"
 */

export function buildQueryProfile(query: string): QueryProfile {
  const raw = (query || "").trim();
  let entityPhrase = raw;
  for (const pattern of INTENT_MODIFIER_PATTERNS) {
    entityPhrase = entityPhrase.replace(pattern, " ");
  }
  // 剥掉清理后残留的首尾虚词（"React 状态管理的" -> "React 状态管理"）
  entityPhrase = entityPhrase
    .replace(/\s+/g, " ")
    .replace(/^[\s的了吗呢和与及是在对为把被让给从到中上下里什么啥为何怎如何]+/, "")
    .replace(/[\s的了吗呢和与及是在对为把被让给从到中上下里什么啥为何怎如何]+$/, "")
    .trim();

  // 实体短语被削光时（例如查询本身就是「官网」），退回原查询，避免短语命中失效
  if (entityPhrase.replace(/[^\w\u3400-\u9fff]/g, "").length < 2) {
    entityPhrase = raw;
  }

  const terms = splitTerms(raw);
  const weights: Record<string, number> = {};
  const rawTermsByCanonical: Record<string, string[]> = {};

  for (const term of terms) {
    const key = canonicalizeTerm(term);
    // 越长的词项越具体：拉丁词按长度，CJK 二元组按 2 计
    const baseWeight = Math.min(term.length, 8);
    // 同一规范形可能由多个原词折入（install / installing），取最强的那次，避免重复累加
    weights[key] = Math.max(weights[key] || 0, baseWeight);
    (rawTermsByCanonical[key] ||= []).push(term);
  }

  // 短语级桥接词项：它们是查询的核心语义单元，给一个偏高的基础权重，
  // 否则会被一堆二元组的权重稀释掉（见 PHRASE_CANONICALS 的说明）。
  const phraseCanonicalMap = new Map<string, Set<string>>();
  for (const canonical of matchPhraseCanonicals(raw)) {
    weights[canonical] = Math.max(weights[canonical] || 0, 6);
    (rawTermsByCanonical[canonical] ||= []).push(canonical);

    const entry = PHRASE_CANONICALS.find((e) => e.canonical === canonical);
    if (entry) {
      const associated = new Set<string>();
      associated.add(canonical);
      for (const form of entry.forms) {
        for (const t of splitTerms(form)) {
          associated.add(canonicalizeTerm(t));
        }
      }
      phraseCanonicalMap.set(canonical, associated);
    }
  }

  const latinChars = (raw.match(/[a-z0-9]/gi) || []).length;
  const cjkChars = (raw.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;

  return {
    raw,
    entityPhrase,
    terms,
    weights,
    canonicalTerms: Object.keys(weights),
    rawTermsByCanonical,
    isLatin: latinChars >= cjkChars,
    phraseCanonicalMap
  };
}

// ============================================================
// 2. 域名权威先验
// ============================================================

/** 官方文档 / 规范仓库 / 学术 —— 最高信任（统一自 officialDomains.ts） */
const TIER1_DOMAINS: RegExp[] = OFFICIAL_DOMAIN_PATTERNS;

/** 高质量技术社区 / 权威媒体 */
const TIER2_DOMAINS: RegExp[] = [
  /(^|\.)stackoverflow\.com$/,
  /(^|\.)stackexchange\.com$/,
  /(^|\.)serverfault\.com$/,
  /(^|\.)superuser\.com$/,
  /(^|\.)zhihu\.com$/,
  /(^|\.)juejin\.cn$/,
  /(^|\.)infoq\.cn$/,
  /(^|\.)infoq\.com$/,
  /(^|\.)segmentfault\.com$/,
  /(^|\.)cnblogs\.com$/,
  /(^|\.)medium\.com$/,
  /(^|\.)dev\.to$/,
  /(^|\.)hashnode\.(dev|com)$/,
  /(^|\.)digitalocean\.com$/,
  /(^|\.)cloudflare\.com$/,
  /(^|\.)aws\.amazon\.com$/,
  /(^|\.)techcrunch\.com$/,
  /(^|\.)theverge\.com$/,
  /(^|\.)arstechnica\.com$/,
  /(^|\.)36kr\.com$/,
  /(^|\.)sspai\.com$/,
  /(^|\.)ruanyifeng\.com$/,
  /(^|\.)wikipedia\.org$/,
  /(^|\.)baike\.baidu\.com$/
];

/**
 * 学术源（论文 / 预印本 / 顶级期刊）。
 * 单独一张表而不是塞进 TIER1：TIER1 的语义是"权威"，而学术源的**用途**不同 ——
 * 用户筛选"只看学术源"时期望的是可引用的研究文献，不是政府公告或产品文档。
 */
const ACADEMIC_DOMAINS: RegExp[] = [
  /(^|\.)arxiv\.org$/,
  /(^|\.)acm\.org$/,
  /(^|\.)ieee\.org$/,
  /(^|\.)nature\.com$/,
  /(^|\.)science\.org$/,
  /(^|\.)springer\.com$/,
  /(^|\.)sciencedirect\.com$/,
  /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/,
  /(^|\.)nih\.gov$/
];

/** 媒体 / 资讯源 */
const MEDIA_DOMAINS: RegExp[] = [
  /(^|\.)techcrunch\.com$/,
  /(^|\.)theverge\.com$/,
  /(^|\.)arstechnica\.com$/,
  /(^|\.)36kr\.com$/,
  /(^|\.)infoq\.(cn|com)$/,
  /(^|\.)sspai\.com$/
];

/** 内容农场 / 文库聚合 / SEO 站群 —— 降权并限制配额 */
const LOW_QUALITY_DOMAINS: RegExp[] = [
  /(^|\.)wenku\.baidu\.com$/,
  /(^|\.)docin\.com$/,
  /(^|\.)doc88\.com$/,
  /(^|\.)book118\.com$/,
  /(^|\.)renrendoc\.com$/,
  /(^|\.)taodocs\.com$/,
  /(^|\.)doc\.com$/,
  /(^|\.)so\.csdn\.net$/,
  /(^|\.)download\.csdn\.net$/,
  /(^|\.)51cto\.com$/,
  /(^|\.)oschina\.net$/,
  /(^|\.)iteye\.com$/,
  /(^|\.)jb51\.net$/,
  /(^|\.)php\.cn$/,
  /(^|\.)biancheng\.net$/,
  /(^|\.)zhiyun\.(top|xyz|club)$/,
  /(^|\.)blogspot\.com$/,
  /(^|\.)wordpress\.com$/
];

/** 营销 / 导流 / 抓取站特征 */
const SPAM_URL_PATTERNS = /(coupon|discount|promo|crack|keygen|serial|free-download|download-free|torrent|\/tag\/|\/category\/|\/page\/\d+)/i;
const SPAM_TITLE_PATTERNS = /(免费下载|破解|注册码|优惠券|最低价|限时抢购|加微信|点击咨询|代做|包过)/;

/**
 * 「搜索结果页」识别 —— 这类 URL 是查询入口，不是内容页，永远不可能是好信源。
 *
 * 为什么必须硬剔除（不看分数）：它在打分上极具欺骗性。
 *   · `github.com/search?q=x` 与 `bing.com/search?q=x` 的域名都落在 Tier1 权威表内（+18）；
 *   · 标题又常由上游拼装、天然含有查询词。
 * 两者叠加能轻松挤进前排 —— 实测它曾把真正的官方文档挤出 Top1（P@1 掉到 0）。
 * 这类条目不是"相关度偏低"，而是**根本不是内容**，因此直接出局，不参与排序。
 */
export function isSearchEndpoint(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = u.pathname.toLowerCase();

    // 根路径或主页文件且无显式搜索参数时，是官网首页入口，绝非搜索结果页
    const isRoot = pathname === "" || pathname === "/" || pathname === "/index.html" || pathname === "/index.htm";
    const hasSearchParam =
      u.searchParams.has("q") ||
      u.searchParams.has("query") ||
      u.searchParams.has("wd") ||
      u.searchParams.has("keyword") ||
      u.searchParams.has("p") ||
      u.searchParams.has("w");

    // 知名搜索引擎
    const isSearchEngineDomain =
      /^(google|bing|baidu|duckduckgo|yahoo|yandex|sogou|ecosia|brave|startpage|qwant|searx)\.[a-z.]+$/.test(host) ||
      /\.(google|bing|baidu)\.[a-z.]+$/.test(host);

    if (isSearchEngineDomain) {
      if (
        pathname.startsWith("/search") ||
        pathname.startsWith("/url") ||
        pathname === "/s" ||
        pathname.startsWith("/s/") ||
        pathname.startsWith("/html") ||
        (pathname.startsWith("/web") && hasSearchParam) ||
        hasSearchParam
      ) {
        return true;
      }
      return false;
    }

    // 通用搜索结果页端点 /search?q=..., /find?keyword=...
    if (/(search|find|query)\/?(\?|$)/i.test(pathname) && hasSearchParam) {
      return true;
    }

    if (/\?(q|query|wd|keyword|search)=/i.test(u.search)) {
      return true;
    }

    if (host === "github.com" && /^\/(search|topics)(\/|$)/i.test(pathname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function anyMatch(host: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(host));
}

/** 域名权威先验分值：Tier1 官方/学术 +18，Tier2 社区 +8，内容农场 -22 */
export function authorityPrior(host: string): number {
  if (!host) return -6;
  if (anyMatch(host, TIER1_DOMAINS)) return 18;
  if (anyMatch(host, TIER2_DOMAINS)) return 8;
  if (anyMatch(host, LOW_QUALITY_DOMAINS)) return -22;
  // 泛顶级域名的默认信任度：org 略高于 com，信息量很弱但聊胜于无
  if (/\.org$/.test(host)) return 3;
  if (/\.(cn|com\.cn)$/.test(host)) return 0;
  return 1;
}

/** 官方文档站常见的子域名前缀 */
const DOC_SUBDOMAIN = /^(docs|documentation|developer|developers|api|learn|guide|manual|wiki|support|help|reference)\./;
/** 官方文档站常见的路径段 */
const DOC_PATH = /\/docs?\/|\/documentation\/|\/guide\/|\/manual\/|\/reference\/|\/handbook\//i;

/** 常见的非主体域名后缀（顶级域与二级国别后缀） */
const COMMON_TLD_PARTS = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int", "io", "dev", "app", "ai", "co",
  "cn", "com.cn", "org.cn", "net.cn", "gov.cn", "edu.cn", "ac.cn",
  "uk", "co.uk", "org.uk", "ac.uk",
  "jp", "co.jp", "ne.jp", "ac.jp",
  "de", "fr", "ru", "ca", "au", "com.au", "in", "me", "cc", "tv", "xyz", "top", "site", "online", "tech", "info"
]);

/** 从域名提取主要品牌标（eTLD+1 的核心主干，例如 docs.docker.com -> docker，acme.com -> acme） */
export function extractMainDomainLabel(host: string): string {
  if (!host) return "";
  const clean = host.toLowerCase().replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length <= 1) return parts[0] || "";

  if (parts.length >= 3) {
    const twoPartSuffix = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (COMMON_TLD_PARTS.has(twoPartSuffix)) {
      return parts[parts.length - 3] || "";
    }
  }
  return parts[parts.length - 2] || "";
}

/** URL 路径深度：根路径 "/" 为 0，单层 "/download" 为 1 */
export function getUrlPathDepth(urlStr: string): number {
  try {
    const u = new URL(urlStr);
    const segments = u.pathname.split("/").filter(Boolean);
    // 把主页默认文件视为根路径
    if (segments.length === 1 && /^index\.(html?|php|aspx?)$/i.test(segments[0])) {
      return 0;
    }
    return segments.length;
  } catch {
    return 99;
  }
}

/** 标题或摘要包含官方网站/主页特征词 */
const OFFICIAL_HOMEPAGE_PATTERN = /(官网|官方网站|官方平台|官方首页|主页|官方主页|\bofficial(\s*(website|site|portal|page|home))?\b|\bhome\s*page\b)/i;

/** 结构化官方权威置信度判定结果 */
export interface StructuralOfficialStatus {
  isOfficial: boolean;
  score: number;
  reason: string;
}

/**
 * 结构化通用官方网站判定（从纯硬编码白名单升级为通用信号识别）
 * 结合：域名 eTLD+1 主干比对 + URL 根路径/浅层路径深度 + 官方主页特征词
 */
export function detectStructuralOfficial(
  url: string,
  host: string,
  queryCanonicals: string[],
  title?: string,
  snippet?: string
): StructuralOfficialStatus {
  if (!host || queryCanonicals.length === 0) {
    return { isOfficial: false, score: 0, reason: "no_host_or_query" };
  }

  const cleanHost = host.toLowerCase().replace(/^www\./, "");
  const mainLabel = canonicalizeTerm(extractMainDomainLabel(cleanHost));
  const hostLabels = cleanHost.split(/[.\-]/).filter(Boolean).map(canonicalizeTerm);

  const isMainBrandMatch = mainLabel.length >= 2 && queryCanonicals.includes(mainLabel);
  const isAnyLabelMatch = hostLabels.some((label) => label.length >= 3 && queryCanonicals.includes(label));

  if (!isMainBrandMatch && !isAnyLabelMatch) {
    return { isOfficial: false, score: 0, reason: "brand_mismatch" };
  }

  const depth = getUrlPathDepth(url);
  const textCombo = `${title || ""} ${snippet || ""}`;
  const hasOfficialKeywords = OFFICIAL_HOMEPAGE_PATTERN.test(textCombo);
  const isDocSubdomain = DOC_SUBDOMAIN.test(cleanHost);
  const isDocPath = DOC_PATH.test(url);

  // 1. 官方文档站点（如 docs.docker.com, vite.dev/guide/）
  if (isDocSubdomain || isDocPath) {
    return {
      isOfficial: true,
      score: isDocSubdomain ? 20 : 16,
      reason: "official_documentation"
    };
  }

  // 2. 官方主站/根页面（如 acme.com/ 或 acme.com/zh）
  if (isMainBrandMatch && depth === 0) {
    const isNavigational = queryCanonicals.length <= 2;
    return {
      isOfficial: true,
      score: hasOfficialKeywords ? 28 : (isNavigational ? 24 : 18),
      reason: "official_homepage_root"
    };
  }

  // 3. 官方浅层页面（如 acme.com/download）
  if (isMainBrandMatch && depth === 1) {
    return {
      isOfficial: true,
      score: hasOfficialKeywords ? 18 : 14,
      reason: "official_shallow_page"
    };
  }

  // 4. 标题含官网特征词的域名关联页
  if (hasOfficialKeywords && depth <= 2) {
    return {
      isOfficial: true,
      score: 12,
      reason: "official_keyword_match"
    };
  }

  return {
    isOfficial: false,
    score: isMainBrandMatch ? 8 : 4,
    reason: "brand_domain_associated"
  };
}

/**
 * 查询相关的权威加成 —— 对硬编码域名表的补强，支持文档站与普通官网首页。
 * @param url 完整 URL（路径信息参与判定）
 * @param host 已小写化的域名
 * @param queryCanonicals 查询的规范词项集合
 * @param title 页面标题（可选）
 * @param snippet 页面摘要（可选）
 */
export function queryScopedAuthority(
  url: string,
  host: string,
  queryCanonicals: string[],
  title?: string,
  snippet?: string
): number {
  return detectStructuralOfficial(url, host, queryCanonicals, title, snippet).score;
}

/**
 * 来源类型分类（用户侧筛选用）。
 *
 * 判定顺序刻意固定为「学术 → 聚合 → 文档 → 官方 → 媒体 → 社区」：
 *   · 学术与聚合必须最先判 —— 它们与其它表存在域名重叠（nih.gov 同属 TIER1 与学术；
 *     doc.com、51cto.com 既像社区又在内容农场表里）。若放到后面，就会被「权威」或
 *     「社区」抢先归类，用户的类型筛选因此静默失效。
 *   · 文档优先于官方：docs.docker.com 落在 TIER1，但它同时是文档站，
 *     对用户而言「文档」是更精确的标签。
 */
export function classifySourceType(host: string, url: string): SearchSourceType {
  if (!host) return "community";
  if (anyMatch(host, ACADEMIC_DOMAINS)) return "academic";
  if (anyMatch(host, LOW_QUALITY_DOMAINS)) return "aggregator";
  if (DOC_SUBDOMAIN.test(host) || DOC_PATH.test(url)) return "documentation";
  if (anyMatch(host, TIER1_DOMAINS)) return "official";
  if (anyMatch(host, MEDIA_DOMAINS)) return "media";
  return "community";
}

/** 域名匹配：命中该域名本身或其子域即算命中 */
function hostMatchesDomain(host: string, domain: string): boolean {
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * 文本语言粗判（零成本近似，见 SearchFilters.languages 的说明）。
 * 只区分「含 CJK」与「以拉丁为主」，不追求精确语种识别 ——
 * 它的用途是排除明显不对语种的结果，不会被当作语言判定使用。
 */
function textScriptOf(text: string): "cjk" | "latin" {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || [])
    .length;
  const latin = (text.match(/[a-z]/gi) || []).length;
  return cjk > latin ? "cjk" : "latin";
}

/** CJK 语族的语言代码前缀 */
const CJK_LANGUAGE_PREFIXES = ["zh", "ja", "ko"];

/**
 * 判定一条结果是否通过用户的筛选条件。
 *
 * 全部条件遵循「未指定即不参与淘汰」：filters 缺省时恒返回通过，
 * 因此既有查询的结果集不会因为本次改动而漂移。
 */
export function matchesSearchFilters(
  result: SearchResult,
  filters?: SearchFilters
): { pass: boolean; reason?: string } {
  if (!filters) return { pass: true };

  const host = hostnameOf(result.url);

  // 域名排除优先于包含 —— 用户明确拉黑的东西不应因为同时在白名单里而被放回
  if (filters.excludeDomains?.length) {
    if (filters.excludeDomains.some((d) => hostMatchesDomain(host, d))) {
      return { pass: false, reason: "excluded_domain" };
    }
  }
  if (filters.includeDomains?.length) {
    if (!filters.includeDomains.some((d) => hostMatchesDomain(host, d))) {
      return { pass: false, reason: "not_in_included_domains" };
    }
  }

  if (filters.sourceTypes?.length) {
    if (!filters.sourceTypes.includes(classifySourceType(host, result.url))) {
      return { pass: false, reason: "source_type_mismatch" };
    }
  }

  // 时间条件：仅在结果带有**可解析**的发布时间时生效。
  // 缺失发布时间的条目一律不淘汰 —— 否则会把大量无日期的优质页面一并误杀，
  // 那是「筛掉了想要的东西」，不是「筛掉了不要的东西」。
  const ts = result.publishedDate ? Date.parse(result.publishedDate) : NaN;
  const hasTimestamp = Number.isFinite(ts);

  if (hasTimestamp) {
    if (filters.publishedAfter) {
      const after = Date.parse(filters.publishedAfter);
      if (Number.isFinite(after) && ts < after) {
        return { pass: false, reason: "published_before_range" };
      }
    }
    if (filters.publishedBefore) {
      const before = Date.parse(filters.publishedBefore);
      if (Number.isFinite(before) && ts > before) {
        return { pass: false, reason: "published_after_range" };
      }
    }
    if (filters.freshnessDays) {
      const ageDays = (Date.now() - ts) / DAY_MS;
      if (ageDays > filters.freshnessDays) {
        return { pass: false, reason: "stale" };
      }
    }
  }

  if (filters.languages?.length) {
    const script = textScriptOf(`${result.title} ${result.snippet || ""}`);
    const isCjkLang = (l: string) => CJK_LANGUAGE_PREFIXES.some((p) => l === p || l.startsWith(`${p}-`));
    const wantsCjk = filters.languages.some(isCjkLang);
    const wantsLatin = filters.languages.some((l) => !isCjkLang(l));
    const allowed = (script === "cjk" && wantsCjk) || (script === "latin" && wantsLatin);
    if (!allowed) return { pass: false, reason: "language_mismatch" };
  }

  return { pass: true };
}

// ============================================================
// 3. 文本覆盖度
// ============================================================

/** 加权覆盖度：命中的词项权重之和 / 全部词项权重之和（0~1） */
function weightedCoverage(
  textTerms: Set<string>,
  weights: Record<string, number>,
  phraseCanonicalMap?: Map<string, Set<string>>
): { score: number; matched: string[] } {
  const keys = Object.keys(weights);
  if (keys.length === 0) return { score: 0, matched: [] };

  let effectiveTextTerms = textTerms;
  if (phraseCanonicalMap && phraseCanonicalMap.size > 0) {
    let hasPhraseCanonical = false;
    for (const [canonical] of phraseCanonicalMap) {
      if (textTerms.has(canonical)) {
        hasPhraseCanonical = true;
        break;
      }
    }
    if (hasPhraseCanonical) {
      effectiveTextTerms = new Set(textTerms);
      for (const [canonical, associated] of phraseCanonicalMap) {
        if (textTerms.has(canonical)) {
          for (const term of associated) {
            effectiveTextTerms.add(term);
          }
        }
      }
    }
  }

  let total = 0;
  let hit = 0;
  const matched: string[] = [];
  for (const key of keys) {
    const w = weights[key];
    total += w;
    if (effectiveTextTerms.has(key)) {
      hit += w;
      matched.push(key);
    }
  }
  return { score: total > 0 ? hit / total : 0, matched };
}

/**
 * 查询词项在文本中「连续相邻出现」的最长长度。
 *
 * 用途：把「整串短语命中」这个二值信号连续化。
 * 例：查询 "install docker" ，
 *   "Install Docker Engine on Ubuntu" -> 词序列 [install, docker, engine, ubuntu]
 *     -> 连续段 [install, docker] 长度 2（engine 处断开）
 *   "Docker is great, install it now" -> 只有孤立的 1，说明两个词在讲不同的事。
 * 相邻度越高，越可能整句都在讲用户要的那件事。
 */
function longestQueryRun(text: string, queryCanonicals: string[]): number {
  if (!text || queryCanonicals.length < 2) return 0;
  const querySet = new Set(queryCanonicals);
  let best = 0;
  let current = 0;
  for (const token of splitTerms(text)) {
    if (querySet.has(canonicalizeTerm(token))) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

/** 拉丁词项形态（技术名词几乎都是这种：nginx / react / docker / k8s / c++ / node.js） */
function isLatinTokenLike(term: string): boolean {
  return /^[a-z][a-z0-9+#._-]*$/.test(term) && !/^\d+$/.test(term);
}

/** 文本是否以拉丁字母为主 —— 用于判断文档语言与查询是否「跨脚本」 */
function isLatinDominated(text: string): boolean {
  const latin = (text.match(/[a-z0-9]/gi) || []).length;
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  return latin >= cjk;
}

/**
 * 主体词门控：查询里的拉丁词项几乎总是「在讲什么」的主体。
 *
 * 为什么需要它：纯词项覆盖有一个致命盲区 —— 修饰词多的一方会赢。
 *   查询「Nginx 反向代理配置」的候选里，
 *     · Apache《反向代理配置》：命中「反向代理 / 配置」等全部修饰词，唯独没有 Nginx
 *     · Nginx 官方文档：命中 nginx + reverse proxy + 配置
 *   前者覆盖 5/6 个词项、后者 3/6，加权求和后 Apache 反而排第一 —— 但它讲的是 Apache。
 * 页面连主体词都不提，基本可以断定讲的是别的东西，无论它命中多少修饰词。
 *
 * 用「标题或摘要至少命中一个拉丁词项」作为门槛，而不是要求全部命中 ——
 * 因为部分正确召回依赖摘要（如标题为 "Production cluster setup with kubeadm" 的
 * 官方页，Kubernetes 一词只出现在摘要里）。
 */
function latinEntityCoverage(
  queryTerms: string[],
  titleTerms: Set<string>,
  snippetTerms: Set<string>,
  urlTerms: Set<string>
): { total: number; ratio: number } {
  const latin = queryTerms.filter(isLatinTokenLike).map(canonicalizeTerm);
  const unique = Array.from(new Set(latin));
  if (unique.length === 0) return { total: 0, ratio: 1 };
  // URL 路径也算一路信号：很多站点把主题写进 slug（dev.to/react-state-2024）。
  // 它只用于**避免误罚**（否定式判断），不参与任何加分，因此不会把无关页面抬上来。
  const hit = unique.filter((t) => titleTerms.has(t) || snippetTerms.has(t) || urlTerms.has(t)).length;
  return { total: unique.length, ratio: hit / unique.length };
}

function normalizeForPhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u3000]+/g, " ")
    .replace(/[^\w\u3400-\u9fff ]/g, "")
    .trim();
}

// ============================================================
// 4. 候选池合并 / 去重
// ============================================================

export interface CandidatePool {
  results: SearchResult[];
  /** 该池来自哪一路查询（用于多路共识统计） */
  source?: string;
}

export interface MergedCandidate {
  result: SearchResult;
  /** 候选池中出现次数（同一 URL 被多路查询命中 → 强相关信号） */
  hits: number;
  /** 命中该 URL 的不同引擎数 */
  engines: Set<string>;
  /** 命中该 URL 的不同子查询路数 */
  sources: Set<string>;
}

/** 与内容无关的追踪参数：它们不影响页面身份，却会让同一页面被算成多条 */
const TRACKING_PARAMS = /^(utm_|fbclid|gclid|msclkid|mc_cid|mc_eid|ref|referrer|source|spm|from|share_token|_hsenc|_hsmi|igshid|yclid)/i;

/**
 * URL 归一化：去协议、去 www、去尾部斜杠与 hash、丢弃追踪参数、排序剩余参数、统一小写。
 *
 * 为什么追踪参数必须丢：`?utm_source=twitter` 这类参数在聚合多个搜索引擎的结果时
 * 大量出现。若不归一，同一篇文章会以多条身份进入候选池 —— 既占掉信源名额，
 * 又让"多路共识"统计失真（本该 ×1 的页面被记成 ×3，凭空获得共识加分）。
 * 剩余参数排序则保证 `?a=1&b=2` 与 `?b=2&a=1` 归一为同一个 key。
 */
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();

    const kept: Array<[string, string]> = [];
    u.searchParams.forEach((value, key) => {
      if (!TRACKING_PARAMS.test(key)) kept.push([key.toLowerCase(), value]);
    });
    kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    const query = kept.length ? `?${kept.map(([k, v]) => `${k}=${v}`).join("&")}` : "";

    return `${host}${path}${query}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

/** 标题归一化：仅保留字母数字与 CJK，用于内容级去重 */
function normalizeTitleKey(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[^\w\u3400-\u9fff]/g, "");
}

/** 标题 n-gram 集合，用于近似重复判定 */
function titleShingles(title: string): Set<string> {
  const key = normalizeTitleKey(title);
  const out = new Set<string>();
  for (let i = 0; i + 2 <= key.length; i++) out.add(key.slice(i, i + 2));
  if (out.size === 0 && key) out.add(key);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const item of a) if (b.has(item)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * 合并多路候选池并按 URL 归一化去重，同时统计「多路共识」。
 * 共识是比单一引擎 score 可靠得多的相关性信号：同一页面被多个子查询
 * 同时召回，几乎可以断定它就是用户要找的东西。
 */
export function mergeCandidatePools(pools: CandidatePool[]): MergedCandidate[] {
  const byKey = new Map<string, MergedCandidate>();

  for (const pool of pools) {
    for (const result of pool.results || []) {
      if (!result || !result.url) continue;
      const key = normalizeUrlKey(result.url);
      const existing = byKey.get(key);
      if (existing) {
        existing.hits += 1;
        if (result.engine) existing.engines.add(result.engine);
        if (pool.source) existing.sources.add(pool.source);
        // 保留信息量最大的那一条：摘要更长者优先，避免合并后丢信息
        if ((result.snippet?.length || 0) > (existing.result.snippet?.length || 0)) {
          existing.result = { ...existing.result, ...result };
        }
      } else {
        byKey.set(key, {
          result: { ...result },
          hits: 1,
          engines: new Set(result.engine ? [result.engine] : []),
          sources: new Set(pool.source ? [pool.source] : [])
        });
      }
    }
  }

  return Array.from(byKey.values());
}

// ============================================================
// 5. 主入口：重排 + 去重 + 多样性配额
// ============================================================

export interface RankOptions {
  query: string;
  /** 期望返回条数 */
  limit?: number;
  /** 单域名最大条数，保证信源多样性 */
  maxPerDomain?: number;
  /** 用户明确要百科时放行 Wikipedia / 百度百科 */
  allowEncyclopedia?: boolean;
  /** 时效先验：近 N 年内加分 */
  recencyWindowDays?: number;
  /**
   * 用户侧多条件筛选（时间窗 / 域名黑白名单 / 来源类型 / 语言 / 条数上限）。
   * 缺省即完全不介入，既有调用方的行为一字不变。
   */
  filters?: SearchFilters;
}

export type RankedSearchResult = SearchResult & {
  /** 0~100 的相关性总分 */
  relevanceScore: number;
  /** 命中的查询词项（用于前端透明化展示） */
  matchedTerms: string[];
  /** 多路共识命中次数 */
  sourceHits: number;
  /** 命中引擎数 */
  engineCount: number;
  relevanceReason: string;
  /**
   * 所属事件簇编号（1 起）。
   *
   * 语义是「这批结果里有几条在讲同一件事」——同一事件被多家转载/报道时归为一簇。
   * 注意：**归簇不等于淘汰**，非代表条目照常返回，以保留不同来源的表述差异
   * （见 C5.3 的多样性保护要求）。前端可据此展示"N 个来源报道同一事件"。
   */
  eventClusterId?: number;
  /**
   * 各打分维度的结构化分项（与总分同一口径，可直接相加核对）。
   *
   * 为什么必须输出：此前只有总分 `relevanceScore` 与一句文字 `relevanceReason`，
   * 于是「为什么这条排第一」只能靠文字猜测，无法被审计、也无法被测试断言。
   * 这里把参与求和的每一项如实交出，让排序从"黑盒结论"变成"可回溯的算式"。
   */
  scoreBreakdown?: ScoreBreakdown;
};

/**
 * 排序分项。字段与 rankAndFilterResults 内部参与 `score` 求和的各项一一对应，
 * 便于逐项核对"这条为什么排在前面"。
 */
export interface ScoreBreakdown {
  /** 标题词项加权覆盖度（已乘 IDF） */
  titleCoverage: number;
  /** 摘要词项加权覆盖度（已乘 IDF） */
  snippetCoverage: number;
  /** 核心实体短语覆盖度（剔除意图修饰词后） */
  entityCoverage: number;
  /** 整串短语命中加成 */
  phraseHit: number;
  /** 词项邻近度加成 */
  proximity: number;
  /** 域名权威先验 + 查询相关权威加成（受相关性门控） */
  authority: number;
  /** 多路检索共识加成 */
  consensus: number;
  /** 多引擎共识加成 */
  engineConsensus: number;
  /** 时效加成 */
  recency: number;
  /** 惩罚项合计（负值：低质/零覆盖/主体词缺失等） */
  penalties: number;
  /** 求和结果（未做 0~100 归一化前的原始分） */
  rawScore: number;
}

/**
 * 排序与去重的分层真实计数。
 *
 * 存在的理由：此前 retrievalAgent 的 diagnostics 里 `afterSpamFilter` / `afterQualityFilter`
 * 是拿 uniqueCandidates 乘固定系数**估算**出来的，并非真实计数。诊断数据一旦失真，
 * 任何基于它做的质量评估都会得出错误结论 —— 这与本模块"如实反映"的取向相悖。
 *
 * 计数口径：硬剔除与质量地板在打分阶段直接计数；域名配额与内容重复在选入阶段
 * 由**最终归因**得出（只对「分数达标但未入选」的候选归因，且同一候选只归一类，
 * 优先归为内容重复）。因此各层之和等于「进入排序的候选数 − 最终保留数」，不重复计数。
 */
export interface RankingReport {
  /** 进入排序的合并后候选数（URL 归一化去重之后） */
  candidatesEntered: number;
  /** 硬剔除：营销导流站 / 破解标题 / 搜索结果页 / 未获授权的百科 */
  hardRejected: number;
  /** 低于最低质量门槛，任何一轮分档都未够到 */
  belowQualityFloor: number;
  /** 因单域名配额已满而被跳过 */
  domainCapSkipped: number;
  /** 因标题（或摘要）判定为近重复而被合并 */
  titleLevelRemoved: number;
  /** 分数达标但超出本次目标条数（limit）而未入选 */
  capacitySkipped: number;
  /** 未通过用户侧筛选条件（时间窗 / 域名 / 来源类型 / 语言） */
  userFiltered: number;
  /**
   * 被归并到既有事件簇的条目数。
   *
   * ⚠️ 命名说明：方案里此字段名为 `semanticLevelRemoved`，但实现中这些条目
   * **并不会被淘汰** —— 方案 C5.3 明确要求「同一簇至少保留若干条，不得塌缩为一条」，
   * 因此它们照常返回，只是被标注了簇归属。用 `Removed` 描述会与事实不符，
   * 故更名以如实反映行为（只归并，不删除）。
   */
  semanticLevelMerged: number;
  /** 形成的事件簇总数（含仅单条来源的簇） */
  eventClusterCount: number;
  /** 最终保留条数 */
  kept: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 动态域名配额：技术/官方/开源类查询允许更高的同域名信源上限 */
export function getMaxPerDomain(query: string): number {
  if (/官方|官网|文档|documentation|docs|guide|reference/i.test(query)) {
    return 10;
  }
  if (/github|仓库|源码|api|开发|教程|安装|部署|报错|下载|rom/i.test(query)) {
    return 8;
  }
  return 6;
}

/** 质量地板：低于此分数的条目一律不进入默认信源集 */
const QUALITY_FLOOR = 12;

/**
 * 最低回落门槛（与最后一轮 runPass 的门槛必须一致）。
 * 抽成常量是为了让「质量地板以下」的归因口径与轮次门槛自动绑定 ——
 * 若两处各写一个字面量，日后调门槛时归因就会悄悄失真。
 */
const LOWEST_FALLBACK_FLOOR = 6;

/**
 * 事件簇归并阈值（规范词项集合的 Jaccard）。
 *
 * 取得偏保守（0.85）是刻意的：这是**零成本近似**而非真语义相似度，
 * 只靠词项集合重叠判断，无法区分"同义改写"与"同一主题的不同文章"。
 * 阈值放低会把同主题的独立报道误并进一簇，那是在破坏多样性 ——
 * 宁可漏合并，不可误杀。
 */
const SEMANTIC_CLUSTER_THRESHOLD = 0.85;

function recencyScore(publishedDate: string | undefined, windowDays: number): number {
  if (!publishedDate) return 0;
  const ts = Date.parse(publishedDate);
  if (!Number.isFinite(ts)) return 0;
  const ageDays = (Date.now() - ts) / DAY_MS;
  if (ageDays < 0) return 1;
  if (ageDays > windowDays) return 0;
  return 1 - ageDays / windowDays;
}

/**
 * 检索相关性重排内核。
 * 输入：合并后的候选池；输出：高相关、去重、多样化的信源清单（含打分依据）。
 *
 * 这是只取结果集的薄封装，保留以满足既有调用方；需要分层计数时用
 * rankAndFilterResultsWithReport。
 */
export function rankAndFilterResults(
  candidates: MergedCandidate[],
  options: RankOptions
): RankedSearchResult[] {
  return rankAndFilterResultsWithReport(candidates, options).results;
}

/**
 * 与 rankAndFilterResults 同一条流水线，额外返回**真实的分层淘汰计数**。
 * 详见 RankingReport 的口径说明。
 */
export function rankAndFilterResultsWithReport(
  candidates: MergedCandidate[],
  options: RankOptions
): { results: RankedSearchResult[]; report: RankingReport } {
  const {
    query,
    allowEncyclopedia = false,
    recencyWindowDays = 730,
    filters
  } = options;

  // 用户显式指定条数上限时以用户为准，否则回落到服务端默认
  const limit = filters?.maxResults ?? options.limit ?? 500;

  // 分层淘汰计数（口径见 RankingReport）
  let hardRejected = 0;
  let userFiltered = 0;

  const maxPerDomain = options.maxPerDomain ?? getMaxPerDomain(query);

  const profile = buildQueryProfile(query);
  const entityPhrase = normalizeForPhrase(profile.entityPhrase);
  const entityCanonicals = new Set(entityPhrase ? canonicalTermSet(profile.entityPhrase) : []);
  const queryCanonicals = profile.canonicalTerms;

  // ------------------------------------------------------------
  // IDF：用候选池自身的文档频率衡量词项的「区分度」
  // ------------------------------------------------------------
  // 旧实现只按词长定权（weights[term] = min(len, 8)），于是查询「React 状态管理」中
  // "react"（全网都在说，零区分度）与真正的关键词权重相当，排序因此被常见词带偏。
  // 这里用池内文档频率做平滑 IDF：一个词出现在大多数候选里，它的权重就被压到接近 1；
  // 只在少数候选里出现的词，权重成倍放大 —— 那才是真正区分"相关 / 不相关"的信号。
  const docFreq = new Map<string, number>();
  for (const candidate of candidates) {
    const docCanonicals = canonicalTermSet(`${candidate.result.title} ${candidate.result.snippet || ""}`);
    for (const term of queryCanonicals) {
      if (docCanonicals.has(term)) docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }
  const poolSize = Math.max(1, candidates.length);
  const effectiveWeights: Record<string, number> = {};
  for (const term of queryCanonicals) {
    const df = docFreq.get(term) || 0;
    // df === 0：全池无人命中（拼写错误或生僻词）。它无法区分任何文档，
    // 若留在覆盖率分母里只会平等地压低所有条目，因此按"无区分度"剔除。
    if (df === 0) continue;
    const idf = Math.log((poolSize + 1) / (df + 1)) + 1; // 平滑 IDF，恒 ≥ 1
    effectiveWeights[term] = profile.weights[term] * idf;
  }

  const scored: RankedSearchResult[] = [];

  for (const candidate of candidates) {
    const { result, hits, engines } = candidate;
    if (!result.url || !result.title) {
      hardRejected++;
      continue;
    }

    const host = hostnameOf(result.url);
    if (!host) {
      hardRejected++;
      continue;
    }

    const isEncyclopedia = /wikipedia\.org|baike\.baidu\.com/i.test(host);
    if (isEncyclopedia && !allowEncyclopedia) {
      hardRejected++;
      continue;
    }

    // 硬性剔除：营销导流站、广告/商业推广/赞助、破解/优惠券标题、以及「搜索结果页」这类根本不是内容的 URL。
    // 都不参与排序，也绝不允许被后续兜底补位重新拉回。
    if (
      SPAM_URL_PATTERNS.test(result.url) ||
      SPAM_TITLE_PATTERNS.test(result.title) ||
      isSearchEndpoint(result.url) ||
      isAdOrSpamResult(result)
    ) {
      hardRejected++;
      continue;
    }

    // 用户侧筛选：放在硬剔除之后、打分之前 —— 用户条件属硬约束，
    // 被排除的条目连打分都不必做，也因此不会占用域名配额。
    if (!matchesSearchFilters(result, filters).pass) {
      userFiltered++;
      continue;
    }

    const titleTerms = canonicalTermSet(result.title);
    const snippetTerms = canonicalTermSet(result.snippet || "");

    const titleCov = weightedCoverage(titleTerms, effectiveWeights, profile.phraseCanonicalMap);
    const snippetCov = weightedCoverage(snippetTerms, effectiveWeights, profile.phraseCanonicalMap);
    const entityCov = entityCanonicals.size > 0
      ? weightedCoverage(
          titleTerms,
          Object.fromEntries(Array.from(entityCanonicals).map((t) => [t, 1])),
          profile.phraseCanonicalMap
        )
      : { score: 0, matched: [] as string[] };

    const urlTerms = canonicalTermSet(result.url.replace(/[/_?#=&.-]+/g, " "));
    const latinCoverage = latinEntityCoverage(profile.terms, titleTerms, snippetTerms, urlTerms);
    const latinMissing = latinCoverage.total > 0 && latinCoverage.ratio === 0;

    const normalizedTitle = normalizeForPhrase(result.title);
    const normalizedSnippet = normalizeForPhrase(result.snippet || "");
    const entityCanonicalForms = matchPhraseCanonicalForms(entityPhrase);
    const phraseHit = !latinMissing && ((entityPhrase.length >= 2 && (
      normalizedTitle.includes(entityPhrase) || normalizedSnippet.includes(entityPhrase)
    )) || entityCanonicalForms.some((form) => {
      const norm = normalizeForPhrase(form);
      return norm.length >= 2 && (normalizedTitle.includes(norm) || normalizedSnippet.includes(norm));
    }));

    // 词项邻近度：查询词在文本里挨得越紧，越可能是在讲同一件事。
    // 这是「整串命中」的连续化版本 —— 旧实现只有"整串 +12 / 否则 0"，
    // 结果是覆盖了实体短语大部分且紧邻的条目拿不到任何加成，与词散落全篇者同分。
    const runInTitle = longestQueryRun(result.title, queryCanonicals);
    const runInSnippet = longestQueryRun(result.snippet || "", queryCanonicals);
    const rawProximity = Math.min(1, (Math.max(runInTitle, runInSnippet) - 1) / 2);
    const proximity = !latinMissing && phraseHit ? Math.max(rawProximity, 0.8) : rawProximity;

    // 多路共识：被 2 路以上召回说明多个查询视角都认为它相关
    const consensus = Math.min(1, Math.max(0, (hits - 1) / 2));
    // 引擎共识：SearXNG 多引擎同时给出同一 URL
    const engineConsensus = Math.min(1, Math.max(0, (engines.size - 1) / 2));

    // 权威 = 静态域名先验 + 查询相关的结构化通用加成（支持官方文档站与普通品牌首页）
    const structuralOfficial = detectStructuralOfficial(result.url, host, queryCanonicals, result.title, result.snippet);
    const authority = authorityPrior(host) + structuralOfficial.score;
    const recency = recencyScore(result.publishedDate, recencyWindowDays);

    const isStructuralOfficialMatch = structuralOfficial.isOfficial;

    // 权威门控：若候选被判定为结构化官方网站或命中主品牌域名，即使标题未包含全部词项也予开放门控
    const relevanceGate = (latinMissing && !isStructuralOfficialMatch)
      ? 0
      : (titleCov.matched.length > 0 || isStructuralOfficialMatch)
      ? 1
      : snippetCov.matched.length > 0
      ? 0.4
      : 0;

    const hostMatchesQuery =
      structuralOfficial.score > 0 ||
      profile.terms.some((t) => isLatinTokenLike(t) && host.includes(canonicalizeTerm(t)));

    const isRecognizedOfficial = Boolean(
      result.isOfficial || isStructuralOfficialMatch || (hostMatchesQuery && anyMatch(host, TIER1_DOMAINS))
    );

    const officialBonus = (!latinMissing || isStructuralOfficialMatch) && isRecognizedOfficial && relevanceGate > 0 ? 8 : 0;

    let score = 0;
    score += titleCov.score * 34;              // 标题是用户第一眼看到的东西（已 IDF 加权）
    score += snippetCov.score * 12;            // 摘要为辅助证据
    score += entityCov.score * 10;             // 实体短语覆盖（剔除了意图噪声）
    score += phraseHit ? 8 : 0;                // 整串命中
    score += proximity * 10;                   // 词项邻近（连续化加成）
    score += authority * relevanceGate;        // 权威：-22 ~ +18，且受相关性门控
    score += consensus * 8;
    score += engineConsensus * 4;
    score += recency * 6;
    score += officialBonus;                    // 官方标记加成

    // 惩罚梯度（取代旧的二值惩罚）
    const titleRatio = titleCov.score;
    const snippetRatio = snippetCov.score;

    // 惩罚统一累加到 penalties，而不是直接从 score 里减：
    // 这样「分项之和 == 原始分」的恒等式成立，scoreBreakdown 才能被逐项核对。
    let penalties = 0;

    // 跨脚本候选（中文查询 ↔ 英文文档）字面重叠天然为 0，不能按"完全无关"重罚：
    // 跨语言路由辛苦召回回来的英文权威源，如果在本地重排阶段被当成零命中丢掉，
    // 那条路由就等于白做。此处只**削弱惩罚**，绝不凭空增加相关性。
    const scriptMismatch = profile.isLatin !== isLatinDominated(`${result.title} ${result.snippet || ""}`);

    const isOfficialCandidate = result.isOfficial || isStructuralOfficialMatch;

    if (titleRatio === 0 && snippetRatio === 0) {
      // 标题与摘要都找不到任何查询词迹：官方主页可能为精炼宣传标语，显著从宽
      penalties -= isOfficialCandidate ? 6 : (scriptMismatch ? 16 : 45);
    } else if (titleRatio === 0) {
      // 只有摘要沾边：弱相关，按沾边程度分档扣分
      penalties -= isOfficialCandidate ? 4 : (12 + (1 - snippetRatio) * 10);
    } else {
      // 标题命中不全：跨脚本时若已命中核心词，扣分从宽
      penalties -= scriptMismatch ? (1 - titleRatio) * 6 : (1 - titleRatio) * 14;
    }

    // 主体词门控：当查询含有拉丁主体词时，未命中主体的候选从严惩罚；
    // 但若域名主干已精确命中主体（如 docker.com 对应 docker），不应扣除 54 分
    if (latinCoverage.total > 0) {
      if (latinCoverage.ratio === 0) {
        penalties -= (hostMatchesQuery || isOfficialCandidate) ? 8 : 54;
      } else if (latinCoverage.ratio < 0.5) {
        penalties -= 12;
      }
    }

    // 概念定义意图与内容侧对齐：
    // 当查询属于概念/定义意图（如「什么是 X」），高级性能调优或深水区排查与意图不符，予以针对性降权
    const isDefinitionQuery = /(什么是|是什么|啥是|什么叫|为啥|为什么|what is|concept of)/i.test(profile.raw);
    const isTuningOrTroubleshooting = /(性能调优|调优|性能优化|优化实战|tuning|benchmark)/i.test(result.title);
    if (isDefinitionQuery && isTuningOrTroubleshooting) {
      penalties -= 18;
    }

    if (!result.snippet || result.snippet.length < 24) penalties -= 8;
    // 短标题本身不是缺陷（官方文档常用短标题，如 "Docker Docs"），
    // 只有"短且不含任何查询词"才说明它没提供有效信息。
    if (result.title.length < 6 && titleCov.matched.length === 0) penalties -= 6;

    score += penalties;

    const relevanceScore = Math.max(0, Math.min(100, Math.round((score + 20) * (100 / 130) * 10) / 10));

    const matchedRaw = Array.from(
      new Set(
        [...titleCov.matched, ...snippetCov.matched].flatMap((c) => profile.rawTermsByCanonical[c] || [c])
      )
    );

    const reasons: string[] = [];
    if (titleCov.score >= 0.5) reasons.push(`标题命中 ${titleCov.matched.length}/${queryCanonicals.length} 个查询词项`);
    if (phraseHit) reasons.push("核心实体短语整串命中");
    else if (proximity > 0) reasons.push("查询词项在文本中紧邻出现");
    if (hits > 1) reasons.push(`多路检索共识 ×${hits}`);
    if (engines.size > 1) reasons.push(`多引擎共识 ×${engines.size}`);
    if (authority >= 18 && relevanceGate === 1) reasons.push("官方文档 / 学术权威信源");
    if (authority < 0) reasons.push("低质聚合站已降权");
    if (authority >= 18 && relevanceGate < 1) reasons.push("权威域名但与查询关联不足，已削弱其权重");

    const shouldMarkOfficial = Boolean(
      result.isOfficial || (isStructuralOfficialMatch && relevanceGate > 0)
    );

    scored.push({
      ...result,
      isOfficial: shouldMarkOfficial,
      score: relevanceScore,
      relevanceScore,
      matchedTerms: matchedRaw,
      sourceHits: hits,
      engineCount: engines.size,
      relevanceReason: reasons.join("；") || "综合相关度排序",
      // 分项之和 == 原始分（含 penalties），可直接相加核对，见 ScoreBreakdown 说明。
      // 官方标记加成并入 authority —— 它本质是权威维度的补充信号。
      scoreBreakdown: {
        titleCoverage: titleCov.score * 34,
        snippetCoverage: snippetCov.score * 12,
        entityCoverage: entityCov.score * 10,
        phraseHit: phraseHit ? 8 : 0,
        proximity: proximity * 10,
        authority: authority * relevanceGate + officialBonus,
        consensus: consensus * 8,
        engineConsensus: engineConsensus * 4,
        recency: recency * 6,
        penalties,
        rawScore: score
      }
    });
  }

function isDirectRootHomepage(urlStr: string, queryCanonicals: string[]): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const mainLabel = canonicalizeTerm(extractMainDomainLabel(host));
    if (!mainLabel || !queryCanonicals.includes(mainLabel)) return false;
    const parts = host.split(".");
    // 直接是 mainLabel.tld 形式（如 google.com, google.com.tw），无其它三级子域（如 accounts., maps.）
    const isDirectHost = parts[0] === mainLabel;
    const depth = getUrlPathDepth(urlStr);
    return isDirectHost && depth === 0;
  } catch {
    return false;
  }
}

  // 排序：相关度优先，其次多路共识，最后 URL 字典序保证完全可复现
  scored.sort((a, b) => {
    // 导航意图下，品牌官方主站根主页优先于二级子系统（如 google.com 优先于 accounts.google.com）
    const aIsRoot = isDirectRootHomepage(a.url, queryCanonicals);
    const bIsRoot = isDirectRootHomepage(b.url, queryCanonicals);
    if (aIsRoot !== bIsRoot && (a.isOfficial || b.isOfficial)) {
      return aIsRoot ? -1 : 1;
    }
    // 截断前的原始得分优先（避免满分 100 造成的平局）
    const aRaw = a.scoreBreakdown?.rawScore ?? a.score;
    const bRaw = b.scoreBreakdown?.rawScore ?? b.score;
    if (Math.abs(bRaw - aRaw) > 1e-4) return bRaw - aRaw;
    if (Math.abs(b.relevanceScore - a.relevanceScore) > 1e-6) return b.relevanceScore - a.relevanceScore;
    if (b.sourceHits !== a.sourceHits) return b.sourceHits - a.sourceHits;
    return a.url.localeCompare(b.url);
  });

  // 内容级去重 + 域名配额 + 分层质量过滤与多样性保底
  const output: RankedSearchResult[] = [];
  const perDomain = new Map<string, number>();
  const seenTitles: { shingles: Set<string>; host: string; snippet: string }[] = [];
  const pickedUrls = new Set<string>();

  // 选入阶段的落选归因记录：runPass 里只登记「谁被什么挡下」，
  // 真正的分类计数放到全部轮次跑完后的最终归因（见函数末尾），
  // 因为同一个候选可能在前一轮被挡、后一轮又被选上，边跑边计会重复计数。
  const rejectedByDomainCap = new Set<string>();
  const rejectedAsDuplicate = new Set<string>();

  /**
   * 分层回落机制：
   * Tier A (Score >= 30), Tier B (Score 20~29), Tier C (Score 12~19)
   * 支持按质量分层挑选，优先满足 Tier A，结果不足时自动降级补充 Tier B 和 Tier C，
   * 避免长尾查询因为单一固定 QUALITY_FLOOR 导致只剩 3~5 条甚至 0 条结果。
   */
  const runPass = (
    minScore: number,
    similarityThreshold: number,
    respectDomainCap: boolean
  ): void => {
    for (const item of scored) {
      if (output.length >= limit) break;
      if (item.relevanceScore < minScore) continue;
      if (pickedUrls.has(item.url)) continue;

      const host = hostnameOf(item.url);
      if (respectDomainCap && (perDomain.get(host) || 0) >= maxPerDomain) {
        rejectedByDomainCap.add(item.url);
        continue;
      }

      const shingles = titleShingles(item.title);
      const snippetShingles = titleShingles(item.snippet || "");

      // 联合判断标题与摘要：同域名下只有当标题极度近义 (0.92+) 且摘要也重叠时才判定为重复，
      // 避免把同官方域名下的不同文档页面（如 Docker WSL、Docker Windows、Docker Linux）误剔除
      const isDuplicate = seenTitles.some((existing) => {
        const titleSim = jaccard(existing.shingles, shingles);
        if (titleSim > similarityThreshold) {
          if (existing.host === host) {
            const snippetSim = jaccard(titleShingles(existing.snippet), snippetShingles);
            return titleSim > 0.92 || snippetSim > 0.55;
          }
          if (titleSim > 0.95) {
            return true;
          }
        }
        return false;
      });

      if (isDuplicate) {
        rejectedAsDuplicate.add(item.url);
        continue;
      }

      output.push(item);
      pickedUrls.add(item.url);
      perDomain.set(host, (perDomain.get(host) || 0) + 1);
      seenTitles.push({ shingles, host, snippet: item.snippet || "" });
    }
  };

  // 第一轮：Tier A (Score >= 30) 严格配额 + 0.82 标题相似度
  runPass(30, 0.82, true);

  // 第二轮：若高质量结果不足，补充 Tier B (Score >= 20)
  if (output.length < Math.min(limit, 100)) {
    runPass(20, 0.88, true);
  }

  // 第三轮：补充 Tier C (Score >= 12) 基础质量结果
  if (output.length < Math.min(limit, 50)) {
    runPass(12, 0.92, true);
  }

  // 第四轮：全网结果较少时放宽域名限制，避免结果归零
  if (output.length < Math.min(limit, 30)) {
    runPass(12, 0.95, false);
  }

  // 第五轮：长尾极度匮乏查询保底（Score >= LOWEST_FALLBACK_FLOOR）
  if (output.length < 10) {
    runPass(LOWEST_FALLBACK_FLOOR, 0.98, false);
  }

  // ---- 最终归因：把落选候选如实分类，供上层输出真实的分层计数 ----
  // 只对「分数够到最低门槛、但最终没被选上」的候选归因，同一候选只归一类：
  // 内容重复 > 域名配额 > 容量上限。重复优先是因为它是最根本的冗余原因 ——
  // 同一篇稿子被多站转载时，若先按配额归因，去重报告就会低估真实的重复量。
  // 归因后满足恒等式：
  //   candidatesEntered = hardRejected + userFiltered + belowQualityFloor
  //                     + titleLevelRemoved + domainCapSkipped + capacitySkipped + kept
  let belowQualityFloor = 0;
  let titleLevelRemoved = 0;
  let domainCapSkipped = 0;
  let capacitySkipped = 0;

  for (const item of scored) {
    if (pickedUrls.has(item.url)) continue;
    if (item.relevanceScore < LOWEST_FALLBACK_FLOOR) belowQualityFloor++;
    else if (rejectedAsDuplicate.has(item.url)) titleLevelRemoved++;
    else if (rejectedByDomainCap.has(item.url)) domainCapSkipped++;
    else capacitySkipped++;
  }

  // ---- L3 事件簇归并（零成本近似）--------------------------------------
  // 与前面 titleShingles 去重的分工：
  //   · titleShingles 只看标题字面，抓不到「标题被改写、正文同源」的转载；
  //   · 这里看规范词项集合的重叠度，对改写更鲁棒。
  //
  // 关键设计：归并**不淘汰任何条目**。方案要求「同一簇至少保留若干条、不得塌缩为一条」，
  // 所以非代表条目照常返回，只是被标注了簇归属。因此结果集大小完全不变 ——
  // 这一层不会改变既有的结果数量、配额与回落行为，属于纯增量信息。
  //
  // 标题与摘要**分开比较、取较大者**，而不是拼成一个集合：
  // 转载的典型形态正是"正文一字不差、标题被改写"，拼在一起反而会把标题的差异
  // 稀释进大量二元组里，导致本该合并的转载被判为不同事件（实测相似度会从 1.0 掉到 0.65）。
  const clusteredResults: RankedSearchResult[] = output.map((item) => ({ ...item }));
  const eventClusters: Array<{ id: number; memberCount: number }> = [];
  const clusterTitleTerms: Set<string>[] = [];
  const clusterSnippetTerms: Set<string>[] = [];
  let semanticLevelMerged = 0;

  for (const item of clusteredResults) {
    const titleTerms = canonicalTermSet(item.title);
    const snippetTerms = canonicalTermSet(item.snippet || "");
    let matched = -1;
    for (let i = 0; i < clusterTitleTerms.length; i++) {
      const similarity = Math.max(
        jaccard(clusterTitleTerms[i], titleTerms),
        jaccard(clusterSnippetTerms[i], snippetTerms)
      );
      if (similarity >= SEMANTIC_CLUSTER_THRESHOLD) {
        matched = i;
        break;
      }
    }
    if (matched >= 0) {
      item.eventClusterId = eventClusters[matched].id;
      eventClusters[matched].memberCount++;
      semanticLevelMerged++;
    } else {
      const id = eventClusters.length + 1;
      item.eventClusterId = id;
      eventClusters.push({ id, memberCount: 1 });
      clusterTitleTerms.push(titleTerms);
      clusterSnippetTerms.push(snippetTerms);
    }
  }

  return {
    results: clusteredResults,
    report: {
      candidatesEntered: candidates.length,
      hardRejected,
      userFiltered,
      belowQualityFloor,
      titleLevelRemoved,
      domainCapSkipped,
      capacitySkipped,
      semanticLevelMerged,
      eventClusterCount: eventClusters.length,
      kept: clusteredResults.length
    }
  };
}

/**
 * 便捷入口：直接吃多路原始结果，产出重排后的信源清单。
 * 这是检索 Agent 的对外主函数。
 */
export function rankSearchPools(
  pools: CandidatePool[],
  options: RankOptions
): {
  results: RankedSearchResult[];
  totalCandidates: number;
  uniqueCandidates: number;
  report: RankingReport;
} {
  const merged = mergeCandidatePools(pools);
  const { results, report } = rankAndFilterResultsWithReport(merged, options);
  return {
    results,
    totalCandidates: pools.reduce((sum, p) => sum + (p.results?.length || 0), 0),
    uniqueCandidates: merged.length,
    report
  };
}
