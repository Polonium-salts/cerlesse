import { SearchResult, SearchHitLevel } from "../../src/types.js";
import { searchSearxng } from "../searxng.js";
import { rankSearchPools, RankingReport } from "../retrievalRanker.js";

/** 最小证据条数基准：低于此数视为证据不足。 */
export const MIN_EVIDENCE_COUNT = 3;

export function resolveHitLevel(
  evidenceCount: number,
  minEvidence: number = MIN_EVIDENCE_COUNT
): SearchHitLevel {
  if (evidenceCount <= 0) return "no_hit";
  return evidenceCount < Math.max(1, minEvidence) ? "partial" : "hit";
}

export interface DirectSearchOptions {
  limit?: number;
  language?: string;
  domains?: string[];
  recencyDays?: number;
  customUrl?: string;
  env?: Record<string, string | undefined>;
}

export interface DirectSearchResult {
  results: SearchResult[];
  rawCount: number;
  uniqueCount: number;
  query: string;
  sourceEngine: string;
  instancesUsed: string[];
  rankingReport?: RankingReport;
  diagnostics: {
    candidateCount: number;
    uniqueCount: number;
    sourcesUsed: string[];
    sourcesAttempted: string[];
    fallbackUsed: boolean;
    fallbackAttempted: boolean;
    failures: string[];
    rankingRemoved: number;
    rankingReport?: RankingReport;
  };
}

/** 纯检索与重排服务：无 LLM 调用，且完整保留召回和排序诊断。 */
export async function executeWebSearch(
  query: string,
  options: DirectSearchOptions = {}
): Promise<DirectSearchResult> {
  const targetLimit = Math.max(16, options.limit ?? 16);
  const raw = await searchSearxng(query, {
    customUrl: options.customUrl,
    language: options.language,
    env: options.env,
    resultTarget: targetLimit
  });
  const ranked = rankSearchPools([
    { source: "web_search", results: raw.results }
  ], {
    query,
    limit: targetLimit,
    recencyWindowDays: options.recencyDays,
    allowEncyclopedia: /维基|wikipedia|百科/i.test(query),
    filters: options.domains && options.domains.length > 0
      ? { includeDomains: options.domains }
      : undefined
  });

  const report = ranked.report;
  const finalResults: SearchResult[] = [...ranked.results];
  if (finalResults.length < 7 && raw.results.length > 0) {
    const seenUrls = new Set(finalResults.map((r) => r.url));
    for (const item of raw.results) {
      if (finalResults.length >= targetLimit) break;
      if (!seenUrls.has(item.url) && item.title && item.url.startsWith("http")) {
        seenUrls.add(item.url);
        finalResults.push(item);
      }
    }
  }

  const rankingRemoved = report.hardRejected + report.userFiltered + report.belowQualityFloor +
    report.titleLevelRemoved + report.domainCapSkipped + report.capacitySkipped;
  const diagnostics = {
    candidateCount: raw.diagnostics.candidateCount,
    uniqueCount: raw.diagnostics.uniqueCount,
    sourcesUsed: raw.diagnostics.sourcesUsed,
    sourcesAttempted: raw.diagnostics.sourcesAttempted,
    fallbackUsed: raw.diagnostics.fallbackUsed,
    fallbackAttempted: raw.diagnostics.fallbackAttempted,
    failures: raw.diagnostics.failures,
    rankingRemoved,
    rankingReport: report
  };
  return {
    results: finalResults,
    rawCount: raw.diagnostics.candidateCount,
    uniqueCount: raw.diagnostics.uniqueCount,
    query,
    sourceEngine: raw.instanceUsed,
    instancesUsed: raw.instancesUsed,
    rankingReport: ranked.report,
    diagnostics
  };
}
