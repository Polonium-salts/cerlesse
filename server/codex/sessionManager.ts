import { SearchResult } from "../../src/types.js";
import { PreparedWidgetOutput } from "../tools/widgetTool.js";
import { SolveLayoutOutput } from "../tools/layoutTool.js";
import { normalizeUrlKey } from "../retrievalRanker.js";
import { generateStableSourceId } from "../searxng.js";

export interface MessageTurn {
  role: "user" | "assistant" | "tool";
  content?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  timestamp: number;
}

export interface CodexSession {
  threadId: string;
  createdAt: number;
  lastActiveAt: number;
  query: string;
  turns: MessageTurn[];
  collectedSources: SearchResult[];
  preparedWidgets: PreparedWidgetOutput[];
  layout?: SolveLayoutOutput;
}

/**
 * CodexSessionManager: 管理 Agent Thread 状态
 */
export class CodexSessionManager {
  private sessions: Map<string, CodexSession> = new Map();
  private maxSessions = 100;

  public createSession(query: string, customThreadId?: string): CodexSession {
    const threadId = customThreadId || `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const session: CodexSession = {
      threadId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      query,
      turns: [
        {
          role: "user",
          content: query,
          timestamp: Date.now()
        }
      ],
      collectedSources: [],
      preparedWidgets: []
    };

    if (this.sessions.size >= this.maxSessions) {
      // Evict oldest session
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey) this.sessions.delete(oldestKey);
    }

    this.sessions.set(threadId, session);
    return session;
  }

  public getSession(threadId: string): CodexSession | undefined {
    return this.sessions.get(threadId);
  }

  public addTurn(threadId: string, turn: MessageTurn): void {
    const s = this.sessions.get(threadId);
    if (s) {
      s.turns.push(turn);
      s.lastActiveAt = Date.now();
    }
  }

  public recordSources(threadId: string, sources: SearchResult[]): void {
    const s = this.sessions.get(threadId);
    if (s) {
      const seenKeys = new Set(s.collectedSources.map(x => normalizeUrlKey(x.url || x.id || "")));
      for (const item of sources) {
        if (!item.url) continue;
        const normKey = normalizeUrlKey(item.url);
        if (!seenKeys.has(normKey)) {
          seenKeys.add(normKey);
          const ref = s.collectedSources.length + 1;
          const stableItem: SearchResult = {
            ...item,
            id: item.id || generateStableSourceId(item.url),
            ref
          };
          s.collectedSources.push(stableItem);
        }
      }
    }
  }

  public recordWidget(threadId: string, widget: PreparedWidgetOutput): void {
    const s = this.sessions.get(threadId);
    if (s && widget.success) {
      const idx = s.preparedWidgets.findIndex(w => w.widgetId === widget.widgetId);
      if (idx >= 0) {
        s.preparedWidgets[idx] = widget;
      } else {
        s.preparedWidgets.push(widget);
      }
    }
  }

  public addSources(threadId: string, sources: SearchResult[]): void {
    this.recordSources(threadId, sources);
  }

  public addWidget(threadId: string, widget: PreparedWidgetOutput): void {
    this.recordWidget(threadId, widget);
  }

  public recordLayout(threadId: string, layout: SolveLayoutOutput): void {
    const s = this.sessions.get(threadId);
    if (s) {
      s.layout = layout;
    }
  }
}

export const sessionManager = new CodexSessionManager();
