import {
  searchWebTool,
  searchImagesTool,
  sourceVerifyTool,
  getWidgetCatalogTool,
  prepareWidgetTool,
  solveLayoutTool,
  browserTool,
  repositoryTool,
  actionTool,
  SearchWebInput,
  SearchImagesInput,
  SourceVerifyInput,
  PrepareWidgetInput,
  SolveLayoutInput,
  BrowserReadInput,
  RepositoryInspectInput,
  CreateActionInput
} from "../tools/index.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const CERLESSE_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "search_web",
    description: "Search the web across independent backends. Returns source-traceable ranked results, raw/unique counts, sourcesAttempted versus sourcesUsed, fallbackAttempted versus fallbackUsed, failures, and ranking removal diagnostics. Send a focused 2-8 term query (subject plus the words that narrow it: official docs, comparison, error, latest) and drop conversational filler; set language and recencyDays whenever you know them, since they measurably improve precision. Run a narrower follow-up query instead of raising limit.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query string. Focused subject-first phrasing returns sharply better results than a full natural-language sentence." },
        limit: { type: "number", description: "Maximum number of ranked results to return (default: 12, max: 16)." },
        language: { type: "string", description: "Preferred language code (e.g. 'zh-CN', 'en')." },
        domains: { type: "array", items: { type: "string" }, description: "Strict domain whitelist." },
        recencyDays: { type: "number", description: "Recency scoring window in days." }
      },
      required: ["query"]
    }
  },
  {
    name: "search_images",
    description: "Retrieve relevant image assets and photos from multi-engine image backends.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Image search keywords." },
        limit: { type: "number", description: "Maximum number of images (default: 24)." },
        language: { type: "string", description: "Language code." }
      },
      required: ["query"]
    }
  },
  {
    name: "verify_source",
    description: "Verify the credibility, domain authority, protocol security, and conflicts of a search source or URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Target URL to inspect." },
        sourceId: { type: "string", description: "Optional sourceId from previous search result." }
      },
      required: ["url"]
    }
  },
  {
    name: "get_widget_catalog",
    description: "Inspect all available UI widgets and capabilities registered in the Cerlesse Widget Registry.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "prepare_widget",
    description: "Prepare and instantiate a registered UI widget with verified source evidence and structured parameters.",
    inputSchema: {
      type: "object",
      properties: {
        widgetId: { type: "string", description: "Unique widget identifier registered in catalog." },
        query: { type: "string", description: "User query associated with this widget." },
        sourceIds: { type: "array", items: { type: "string" }, description: "Evidence source IDs cited by this widget." },
        params: { type: "object", description: "Structured data parameters passed to the widget." }
      },
      required: ["widgetId", "query"]
    }
  },
  {
    name: "solve_layout",
    description: "Calculate optimal 12-column grid packing, tile widths, row spans, and reading order for chosen widgets. Cannot add or remove widgets. Accepts layoutIntent or widgetIds list.",
    inputSchema: {
      type: "object",
      properties: {
        widgetIds: { type: "array", items: { type: "string" }, description: "List of widget IDs to lay out on desktop." },
        emphasizedWidgetId: { type: "string", description: "Widget ID that should receive focal prominence." },
        widgetWidths: { type: "object", description: "Map of widgetId to canonical width percentage (25, 50, 75, 100)." },
        layoutIntent: {
          type: "object",
          description: "Declarative semantic layout intent (focusWidgetId, widgets with roles and canonical widths 25/50/75/100, relations, constraints).",
          properties: {
            focusWidgetId: { type: "string" },
            primaryWidgets: { type: "array", items: { type: "string" } },
            secondaryWidgets: { type: "array", items: { type: "string" } },
            widgets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  role: { type: "string", enum: ["hero", "primary", "secondary", "supporting", "utility"] },
                  widthPercent: { type: "number", enum: [25, 50, 75, 100] },
                  priority: { type: "number" },
                  group: { type: "string" }
                },
                required: ["id"]
              }
            },
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: { type: "string" },
                  target: { type: "string" },
                  type: { type: "string", enum: ["prefer_adjacent", "prefer_same_row", "prefer_below", "prefer_above", "avoid_adjacent", "group"] },
                  weight: { type: "number" }
                },
                required: ["source", "target", "type"]
              }
            }
          }
        },
        totalColumns: { type: "number", description: "Desktop grid columns (default: 12)." },
        containerWidth: { type: "number", description: "Physical container width in pixels (default: 1280)." }
      }
    }
  },
  {
    name: "browser_read",
    description: "Fetch and extract text content from an accessible web page URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Web page URL to fetch." },
        maxChars: { type: "number", description: "Maximum text characters to extract (default: 4000)." }
      },
      required: ["url"]
    }
  },
  {
    name: "inspect_repository",
    description: "Inspect GitHub open-source repository metadata (stars, forks, description, license).",
    inputSchema: {
      type: "object",
      properties: {
        repoPathOrUrl: { type: "string", description: "Repository in 'owner/repo' format or full GitHub URL." }
      },
      required: ["repoPathOrUrl"]
    }
  },
  {
    name: "create_action",
    description: "Create a verified action button (official portal, software download, copy command, open docs/demo, navigate).",
    inputSchema: {
      type: "object",
      properties: {
        capability: {
          type: "string",
          enum: ["official_url", "download", "copy_text", "open_docs", "open_demo", "navigate"],
          description: "Action capability type."
        },
        label: { type: "string", description: "Button label." },
        url: { type: "string", description: "Target URL (for official_url, download, open_docs, open_demo)." },
        command: { type: "string", description: "Shell/package command (for copy_text)." },
        targetWidget: { type: "string", description: "Widget ID (for navigate)." },
        description: { type: "string", description: "Optional description tooltip." }
      },
      required: ["capability", "label"]
    }
  }
];

export interface McpCallContext {
  customSearxngUrl?: string;
  env?: Record<string, string | undefined>;
  knownSources?: any[];
}

/**
 * Cerlesse In-Process MCP Tool Server
 */
export class CerlesseMcpServer {
  public getTools(): McpToolDefinition[] {
    return CERLESSE_MCP_TOOLS;
  }

  public async callTool(name: string, args: Record<string, any>, context: McpCallContext = {}): Promise<any> {
    switch (name) {
      case "search_web":
        return await searchWebTool(args as SearchWebInput, {
          customSearxngUrl: context.customSearxngUrl,
          env: context.env
        });

      case "search_images":
        return await searchImagesTool(args as SearchImagesInput, {
          customSearxngUrl: context.customSearxngUrl,
          env: context.env
        });

      case "verify_source":
        return await sourceVerifyTool({
          ...(args as SourceVerifyInput),
          knownSources: context.knownSources
        });

      case "get_widget_catalog":
        return getWidgetCatalogTool();

      case "prepare_widget":
        return prepareWidgetTool(args as PrepareWidgetInput);

      case "solve_layout":
        return solveLayoutTool(args as SolveLayoutInput);

      case "browser_read":
        return await browserTool(args as BrowserReadInput);

      case "inspect_repository":
        return await repositoryTool(args as RepositoryInspectInput);

      case "create_action":
        return actionTool(args as CreateActionInput);

      default:
        throw new Error(`MCP tool not found: ${name}`);
    }
  }
}

export const cerlesseMcpServer = new CerlesseMcpServer();
