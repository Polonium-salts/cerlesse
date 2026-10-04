import type { SearchResult } from "../../src/types.js";
import { isAdOrSpamResult, sanitizeAdPrefix } from "../searchFilters.js";

export interface UnrenderedContentSection {
  title: string;
  content: string;
}

/**
 * 保留接口类型，不追加伪造的模板小节
 */
export function buildUnrenderedSectionsForTypes(
  _types: string[],
  _query: string,
  _sources: SearchResult[]
): UnrenderedContentSection[] {
  return [];
}

/**
 * 清洗内部模型协议标签与泄漏的工具调用
 */
export function sanitizeAgentAnswer(answer: string): string {
  let clean = (answer || "")
    .replace(/<\|tool_call\|>[\s\S]*?<\|tool_call\|>/g, "")
    .replace(/<\|.*?\|>/g, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/\[TOOL_(REQUEST|CALL)\][\s\S]*?\[\/TOOL_\1\]/gi, "")
    .replace(/^call:[a-zA-Z0-9_]+\(\{[\s\S]*?\}\)\s*$/gm, "");

  // 严格清洗模型泄露的未受控工具交互转录与原始检索结果 JSON 块
  clean = clean.replace(/(?:^|\n)(?:Tool:\s*[a-zA-Z0-9_]+|Query:\s*[^\n]+|Language:\s*[^\n]+|Recency Days:\s*[^\n]+|Arguments:\s*\{[\s\S]*?\}|Result:\s*\{[\s\S]*?\})\s*(?=\n|$)/gi, "");
  clean = clean.replace(/search_web\s+query="[^"]*"[^\n]*/gi, "");
  clean = clean.replace(/\{\s*"results"\s*:\s*\[[\s\S]*?\]\s*\}/gi, "");

  return clean.trim();
}

const PLACEHOLDER_REGEX = /^(finished processing\.?|已完成检索并生成回答。?|正在生成.*|暂无回答.*|模型没有生成回答.*|暂无 AI 回答内容.*|暂无内容.*)$/i;

/**
 * 基于已检索到的真实信源，直接合成自然、事实驱动且严格标注 [1], [2] 引用的回答
 * 彻底过滤广告推广与虚假营销信息
 */
export function synthesizeAnswerFromSources(query: string, sources: SearchResult[] = []): string {
  if (!sources || sources.length === 0) {
    return "没有检索到可引用的来源，暂时无法回答这个问题。";
  }

  // 严格剔除广告与商业推广信源，绝不回退至广告源
  const cleanSources = sources.filter((s) => !isAdOrSpamResult(s));
  if (cleanSources.length === 0) {
    return `已检索到 ${sources.length} 条网页信息，但均检测为商业推广或广告内容，已为你主动过滤。请重新检索或直接浏览信源直达链接。`;
  }

  const top = cleanSources.slice(0, 6);
  const validSnippets = top
    .map((s, idx) => {
      const rawSnippet = (s.snippet || "").replace(/<[^>]*>/g, "").trim();
      const rawTitle = (s.title || "").replace(/<[^>]*>/g, "").trim();
      const cleanSnippet = sanitizeAdPrefix(rawSnippet);
      const cleanTitle = sanitizeAdPrefix(rawTitle);
      if (!cleanSnippet && !cleanTitle) return null;
      if (isAdOrSpamResult({ title: cleanTitle || rawTitle, snippet: cleanSnippet || rawSnippet, url: s.url })) {
        return null;
      }
      return {
        ref: idx + 1,
        title: cleanTitle || rawTitle,
        snippet: cleanSnippet || cleanTitle || rawSnippet,
        domain: s.displayDomain || s.engine || "权威信源"
      };
    })
    .filter(Boolean) as Array<{ ref: number; title: string; snippet: string; domain: string }>;

  if (validSnippets.length === 0) {
    return "已检索到相关来源，但暂无足够摘要内容生成回答。请点击下方信源直达查看详情。";
  }

  // 首句直出核心事实
  const primary = validSnippets[0];
  const lead = `${primary.snippet} [${primary.ref}]`;

  // 后续要点补充
  const additional = validSnippets.slice(1);
  if (additional.length === 0) {
    return lead;
  }

  const points = additional.map((item) => `- **${item.title}**：${item.snippet} [${item.ref}]`);
  return `${lead}\n\n${points.join("\n")}`;
}

/**
 * 确保模型回答生成有效：
 * 1. 若模型有实际输出，清洗协议标签后原样保留（无固定模板约束），杜绝广告文本混入；
 * 2. 若模型未输出、输出包含广告特征或仅输出占位语/无回答提示，基于检索到的权威信源自动合成直出回答与引用，绝不出现广告或空白。
 */
export function finalizeAnswer(answer: string, sources: SearchResult[] = [], query?: string): string {
  const clean = sanitizeAgentAnswer(answer);
  const isAd = isAdOrSpamResult({ title: clean, snippet: clean });
  if (
    clean &&
    !isAd &&
    !PLACEHOLDER_REGEX.test(clean) &&
    !clean.startsWith("模型没有生成回答") &&
    !clean.startsWith("暂无 AI 回答内容") &&
    !clean.startsWith("{") &&
    !clean.startsWith("search_web") &&
    !clean.startsWith("Tool:") &&
    !clean.includes('"results":')
  ) {
    return clean;
  }
  return synthesizeAnswerFromSources(query || "", sources);
}

/**
 * 兼容旧命名，直接调用 finalizeAnswer
 */
export function stabilizeAgentAnswer(
  query: string,
  answer: string,
  sources: SearchResult[],
  _unrenderedSections?: UnrenderedContentSection[]
): string {
  return finalizeAnswer(answer, sources, query);
}

/** 
 * 从完整回答中提取真实列表项作为要点：
 * 仅从回答中自发产出的列表项中提取。
 */
export function extractAgentTakeaways(answer: string, _sources: SearchResult[] = [], limit = 5): string[] {
  const clean = sanitizeAgentAnswer(answer);
  const bullets = clean.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$/gm) || [];
  const takeaways = bullets
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").replace(/\[\d+\]/g, "").trim())
    .filter(line => line.length > 2 && !line.startsWith("|"))
    .slice(0, limit);
  return takeaways;
}
