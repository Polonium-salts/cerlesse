import type { SearchResult } from "../../src/types.js";

/** Add a compact, source-grounded evidence section to terse or placeholder Agent answers. */
export function stabilizeAgentAnswer(query: string, answer: string, sources: SearchResult[]): string {
  const cleanAnswer = (answer || "").trim();
  const isPlaceholder = /^(finished processing\.?|已完成检索并生成回答。?|正在生成.*)$/i.test(cleanAnswer);
  const paragraphs = cleanAnswer.split(/\n\s*\n/).filter(Boolean);
  if (!isPlaceholder && cleanAnswer.length >= 180 && paragraphs.length >= 2) return cleanAnswer;

  const evidence = (sources || []).slice(0, 3).map((source, index) => {
    const title = (source.title || "相关来源").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
    const snippet = (source.snippet || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 360);
    return `- **${title || "相关来源"}**${snippet ? `：${snippet}` : "（来源页面可供进一步核验）"} [${index + 1}]`;
  });
  const lead = isPlaceholder ? "" : cleanAnswer;
  const evidenceSection = evidence.length > 0
    ? `### 检索证据与来源\n\n${evidence.join("\n")}`
    : "### 证据状态\n\n目前没有可引用的检索来源，因此无法据此补充经核实的结论。";
  return [lead, `## 关于「${(query || "本次问题").trim()}」`, evidenceSection].filter(Boolean).join("\n\n");
}

/** Extract common Markdown bullets; if absent, use only actual search titles/snippets. */
export function extractAgentTakeaways(answer: string, sources: SearchResult[], limit = 5): string[] {
  const bullets = (answer || "").match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$/gm) || [];
  const takeaways = bullets
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
  if (takeaways.length > 0) return takeaways;

  return (sources || []).slice(0, limit).map((source) => {
    const snippet = (source.snippet || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const title = (source.title || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    return snippet || title;
  }).filter(Boolean);
}
