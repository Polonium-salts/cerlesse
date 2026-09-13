/**
 * 摘要文本提炼工具 (Summary Text Extractors)
 * ============================================================
 * 小组件消费的 `summary` 是带内嵌引用的 Markdown，无法直接作为要点条目展示。
 * 这里提供一组纯函数，把 Markdown 归一为可读的纯文本与句子/条目数组，
 * 供 takeaways 等提炼型组件复用（浏览器原生 RegExp，无第三方依赖）。
 */

/** 把 Markdown 归一为单行纯文本：去代码块、标题行、链接语法与行首列表标记，压缩空白 */
export function toPlainText(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}.*$/gm, " ")
    .replace(/^\s{0,3}(>|[-*+]|\d+\.)\s+/gm, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 按中英文终止标点切句，过滤过短碎片并限制条数（不使用 lookbehind，兼容性更广） */
export function splitSentences(markdown: string, limit: number): string[] {
  const plain = toPlainText(markdown);
  if (!plain) return [];
  const chunks = plain.match(/[^。！？.!?]+[。！？.!?]?/g) || [];
  return chunks
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .slice(0, limit);
}
