import { SearchResult, SearchHitLevel } from "../../src/types.js";
import { searchSearxng } from "../searxng.js";
import { rankSearchPools, RankingReport } from "../retrievalRanker.js";
import { SEARCH_POLICY } from "../searchPolicy.js";

/** 最小证据条数：低于此数视为实体证据不足（仅用于 hit/partial 判定）。 */
export const MIN_EVIDENCE_COUNT = SEARCH_POLICY.minEvidenceHits;

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
  const effectiveLimit = Math.min(options.limit ?? SEARCH_POLICY.targetSources, SEARCH_POLICY.hardCap);
  const raw = await searchSearxng(query, {
    customUrl: options.customUrl,
    language: options.language,
    env: options.env,
    resultTarget: effectiveLimit
  });
  const ranked = rankSearchPools([
    { source: "web_search", results: raw.results }
  ], {
    query,
    limit: effectiveLimit,
    recencyWindowDays: options.recencyDays,
    allowEncyclopedia: /维基|wikipedia|百科/i.test(query),
    filters: options.domains && options.domains.length > 0
      ? { includeDomains: options.domains }
      : undefined
  });

  const report = ranked.report;
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
    results: ranked.results,
    rawCount: raw.diagnostics.candidateCount,
    uniqueCount: raw.diagnostics.uniqueCount,
    query,
    sourceEngine: raw.instanceUsed,
    instancesUsed: raw.instancesUsed,
    rankingReport: ranked.report,
    diagnostics
  };
}
