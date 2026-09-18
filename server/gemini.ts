import { GoogleGenAI } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== "" && apiKey !== "MY_GEMINI_API_KEY") {
      geminiClient = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return geminiClient;
}

export async function callGeminiChat(options: {
  messages: Array<{ role: string; content: string }>;
  responseFormatJson?: boolean;
  timeoutMs?: number;
  temperature?: number;
}): Promise<string | null> {
  const client = getGeminiClient();
  if (!client) return null;

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 3500;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const systemMessage = options.messages.find((m) => m.role === "system");
    const contents = options.messages
      .filter((m) => m.role !== "system")
      .map((m) => m.content)
      .join("\n\n");

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: contents || "Execute the requested analysis and output the result.",
      config: {
        systemInstruction: systemMessage?.content,
        temperature: options.temperature ?? 0.2,
        responseMimeType: options.responseFormatJson ? "application/json" : undefined,
      },
    });

    clearTimeout(timeoutId);
    return response.text?.trim() || null;
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}
