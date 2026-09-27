export interface BrowserReadInput {
  url: string;
  maxChars?: number;
}

export interface BrowserReadOutput {
  url: string;
  success: boolean;
  content?: string;
  title?: string;
  error?: string;
}

/**
 * browser_read: 轻量页面文本抓取与可信摘录
 */
export async function browserTool(input: BrowserReadInput): Promise<BrowserReadOutput> {
  const url = input.url?.trim();
  if (!url || !url.startsWith("http")) {
    return {
      url: url || "",
      success: false,
      error: "Invalid URL protocol. Only HTTP/HTTPS URLs are supported."
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,text/plain"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        url,
        success: false,
        error: `HTTP error ${res.status}: ${res.statusText}`
      };
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "";

    // Strip scripts, styles, tags
    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const maxChars = input.maxChars || 4000;
    const truncated = cleanText.slice(0, maxChars);

    return {
      url,
      success: true,
      title,
      content: truncated
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      url,
      success: false,
      error: err.name === "AbortError" ? "Page fetch timed out (3.5s)" : (err.message || "Failed to fetch page")
    };
  }
}
