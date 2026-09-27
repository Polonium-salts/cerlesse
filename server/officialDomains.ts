/**
 * 权威域名与官方站点单一事实来源 (Canonical Domain Authority Source)
 * 统一供 retrievalRanker 与 sourceVerifyTool 引用，消除列表分叉与判定不一致。
 */

/** 官方顶级/权威机构与知名技术规范官方域名白名单 */
export const OFFICIAL_DOMAINS_SET = new Set<string>([
  // 知名软件基金会与国际标准
  "w3.org",
  "ietf.org",
  "ecma-international.org",
  "apache.org",
  "linuxfoundation.org",
  "kernel.org",
  "who.int",
  "un.org",

  // 权威代码仓库与官方开发平台
  "github.com",
  "github.io",
  "gitlab.com",
  "readthedocs.io",
  "mozilla.org",
  "developer.mozilla.org",

  // 核心语言与主流框架官方网站
  "python.org",
  "nodejs.org",
  "rust-lang.org",
  "golang.org",
  "go.dev",
  "react.dev",
  "reactjs.org",
  "vuejs.org",
  "typescriptlang.org",
  "vite.dev",
  "nextjs.org",
  "kubernetes.io",
  "docker.com",

  // 头部科技主体与云平台
  "microsoft.com",
  "apple.com",
  "developer.apple.com",
  "google.com",
  "cloud.google.com",
  "amazon.com",
  "aws.amazon.com",

  // 权威科学学术出版与论文库
  "arxiv.org",
  "acm.org",
  "ieee.org",
  "nature.com",
  "science.org",
  "nih.gov"
]);

/** 官方与权威域名的正则匹配模式（含政府 .gov 与教育科研 .edu、.ac 后缀） */
export const OFFICIAL_DOMAIN_PATTERNS: RegExp[] = [
  /(^|\.)github\.io$/,
  /(^|\.)github\.com$/,
  /(^|\.)gitlab\.com$/,
  /(^|\.)readthedocs\.io$/,
  /(^|\.)developer\.mozilla\.org$/,
  /(^|\.)mozilla\.org$/,
  /(^|\.)kernel\.org$/,
  /(^|\.)python\.org$/,
  /(^|\.)rust-lang\.org$/,
  /(^|\.)golang\.org$/,
  /(^|\.)go\.dev$/,
  /(^|\.)nodejs\.org$/,
  /(^|\.)react\.dev$/,
  /(^|\.)reactjs\.org$/,
  /(^|\.)vuejs\.org$/,
  /(^|\.)typescriptlang\.org$/,
  /(^|\.)vite\.dev$/,
  /(^|\.)nextjs\.org$/,
  /(^|\.)kubernetes\.io$/,
  /(^|\.)docker\.com$/,
  /(^|\.)apache\.org$/,
  /(^|\.)linuxfoundation\.org$/,
  /(^|\.)w3\.org$/,
  /(^|\.)ietf\.org$/,
  /(^|\.)ecma-international\.org$/,
  /(^|\.)microsoft\.com$/,
  /(^|\.)apple\.com$/,
  /(^|\.)google\.com$/,
  /(^|\.)cloud\.google\.com$/,
  /(^|\.)amazon\.com$/,
  /(^|\.)arxiv\.org$/,
  /(^|\.)acm\.org$/,
  /(^|\.)ieee\.org$/,
  /(^|\.)nature\.com$/,
  /(^|\.)science\.org$/,
  /(^|\.)nih\.gov$/,
  /(^|\.)who\.int$/,
  /(^|\.)un\.org$/,
  /(^|\.)gov$/,
  /(^|\.)gov\.[a-z]{2}$/,
  /(^|\.)edu$/,
  /(^|\.)edu\.[a-z]{2}$/,
  /(^|\.)ac\.[a-z]{2}$/
];

/** 判定指定主机名是否匹配已知官方权威白名单 */
export function isCanonicalOfficialDomain(host: string): boolean {
  if (!host) return false;
  const clean = host.toLowerCase().replace(/^www\./, "");
  if (OFFICIAL_DOMAINS_SET.has(clean)) return true;
  return OFFICIAL_DOMAIN_PATTERNS.some((p) => p.test(clean));
}

/** 高质量技术社区与问答库 */
export const TIER2_COMMUNITY_SET = new Set<string>([
  "stackoverflow.com",
  "stackexchange.com",
  "serverfault.com",
  "superuser.com",
  "developer.mozilla.org",
  "medium.com",
  "dev.to",
  "wikipedia.org",
  "arxiv.org",
  "infoq.cn",
  "infoq.com",
  "juejin.cn",
  "v2ex.com",
  "zhihu.com"
]);

export function isCanonicalTier2Domain(host: string): boolean {
  if (!host) return false;
  const clean = host.toLowerCase().replace(/^www\./, "");
  return TIER2_COMMUNITY_SET.has(clean);
}

/** 明确低质、采集站或高干扰域名 */
export const LOW_QUALITY_DOMAINS_SET = new Set<string>([
  "baidu.com",
  "csdn.net",
  "360.cn",
  "toutiao.com"
]);

export function isCanonicalLowQualityDomain(host: string): boolean {
  if (!host) return false;
  const clean = host.toLowerCase().replace(/^www\./, "");
  return LOW_QUALITY_DOMAINS_SET.has(clean);
}
