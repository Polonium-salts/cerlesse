import { SearchResult } from "../../src/types.js";

const OFFICIAL_DOMAINS = new Set([
  "github.com", "mozilla.org", "microsoft.com", "google.com", "apple.com",
  "python.org", "nodejs.org", "react.dev", "vuejs.org", "developer.apple.com",
  "kubernetes.io", "docker.com", "apache.org", "linuxfoundation.org", "go.dev",
  "rust-lang.org", "w3.org", "ietf.org", "ecma-international.org"
]);

const TIER2_DOMAINS = new Set([
  "stackoverflow.com", "developer.mozilla.org", "medium.com", "dev.to",
  "wikipedia.org", "arxiv.org", "infoq.cn", "juejin.cn", "v2ex.com"
]);

const SPAM_DOMAINS = new Set([
  "baidu.com", "csdn.net", "360.cn", "toutiao.com"
]);

export function isOfficialDomain(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return OFFICIAL_DOMAINS.has(h) || h.endsWith(".gov") || h.endsWith(".edu");
}

export function isTier2Domain(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return TIER2_DOMAINS.has(h);
}

export function isSpamDomain(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return SPAM_DOMAINS.has(h);
}

export interface SourceVerifyInput {
  url?: string;
  sourceId?: string;
  knownSources?: SearchResult[];
}

export interface SourceVerifyOutput {
  sourceId: string;
  accessible: boolean;
  domain: string;
  isOfficial: boolean;
  credibilitySignals: string[];
  conflicts?: string[];
}

/**
 * verify_source: 检验信源合法性、权威性、域信誉与冲突
 */
export async function sourceVerifyTool(input: SourceVerifyInput): Promise<SourceVerifyOutput> {
  let targetUrl = input.url?.trim() || "";
  let targetSource: SearchResult | undefined;

  if (input.sourceId && input.knownSources) {
    targetSource = input.knownSources.find(
      s => s.id === input.sourceId || s.url === input.sourceId
    );
    if (targetSource && !targetUrl) {
      targetUrl = targetSource.url;
    }
  }

  const sourceId = input.sourceId || targetUrl || "unknown";

  if (!targetUrl) {
    return {
      sourceId,
      accessible: false,
      domain: "unknown",
      isOfficial: false,
      credibilitySignals: ["Missing target URL"],
      conflicts: ["No valid URL was provided for verification"]
    };
  }

  let domain = "";
  let protocol = "";
  try {
    const parsed = new URL(targetUrl);
    domain = parsed.hostname.replace(/^www\./, "");
    protocol = parsed.protocol;
  } catch {
    return {
      sourceId,
      accessible: false,
      domain: targetUrl,
      isOfficial: false,
      credibilitySignals: ["Malformed URL format"],
      conflicts: ["URL cannot be parsed as a valid web address"]
    };
  }

  const credibilitySignals: string[] = [];
  const conflicts: string[] = [];

  const isHttps = protocol === "https:";
  if (isHttps) {
    credibilitySignals.push("TLS/HTTPS Secure Protocol");
  } else {
    conflicts.push("Insecure HTTP protocol");
  }

  const official = isOfficialDomain(domain);
  if (official) {
    credibilitySignals.push("Recognized 1st-party official or governmental authority domain");
  }

  const tier2 = isTier2Domain(domain);
  if (tier2) {
    credibilitySignals.push("Recognized high-reputation developer or industry community");
  }

  const isSpam = isSpamDomain(domain);
  if (isSpam) {
    conflicts.push("Domain identified in spam / low-quality content network blacklist");
  }

  // Cross-reference with other sources if available
  if (input.knownSources && input.knownSources.length > 0) {
    const otherSources = input.knownSources.filter(s => s.url !== targetUrl);
    const domainOccurrences = input.knownSources.filter(s => {
      try {
        return new URL(s.url).hostname.replace(/^www\./, "") === domain;
      } catch {
        return false;
      }
    });

    if (domainOccurrences.length >= 2) {
      credibilitySignals.push(`Corroborated across ${domainOccurrences.length} references in search result pool`);
    }

    if (targetSource) {
      if (targetSource.engine) {
        credibilitySignals.push(`Indexed by search engine: ${targetSource.engine}`);
      }
    }
  }

  return {
    sourceId,
    accessible: !isSpam && isHttps,
    domain,
    isOfficial: official,
    credibilitySignals,
    conflicts: conflicts.length > 0 ? conflicts : undefined
  };
}
