/**
 * 统一搜索与信源判定策略 (Search & Evidence Policy)
 * ===================================================
 * 单一真理来源：所有层（SearXNG、SearchService、SearchTool、Codex Agent）只引用此策略，
 * 杜绝 7 / 12 / 14 / 16 / 3 等数字硬编码多处散落漂移。
 *
 * 核心设计原则：
 * 搜索结果天然存在网络与语料波动，目标并非"每次正好 N 条"，
 * 而是确保条数落在 [minSources, hardCap] 合理区间内；
 * 当条数不足时显式标记 insufficient: true 与差额 shortfall，由 Agent 依据意图自主决策是否继续补搜。
 */

export const SEARCH_POLICY = {
  /** 最小信源门槛：低于此值明确标记 insufficient: true，由 Agent 决定是否补检 */
  minSources: 7,
  /** 召回目标线：单次搜索向检索池索取的基准目标条数 */
  targetSources: 12,
  /** 单次 search_web 向下游返回的硬上限截断值 */
  hardCap: 16,
  /** 实体判定门槛：仅用于 hit / partial 级别判定 */
  minEvidenceHits: 3,
  /** 单次 Agent 会话内的最大搜索轮数，超出后停止循环并基于现有证据作答 */
  maxSearchRounds: 4
} as const;

export type SearchPolicy = typeof SEARCH_POLICY;
