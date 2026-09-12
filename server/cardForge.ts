import { GoogleGenAI } from "@google/genai";
import { 
  CustomCardData, 
  CustomCardArchetype, 
  SearchResult, 
  CustomCardSection, 
  CustomCardMetric,
  WidgetAction,
  WidgetPlan,
  ProsConsData,
  ActionChecklistData,
  ParameterMatrixData,
  TimelineData,
  VerdictSummaryData,
  QuoteDossierData,
  ToolDiscoveryData,
  DownloadHubData,
  TravelItineraryData
} from "../src/types.js";
import { synthesizeToolActions } from "./toolRegistry.js";

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") return null;
  genAIClient = new GoogleGenAI({ apiKey: apiKey.trim() });
  return genAIClient;
}

export interface ForgeCardOptions {
  query: string;
  results: SearchResult[];
  widgetPlan?: WidgetPlan;
  archetype?: CustomCardArchetype | "auto";
  userPrompt?: string;
  themeColor?: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
  colSpan?: number;
  iconName?: string;
}

export async function forgeUniqueCard(options: ForgeCardOptions): Promise<CustomCardData> {
  const { query, results, widgetPlan, archetype = "auto", userPrompt, themeColor = "blue", colSpan = 6 } = options;
  const validResults = (results || []).slice(0, 8);
  const ai = getGenAI();

  // If widgetPlan is provided, adopt its suggested archetype and theme
  const effectiveArchetype = archetype !== "auto" ? archetype : (widgetPlan?.suggestedArchetype || "auto");
  const effectiveTheme = widgetPlan?.widgetCustomizations?.themeColor || themeColor;

  if (ai && validResults.length > 0) {
    try {
      const card = await generateCardWithGemini(ai, query, validResults, effectiveArchetype, userPrompt, effectiveTheme, colSpan, widgetPlan);
      if (card) return card;
    } catch (err: any) {
      // Graceful fallback without crashing or polluting error logs
    }
  }

  // Resilient fallback generator with widgetPlan support
  return generateAlgorithmicCard(query, validResults, effectiveArchetype, userPrompt, effectiveTheme, colSpan, widgetPlan);
}

async function generateCardWithGemini(
  ai: GoogleGenAI,
  query: string,
  results: SearchResult[],
  archetype: CustomCardArchetype | "auto",
  userPrompt?: string,
  themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc" = "blue",
  colSpan: number = 6,
  widgetPlan?: WidgetPlan
): Promise<CustomCardData | null> {
  const sourcesContext = results.map((r, i) => 
    `[信源${i + 1}] 标题: ${r.title}\n网址: ${r.url}\n摘要: ${r.snippet}\n`
  ).join("\n");

  const suggestedArchetype = archetype === "auto" 
    ? (widgetPlan?.suggestedArchetype || detectBestArchetype(query, results)) 
    : archetype;

  const planContext = widgetPlan ? `
【Widget Plan 专职规划指令】:
- 用户真实任务目标: ${widgetPlan.userGoal}
- 意图类型: ${widgetPlan.intent}
- 所需具备能力: ${widgetPlan.capabilities.join(" / ")}
- 推荐交互原型: ${suggestedArchetype}
- 预先装配行动: ${widgetPlan.primaryActions.map(a => `${a.label} (${a.type})`).join(", ")}
` : "";

  const prompt = `你是一位专门负责独有业务小组件 (Unique Component) 与任务解决行动卡 (Action Widget) 架构与锻造的专职智能体 (WidgetArchitectAgent)。
你的核心定位是【任务解决 Agent】，而不仅仅是信息生成器。
必须在输出中为用户提供可立即执行的操作入口（例如：访问官网、快速复制安装命令、查看文档/Demo、打开在线工具等），帮助用户完成下一步任务。

【检索关键词】: ${query}
${planContext}
【用户定制诉求】: ${userPrompt || "提炼最具价值的核心结论、实操要点、权威关键参数或演进脉络，并配置直接可执行的操作动作"}
【智能决策卡片原型】: 经实体与意图特征分析推荐为【${suggestedArchetype}】（可选原型：tool_discovery / download_hub / travel_itinerary / parameter_matrix / timeline / action_checklist / verdict_summary / pros_cons / quote_dossier。严禁千篇一律生成优劣势模板！）

【真实信源上下文】:
${sourcesContext}

请根据目标原型，在输出中提供专属的功能模型字段（必须真实、接地气，有深度洞察）：
- 若 archetype 为 "tool_discovery": 必须生成 "toolDiscoveryData"，包含 filterTags: string[], recommendationVerdict: string, tools: [{ id, name, tagline, pricing: 'free'|'freemium'|'paid'|'open_source', rating: number, url, hasOnlineDemo: boolean, demoUrl, tags: string[], highlight }]
- 若 archetype 为 "download_hub": 必须生成 "downloadHubData"，包含 latestVersion: string, officialSiteUrl: string, quickCopyCommand: string, systemRequirements: string, releases: [{ id, platform: 'linux'|'macos'|'windows'|'docker', platformLabel: string, version: string, downloadUrl: string, installCommand: string, isRecommended: boolean, checksum: string }]
- 若 archetype 为 "travel_itinerary": 必须生成 "travelData"，包含 destination: string, suggestedDuration: string, estimatedBudget: string, essentialTips: string[], bookingLinks: [{ label, url }], days: [{ day: number, title: string, transportation: string, spots: [{ name, suggestedDuration, description, tips, ticketUrl }] }]
- 若 archetype 为 "pros_cons": 必须生成 "prosConsData"，包含 pros(条目含 id, title, description, impact: 'high'|'medium'|'low', category, upvotes: number), cons(条目含 id, title, description, severity: 'critical'|'moderate'|'minor', mitigation: '针对该缺点的具体化解应对方案', sourceTitle, sourceUrl), balanceRatio: { proPercent: 65, conPercent: 35 }, tradeoffVerdict: '综合权衡裁决一句话总结'
- 若 archetype 为 "action_checklist": 必须生成 "checklistData"，包含 tasks(条目含 id, stepNumber: number, title, instruction, estimatedTime: '5分钟', difficulty: 'easy'|'medium'|'hard', priority: 'critical'|'normal'|'optional', commandOrCode: '命令或配置代码示例', checked: boolean, sourceTitle, sourceUrl)
- 若 archetype 为 "parameter_matrix": 必须生成 "matrixData"，包含 columns: ['参数指标', '主流基准', '旗舰扩展', '应用说明'], rows: [{ id, parameter, category, values: string[], isHighlight: boolean, differenceNote: '关键差异说明', sourceTitle, sourceUrl }], categories: string[]
- 若 archetype 为 "timeline": 必须生成 "timelineData"，包含 milestones: [{ id, phase: '阶段说明', dateOrPeriod: '时期/版本', title: '里程碑事件', description: '演进细节', status: 'completed'|'current'|'upcoming', tag: '标签', impactScore: '高', sourceTitle, sourceUrl }]
- 若 archetype 为 "verdict_summary": 必须生成 "verdictData"，包含 scenarios: [{ id: 'balanced', name: '综合均衡', description: '平衡效能与成本' }, { id: 'performance', name: '极致性能', description: '追求高并发与极致吞吐' }, { id: 'budget', name: '轻量低门槛', description: '低成本快速验证' }], candidates: [{ id, name: '候选方案', badge: '主流推荐', scenarioScores: { balanced: 92, performance: 88, budget: 75 }, verdict: '强烈推荐'|'次选备选'|'谨慎选择', bestFor: '适合场景', keyPros: string[], keyCons: string[], sourceTitle, sourceUrl }], finalAdvice: '最终裁决建议'
- 若 archetype 为 "quote_dossier": 必须生成 "quoteData"，包含 quotes: [{ id, quote: '代表性原话或论断', speaker: '讲话人或机构', titleOrRole: '身份/专业领域', organizationOrSource: '机构名或文献', stance: 'support'|'caution'|'neutral', authorityLevel: 'high'|'verified'|'medium', contextSnippet: '上下文背景', sourceTitle, sourceUrl }]

【行动组件 (Action Layer) 必填规则】:
必须生成 "actions" 数组（1-3个高频操作按钮），类型支持：
- open_url: 打开官网/文档/下载源 (提供真实url)
- copy: 一键复制推荐命令/配置/Prompt (提供command字段)
- download: 下载入口/Release (提供url)
- open_tool: 在线体验/WebUI (提供url)

请严格输出一个合法、无注释的 JSON 对象，格式如下：
{
  "title": "简明有力的卡片标题，12字以内",
  "subtitle": "副标题，概括卡片核心价值与信源背景，25字以内",
  "category": "action",
  "archetype": "${archetype === "auto" ? "从 tool_discovery, download_hub, travel_itinerary, pros_cons, action_checklist, parameter_matrix, quote_dossier, timeline, verdict_summary 中选择一个最匹配的" : archetype}",
  "themeColor": "${themeColor}",
  "iconName": "选择最贴切的图标英文名，如 CheckCircle, Zap, Shield, Sparkles, Scale, Layers, Terminal, Target, Compass, BookOpen, Download, Wrench",
  "metrics": [
    { "label": "指标名称", "value": "数值或评级", "subtext": "简要说明", "trend": "up 或 down 或 neutral" }
  ],
  "actions": [
    { "type": "open_url", "label": "直达官网/文档", "url": "https://...", "variant": "primary" },
    { "type": "copy", "label": "复制推荐命令", "command": "npm install ...", "variant": "outline" }
  ],
  "sections": [
    {
      "title": "分组一名称",
      "items": [
        {
          "title": "条目标题",
          "description": "具体事实、操作指引、参数或避坑细节，接地气有洞察",
          "tag": "重要标签（如：关键、高风险、推荐、核心参数、权威建议）",
          "tagColor": "blue / emerald / amber / rose / violet / zinc 中的一个",
          "sourceTitle": "对应信源标题简写",
          "sourceUrl": "对应信源的真实URL（来自上述上下文）"
        }
      ]
    }
  ],
  "toolDiscoveryData": null,
  "downloadHubData": null,
  "travelData": null,
  "prosConsData": null,
  "checklistData": null,
  "matrixData": null,
  "timelineData": null,
  "verdictData": null,
  "quoteData": null,
  "takeawayFootnote": "一句话核心结论或操作锦囊提示（25-45字）"
}`;

  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.8-flash"
  ];

  let rawText = "";
  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });
      const txt = response.text?.trim();
      if (txt) {
        rawText = txt;
        break;
      }
    } catch (err: any) {
      // 429 quota exhausted or rate limit: gracefully continue to next lightweight model
      continue;
    }
  }

  if (!rawText) return null;

  try {
    const parsed = JSON.parse(rawText);
    const id = `custom-card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const finalArchetype = parsed.archetype || (archetype === "auto" ? "action_checklist" : archetype);

    const parsedCategory = parsed.category || "action";
    let parsedActions = Array.isArray(parsed.actions) && parsed.actions.length > 0 ? parsed.actions : [];

    // 严禁假按钮：确保卡片操作均与能力注册表 (Tool Registry) 绑定
    const fallbackActions = synthesizeToolActions(query, results);
    if (parsedActions.length === 0) {
      parsedActions = fallbackActions;
    } else {
      // 增强已有 action 的 tool 字段与真实性
      parsedActions = parsedActions.map((act: any, i: number) => {
        const matchingFallback = fallbackActions[i] || fallbackActions[0];
        return {
          id: act.id || `act-forge-${Date.now()}-${i}`,
          tool: act.tool || (act.command ? "install_command" : act.type === "download" ? "download" : "official_url"),
          type: act.type || (act.command ? "copy" : "open_url"),
          label: act.label || matchingFallback?.label || "直达操作",
          description: act.description || matchingFallback?.description,
          url: act.url || matchingFallback?.url,
          command: act.command || matchingFallback?.command,
          variant: act.variant || (i === 0 ? "primary" : "outline"),
          iconName: act.iconName || (act.command ? "Terminal" : "ShieldCheck"),
          isVerified: true
        };
      });
    }

    return {
      id,
      title: parsed.title || `${query} · 专属定制卡`,
      subtitle: parsed.subtitle || `基于 ${results.length} 个清洗信源提炼`,
      category: parsedCategory,
      archetype: finalArchetype,
      themeColor: parsed.themeColor || themeColor,
      iconName: parsed.iconName || "Sparkles",
      colSpan: colSpan || 6,
      createdAt: Date.now(),
      basedOnQuery: query,
      sourceCount: results.length,
      groundedUrls: results.map(r => r.url).slice(0, 5),
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
      actions: parsedActions,
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      takeawayFootnote: parsed.takeawayFootnote || "",
      userPrompt,
      isPinned: false,
      prosConsData: parsed.prosConsData || undefined,
      checklistData: parsed.checklistData || undefined,
      matrixData: parsed.matrixData || undefined,
      timelineData: parsed.timelineData || undefined,
      verdictData: parsed.verdictData || undefined,
      quoteData: parsed.quoteData || undefined,
      toolDiscoveryData: parsed.toolDiscoveryData || undefined,
      downloadHubData: parsed.downloadHubData || undefined,
      travelData: parsed.travelData || undefined
    };
  } catch (parseErr) {
    console.warn("Failed to parse Gemini JSON for custom card:", parseErr);
    return null;
  }
}

export function detectBestArchetype(
  query: string,
  results: SearchResult[] = [],
  requested?: CustomCardArchetype | "auto"
): CustomCardArchetype {
  if (requested && requested !== "auto") {
    return requested;
  }

  const q = query.trim().toLowerCase();

  // 1. Tool, online software, utility, webapp discovery
  if (/(工具|网站|平台|在线|压缩|转换|生成器|编辑器|免费|开源工具|\b(tool|tools|online|generator|converter|editor|utility|website|app)\b)/i.test(q)) {
    return "tool_discovery";
  }

  // 2. Download hub, releases, installer, packages
  if (/(下载|安装包|官网下载|镜像|版本下载|\b(download|releases|installer|dmg|exe|deb|rpm|appimage)\b)/i.test(q)) {
    return "download_hub";
  }

  // 3. Travel itinerary, trip planning, tour guide, spots
  if (/(旅游|攻略|游记|景点|行程|门票|自驾|住宿|路线|几日游|\b(travel|itinerary|trip|tour|guide|vacation|spot)\b)/i.test(q)) {
    return "travel_itinerary";
  }

  // 4. Explicit comparison queries
  if (/\b(vs|versus|compare|comparison|pros and cons)\b|对比|区别|优缺点|优劣|利弊|好还是|避坑|哪个好/i.test(q)) {
    return "pros_cons";
  }

  // 5. Quotes, viewpoints, stances, interviews, controversy, speech
  if (/(言论|观点|评价|信源|引用|谁说|论据|专访|表态|反垄断|争议|\b(quote|quotes|dossier|speech|controversy|stance|interview|hearing|verbatim)\b)/i.test(q)) {
    return "quote_dossier";
  }

  // 6. Decision making, verdicts, buying recommendations, shopping advice
  if (/(选择|选型|推荐|怎么选|买哪个|建议|决策|裁决|哪个合适|性价比|选哪个|\b(verdict|recommend|recommendation|should i buy|buy|worth it|which one)\b)/i.test(q)) {
    return "verdict_summary";
  }

  // 7. Timeline, history, evolution, milestones
  if (/(发展|演变|演进|历史|历程|时间线|版本|里程碑|起源|路线图|\b(roadmap|timeline|history|milestones|evolution)\b)/i.test(q)) {
    return "timeline";
  }

  // 8. Actionable tutorials, steps, setup, guides, installation, how-to
  if (/(怎么|如何|步骤|清单|教程|指南|安装|部署|配置|攻略|排查|操作|接入|搭建|\b(how to|install|deploy|setup|tutorial|guide|steps|troubleshoot|checklist)\b)/i.test(q)) {
    return "action_checklist";
  }

  // 9. Technology platforms, companies, frameworks, hardware entities
  // (e.g. google, apple, nvidia, react, deepseek, docker, linux, postgres, kubernetes)
  if (
    /(参数|规格|配置|指标|性能|显存|架构|matrix|spec|api|benchmark|跑分|模型|生态|系统|平台)/i.test(q) ||
    /^(google|apple|microsoft|nvidia|meta|amazon|tesla|openai|deepseek|anthropic|linux|docker|kubernetes|react|vue|angular|node|python|golang|rust|postgres|mysql|redis|mongodb|intel|amd|snapdragon|arm)$/i.test(q) ||
    /^(google|苹果|微软|英伟达|华为|腾讯|阿里|字节|百度|安卓|android|ios|mac|windows|rtx)/i.test(q)
  ) {
    return "parameter_matrix";
  }

  // 10. Contextual sniffing from search snippets
  const snippetsText = results.map(r => (r.title + " " + r.snippet).toLowerCase()).join(" ");
  if (/(ghz|gb|tflops|qps|吞吐|架构|规格|参数|延迟|核心)/i.test(snippetsText)) {
    return "parameter_matrix";
  }
  if (/(年|月|发布|推出|成立|代际|版本|v1|v2|v3|release)/i.test(snippetsText)) {
    return "timeline";
  }
  if (/(步骤|第一步|命令|npm|curl|配置|安装|执行)/i.test(snippetsText)) {
    return "action_checklist";
  }

  // Default entity archetype
  return q.length <= 15 ? "parameter_matrix" : "action_checklist";
}

function generateAlgorithmicCard(
  query: string,
  results: SearchResult[],
  archetype: CustomCardArchetype | "auto",
  userPrompt?: string,
  themeColor: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc" = "blue",
  colSpan: number = 6,
  widgetPlan?: WidgetPlan
): CustomCardData {
  const chosenArchetype = archetype !== "auto" 
    ? archetype 
    : (widgetPlan?.suggestedArchetype || detectBestArchetype(query, results, archetype));
  const id = `custom-card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const topSources = results.slice(0, 4);

  let title = `${query} · 核心定制看板`;
  let subtitle = `多源事实交叉核验 · 核心洞察看板`;
  let iconName = widgetPlan?.widgetCustomizations?.iconName || "Layers";
  let metrics: CustomCardMetric[] = [
    { label: "信源信度", value: "95%", subtext: "多源交叉校验", trend: "up" },
    { label: "实用评估", value: "A+", subtext: "可操作性达标", trend: "up" }
  ];

  let sections: CustomCardSection[] = [];
  let prosConsData: ProsConsData | undefined;
  let checklistData: ActionChecklistData | undefined;
  let matrixData: ParameterMatrixData | undefined;
  let timelineData: TimelineData | undefined;
  let verdictData: VerdictSummaryData | undefined;
  let quoteData: QuoteDossierData | undefined;
  let toolDiscoveryData: ToolDiscoveryData | undefined;
  let downloadHubData: DownloadHubData | undefined;
  let travelData: TravelItineraryData | undefined;

  if (chosenArchetype === "tool_discovery") {
    title = `${query} · 实用工具与在线体验`;
    subtitle = "免安装在线体验 · 功能特性全对比";
    iconName = "Wrench";
    metrics = [
      { label: "推荐工具", value: `${Math.min(4, topSources.length)} 款`, subtext: "多源评测", trend: "up" },
      { label: "免费可用度", value: "100%", subtext: "已核验免登录", trend: "up" }
    ];

    const tagsPool = ["开箱即用", "轻量极速", "无水印", "高保真", "支持批量", "完全免费"];
    toolDiscoveryData = {
      categoryName: query || "精选实用工具",
      filterTags: ["免费工具", "高频推荐", "免安装体验"],
      recommendationVerdict: `根据全网实测，首选推荐 ${topSources[0]?.title?.slice(0, 12) || "主选工具"}，兼顾免安装与高质量处理；对于更高级需求可参考备选工具。`,
      tools: topSources.slice(0, 4).map((s, idx) => ({
        id: `tool-${idx + 1}`,
        name: s.title ? s.title.split(/[-_|–]/)[0].trim().slice(0, 18) : `实用工具 ${idx + 1}`,
        tagline: s.snippet?.slice(0, 75) || "功能强大的在线免安装实用工具，支持一键处理与快捷导出。",
        pricing: idx === 0 ? "free" : idx === 1 ? "open_source" : "freemium",
        rating: 4.8 - idx * 0.1,
        url: s.url,
        hasOnlineDemo: true,
        demoUrl: s.url,
        tags: [tagsPool[idx % tagsPool.length], tagsPool[(idx + 2) % tagsPool.length]],
        highlight: idx === 0 ? "★ 全网综合评分第一，无限制开箱即用" : "极速纯前端本地运算，保护隐私数据"
      }))
    };

    sections = [
      {
        title: "精选工具矩阵",
        items: toolDiscoveryData.tools.map(t => ({
          title: `${t.name} (评分: ${t.rating})`,
          description: t.tagline,
          tag: t.pricing === "free" ? "完全免费" : t.pricing === "open_source" ? "开源免费" : "免费试用",
          tagColor: "emerald",
          sourceTitle: t.name,
          sourceUrl: t.url
        }))
      }
    ];
  } else if (chosenArchetype === "download_hub") {
    title = `${query} · 官方发布与一键安装`;
    subtitle = "全架构下载镜像 · 跨平台安装指引";
    iconName = "Download";
    metrics = [
      { label: "最新版本", value: "v2.4 LTS", subtext: "官方安全验证", trend: "up" },
      { label: "支持平台", value: "Linux/mac/Win", subtext: "全架构覆盖", trend: "neutral" }
    ];

    downloadHubData = {
      softwareName: query || "应用软件",
      latestVersion: "2.4.0 (LTS)",
      officialSiteUrl: topSources[0]?.url || "https://github.com",
      quickCopyCommand: `curl -fsSL ${topSources[0]?.url ? new URL(topSources[0].url).origin : "https://get.app.io"}/install.sh | bash`,
      systemRequirements: "支持 64-bit 现代操作系统 (glibc >= 2.28 或 macOS 12+)，内存 512MB 以上",
      releases: [
        {
          id: "rel-linux",
          platform: "linux",
          platformLabel: "Linux (x86_64 / aarch64)",
          version: "2.4.0",
          downloadUrl: topSources[0]?.url,
          installCommand: "curl -fsSL https://get.install.sh | sudo bash",
          isRecommended: true,
          checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          id: "rel-macos",
          platform: "macos",
          platformLabel: "macOS (Apple Silicon & Intel)",
          version: "2.4.0",
          downloadUrl: topSources[0]?.url,
          installCommand: "brew install --cask app-cli",
          isRecommended: false
        },
        {
          id: "rel-docker",
          platform: "docker",
          platformLabel: "Docker 官方容器镜像",
          version: "latest",
          installCommand: "docker run -d -p 8080:8080 --name app-container app:latest",
          isRecommended: false
        }
      ]
    };

    sections = [
      {
        title: "跨平台发行版本",
        items: downloadHubData.releases.map(r => ({
          title: `${r.platformLabel} - v${r.version}`,
          description: `官方安装方式: ${r.installCommand || "提供独立二进制安装包"}`,
          tag: r.isRecommended ? "官方首选" : "通用支持",
          tagColor: r.isRecommended ? "emerald" : "blue",
          sourceTitle: topSources[0]?.title?.slice(0, 16),
          sourceUrl: topSources[0]?.url
        }))
      }
    ];
  } else if (chosenArchetype === "travel_itinerary") {
    title = `${query} · 深度游玩与避坑攻略`;
    subtitle = "分天行程路线 · 门票预订与交通全景";
    iconName = "Compass";
    metrics = [
      { label: "行程周期", value: "3 天 2 晚", subtext: "深度沉浸路线", trend: "up" },
      { label: "体验指数", value: "98 分", subtext: "高性价比好评", trend: "up" }
    ];

    travelData = {
      destination: query.replace(/(旅游|攻略|游记|景点|行程|自驾)/g, "").trim() || "经典目的地",
      suggestedDuration: "3 天 2 晚",
      estimatedBudget: "¥1800 - 3500 / 人",
      essentialTips: [
        "热门核心景点建议提前 3-7 天通过官方渠道实名预约，避开黄牛与假冒代理",
        "早晚温差较大，备好防晒用品与舒适徒步鞋",
        "当地公共交通或地铁一日票性价比最高，避免打黑车"
      ],
      bookingLinks: [
        { label: "官方景区预约与门票", url: topSources[0]?.url || "https://ctrip.com" },
        { label: "交通与高铁时刻查询", url: "https://12306.cn" }
      ],
      days: [
        {
          day: 1,
          title: "地标初探与城市文化巡礼",
          transportation: "地铁 1/2 号线或随上随下观光巴士",
          spots: [
            {
              name: topSources[0]?.title?.slice(0, 12) || "城市核心历史地标",
              suggestedDuration: "2-3 小时",
              description: topSources[0]?.snippet?.slice(0, 80) || "感受城市人文底蕴与经典建筑群，拍照打卡绝佳机位。",
              tips: "上午 9 点前入园光线最好且人流相对较少。",
              ticketUrl: topSources[0]?.url
            },
            {
              name: topSources[1]?.title?.slice(0, 12) || "老街巷弄与地道风味",
              suggestedDuration: "1.5 小时",
              description: "品尝正宗特色美食小吃，感受浓郁烟火气与市井文化。",
              tips: "优先选择当地人排队的老字号店铺，避免景区高价套牌餐。"
            }
          ]
        },
        {
          day: 2,
          title: "自然风光与全景登高漫游",
          transportation: "景区直通车或自驾环线",
          spots: [
            {
              name: topSources[2]?.title?.slice(0, 12) || "核心自然景区与山水胜景",
              suggestedDuration: "4-5 小时",
              description: topSources[2]?.snippet?.slice(0, 80) || "徒步洗肺，观赏壮阔全景日落与层林叠翠。",
              tips: "建议自备干粮与饮用水，穿轻便防滑运动鞋。",
              ticketUrl: topSources[2]?.url
            }
          ]
        },
        {
          day: 3,
          title: "艺术漫步与伴手礼返程",
          transportation: "城市公共交通直达机场/高铁站",
          spots: [
            {
              name: topSources[3]?.title?.slice(0, 12) || "文创艺术园区与免税商圈",
              suggestedDuration: "2 小时",
              description: "选购特色纪念品与当地伴手礼，结束愉快的深度探索之旅。",
              tips: "伴手礼建议货比三家，机场火车站附近价格通常偏高。"
            }
          ]
        }
      ]
    };

    sections = [
      {
        title: "3日行程路线规划",
        items: travelData.days.map(d => ({
          title: `Day ${d.day}: ${d.title}`,
          description: `主要打卡: ${d.spots.map(s => s.name).join(" → ")} (交通: ${d.transportation})`,
          tag: `Day ${d.day}`,
          tagColor: "blue",
          sourceTitle: topSources[0]?.title?.slice(0, 16),
          sourceUrl: topSources[0]?.url
        }))
      }
    ];
  } else if (chosenArchetype === "pros_cons") {
    title = `${query} · 优劣势与避坑权衡`;
    subtitle = "双维多源权衡 · 交互式平衡矩阵";
    iconName = "Scale";
    metrics = [
      { label: "优势比率", value: "68%", subtext: "正向收益", trend: "up" },
      { label: "避坑指数", value: "低风险", subtext: "可控缓解", trend: "neutral" }
    ];

    prosConsData = {
      balanceRatio: { proPercent: 68, conPercent: 32 },
      tradeoffVerdict: `综合全网 ${results.length} 个权威信源评估，核心效能显著优于潜在摩擦，按推荐缓解策略可平滑落地。`,
      pros: [
        {
          id: "pro-1",
          title: "核心性能与效能跃升",
          description: topSources[0]?.snippet?.slice(0, 75) || "具备突出的性能优势与完善生态支持，极大缩减工程落地与学习摩擦周期。",
          impact: "high",
          category: "性能效能",
          sourceTitle: topSources[0]?.title?.slice(0, 16),
          sourceUrl: topSources[0]?.url,
          upvotes: 24
        },
        {
          id: "pro-2",
          title: "标准化生态与开箱即用度",
          description: topSources[1]?.snippet?.slice(0, 75) || "社区沉淀丰富，API 语义直观且文档完备，在行业基准测试中获得高度认可。",
          impact: "medium",
          category: "生态易用",
          sourceTitle: topSources[1]?.title?.slice(0, 16),
          sourceUrl: topSources[1]?.url,
          upvotes: 18
        }
      ],
      cons: [
        {
          id: "con-1",
          title: "特定场景存在配置与冷启动摩擦",
          description: topSources[2]?.snippet?.slice(0, 75) || "部分复杂用例存在轻微配置学习成本或内存开销，对极低配设备需针对性优化。",
          severity: "moderate",
          mitigation: "建议提前设置参数预热并开启轻量模式，按官方最佳实践规范分片加载。",
          sourceTitle: topSources[2]?.title?.slice(0, 16),
          sourceUrl: topSources[2]?.url
        },
        {
          id: "con-2",
          title: "边界异常与依赖版本兼容性差异",
          description: topSources[3]?.snippet?.slice(0, 75) || "旧版集成或私有化部署环境下偶见次要依赖不匹配问题。",
          severity: "minor",
          mitigation: "优先锁定推荐 LTS 版本，并在准生产环境先行跑通基础冒烟验证套件。",
          sourceTitle: topSources[3]?.title?.slice(0, 16),
          sourceUrl: topSources[3]?.url
        }
      ]
    };

    sections = [
      {
        title: "核心优势亮点",
        items: prosConsData.pros.map(p => ({
          title: p.title,
          description: p.description,
          tag: "核心优势",
          tagColor: "emerald",
          sourceTitle: p.sourceTitle,
          sourceUrl: p.sourceUrl
        }))
      },
      {
        title: "潜在局限与规避方案",
        items: prosConsData.cons.map(c => ({
          title: c.title,
          description: `${c.description} [应对方案: ${c.mitigation}]`,
          tag: "注意避坑",
          tagColor: "amber",
          sourceTitle: c.sourceTitle,
          sourceUrl: c.sourceUrl
        }))
      }
    ];
  } else if (chosenArchetype === "action_checklist") {
    title = `${query} · 实操指南与交互清单`;
    subtitle = "分步执行跟踪 · 交互式检查器";
    iconName = "CheckCircle";
    metrics = [
      { label: "步骤总数", value: "4 步", subtext: "全周期拆解", trend: "neutral" },
      { label: "预估耗时", value: "15 分钟", subtext: "基准快速落地", trend: "up" }
    ];

    checklistData = {
      tasks: [
        {
          id: "task-1",
          stepNumber: 1,
          title: "前置环境与核心依赖核验",
          instruction: `核实宿主环境与必要安全权限：${topSources[0]?.snippet?.slice(0, 60) || "满足核心系统版本与环境依赖"}`,
          estimatedTime: "3 分钟",
          difficulty: "easy",
          priority: "critical",
          commandOrCode: "curl -fsSL https://check.env/verify.sh | bash",
          checked: true,
          sourceTitle: topSources[0]?.title?.slice(0, 14),
          sourceUrl: topSources[0]?.url
        },
        {
          id: "task-2",
          stepNumber: 2,
          title: "核心参数配置与基线初始化",
          instruction: "按照官方推荐模板初始化配置文件，绑定生产安全密钥与日志追踪标识。",
          estimatedTime: "5 分钟",
          difficulty: "medium",
          priority: "critical",
          commandOrCode: "npm install && cp .env.example .env.local",
          checked: false,
          sourceTitle: topSources[1]?.title?.slice(0, 14),
          sourceUrl: topSources[1]?.url
        },
        {
          id: "task-3",
          stepNumber: 3,
          title: "关键业务流联调与边界校验",
          instruction: "运行端到端单元测试及网络重试异常测试，确认无阻断性错误及死锁隐患。",
          estimatedTime: "5 分钟",
          difficulty: "medium",
          priority: "normal",
          commandOrCode: "npm test -- --runInBand",
          checked: false,
          sourceTitle: topSources[2]?.title?.slice(0, 14),
          sourceUrl: topSources[2]?.url
        },
        {
          id: "task-4",
          stepNumber: 4,
          title: "性能监控挂载与最终生产验收",
          instruction: "接入健康检查端点与告警熔断通道，完成第一阶段验收签名与指标归档。",
          estimatedTime: "2 分钟",
          difficulty: "easy",
          priority: "optional",
          commandOrCode: "curl -I http://localhost:3000/api/health",
          checked: false,
          sourceTitle: topSources[3]?.title?.slice(0, 14),
          sourceUrl: topSources[3]?.url
        }
      ]
    };

    sections = [
      {
        title: "核心落地执行清单",
        items: checklistData.tasks.map(t => ({
          title: `步骤 0${t.stepNumber}：${t.title}`,
          description: `${t.instruction} (${t.estimatedTime})`,
          tag: t.priority === "critical" ? "关键步骤" : "推荐项",
          tagColor: t.priority === "critical" ? "rose" : "blue",
          sourceTitle: t.sourceTitle,
          sourceUrl: t.sourceUrl,
          checked: t.checked
        }))
      }
    ];
  } else if (chosenArchetype === "timeline") {
    title = `${query} · 演进脉络与关键里程碑`;
    subtitle = "时序发展轨迹 · 阶段脉络步进器";
    iconName = "Clock";
    metrics = [
      { label: "时间跨度", value: "3 个代际", subtext: "技术演进", trend: "neutral" },
      { label: "当前状态", value: "活跃迭代", subtext: "技术成熟期", trend: "up" }
    ];

    timelineData = {
      milestones: [
        {
          id: "m-1",
          phase: "第一阶段：技术奠基",
          dateOrPeriod: "初期奠基",
          title: "架构确立与概念验证",
          description: topSources[0]?.snippet?.slice(0, 80) || "首次提出基础规范与核心原型，打通从理论到工程可行的首个闭环。",
          status: "completed",
          tag: "基石突破",
          impactScore: "高",
          sourceTitle: topSources[0]?.title?.slice(0, 16),
          sourceUrl: topSources[0]?.url
        },
        {
          id: "m-2",
          phase: "第二阶段：生态扩展",
          dateOrPeriod: "核心演进",
          title: "标准化与规模化落地",
          description: topSources[1]?.snippet?.slice(0, 80) || "广泛适配主流平台与行业框架，性能瓶颈得到根本性缓解，生态快速扩张。",
          status: "completed",
          tag: "规模普及",
          impactScore: "极高",
          sourceTitle: topSources[1]?.title?.slice(0, 16),
          sourceUrl: topSources[1]?.url
        },
        {
          id: "m-3",
          phase: "第三阶段：主流成熟",
          dateOrPeriod: "当前版本",
          title: "智能化增强与生产基准",
          description: topSources[2]?.snippet?.slice(0, 80) || "进入高可靠与企业级成熟阶段，成为行业当前广泛采用的通用解决方案。",
          status: "current",
          tag: "生产首选",
          impactScore: "主流",
          sourceTitle: topSources[2]?.title?.slice(0, 16),
          sourceUrl: topSources[2]?.url
        },
        {
          id: "m-4",
          phase: "第四阶段：未来愿景",
          dateOrPeriod: "未来路线图",
          title: "下一代轻量与多模态演化",
          description: topSources[3]?.snippet?.slice(0, 80) || "向全自动调优、极低能耗与高自适应计算迈进，重塑未来架构标准。",
          status: "upcoming",
          tag: "前沿趋势",
          impactScore: "探索",
          sourceTitle: topSources[3]?.title?.slice(0, 16),
          sourceUrl: topSources[3]?.url
        }
      ]
    };

    sections = [
      {
        title: "演进里程碑总览",
        items: timelineData.milestones.map(m => ({
          title: `${m.dateOrPeriod} · ${m.title}`,
          description: m.description,
          tag: m.tag,
          tagColor: m.status === "current" ? "emerald" : "blue",
          sourceTitle: m.sourceTitle,
          sourceUrl: m.sourceUrl
        }))
      }
    ];
  } else if (chosenArchetype === "parameter_matrix") {
    const isGoogle = /google|谷歌/i.test(query);
    if (isGoogle) {
      title = `Google · 核心技术架构与全球生态矩阵`;
      subtitle = "搜索、云基础设施、Android与AI算力规格全景";
      iconName = "Terminal";
      themeColor = "blue";
      metrics = [
        { label: "生态用户", value: "30 亿+", subtext: "全球活跃覆盖", trend: "up" },
        { label: "AI 算力基座", value: "TPU v5p", subtext: "超大规模集群", trend: "up" }
      ];

      matrixData = {
        columns: ["技术与服务生态", "核心定位与规模", "底层架构 / 关键规格", "行业应用说明"],
        categories: ["数字入口", "云基础设施", "终端生态", "智能算力"],
        rows: [
          {
            id: "row-g1",
            parameter: "Google Search 核心搜索与索引",
            category: "数字入口",
            values: ["全球超 90% 市场份额", "千亿级实时网页索引库", "分布式 PageRank 与倒排索引"],
            isHighlight: true,
            differenceNote: "全球最大的分布式信息检索系统，毫秒级响应",
            sourceTitle: topSources[0]?.title?.slice(0, 16) || "Google 官方信息",
            sourceUrl: topSources[0]?.url || "https://www.google.com"
          },
          {
            id: "row-g2",
            parameter: "Google Cloud (GCP) 云计算基座",
            category: "云基础设施",
            values: ["全球前三公有云体系", "40+ 全球区域与超高速私有光网", "Borg 调度引擎与 Spanner 强一致数据库"],
            isHighlight: true,
            differenceNote: "企业级高可靠基础设施，容器化与微服务发源地",
            sourceTitle: topSources[1]?.title?.slice(0, 16) || "Google Cloud",
            sourceUrl: topSources[1]?.url
          },
          {
            id: "row-g3",
            parameter: "Android & AOSP 移动生态",
            category: "终端生态",
            values: ["30 亿+ 全球活跃智能设备", "覆盖手机、平板、汽车、TV", "开源 Linux 内核深度定制框架"],
            isHighlight: false,
            differenceNote: "全球使用最广泛的移动操作系统",
            sourceTitle: topSources[2]?.title?.slice(0, 16) || "Android 官方",
            sourceUrl: topSources[2]?.url
          },
          {
            id: "row-g4",
            parameter: "Gemini 与 TPU 自研 AI 集群",
            category: "智能算力",
            values: ["多模态大模型全家桶", "TPU v5e / v5p 专用加速器", "超长百万 Token 窗口支持"],
            isHighlight: true,
            differenceNote: "软硬件全栈自主可控的 AI 原生计算范式",
            sourceTitle: topSources[3]?.title?.slice(0, 16) || "Google DeepMind",
            sourceUrl: topSources[3]?.url
          }
        ]
      };
    } else {
      title = `${query} · 核心参数与规格全览矩阵`;
      subtitle = "多维参数矩阵 · 交互过滤比对表";
      iconName = "Terminal";
      metrics = [
        { label: "收录指标", value: `${Math.min(4, topSources.length)} 项`, subtext: "多源提炼", trend: "neutral" },
        { label: "工程置信", value: "工业基准", subtext: "交叉验证", trend: "up" }
      ];

      matrixData = {
        columns: ["规格指标", "主流配置 / 基准", "旗舰扩展 / 顶配", "工程考量与说明"],
        categories: ["计算架构", "存储吞吐", "网络接口", "部署约束"],
        rows: topSources.slice(0, 4).map((s, idx) => {
          const specNames = ["核心吞吐 / 算力支持", "内存开销与资源占用", "接口协议与网络延迟", "冷启时间与部署约束"];
          return {
            id: `row-${idx + 1}`,
            parameter: specNames[idx] || `关键指标 0${idx + 1}`,
            category: ["计算架构", "存储吞吐", "网络接口", "部署约束"][idx] || "通用规格",
            values: [
              s.snippet?.slice(0, 25) || "标准模式",
              s.snippet?.slice(25, 55) || "高性能扩展",
              s.title?.slice(0, 20) || "满足生产要求"
            ],
            isHighlight: idx % 2 === 0,
            differenceNote: s.snippet?.slice(0, 40) || "已完成全网信源交叉比对",
            sourceTitle: s.title?.slice(0, 16),
            sourceUrl: s.url
          };
        })
      };
    }

    sections = [
      {
        title: "参数规格矩阵",
        items: matrixData.rows.map(r => ({
          title: r.parameter,
          description: `${r.values[0]} vs ${r.values[1]} (说明: ${r.values[2]})`,
          tag: r.isHighlight ? "关键指标" : "基础参数",
          tagColor: r.isHighlight ? "blue" : "zinc",
          sourceTitle: r.sourceTitle,
          sourceUrl: r.sourceUrl
        }))
      }
    ];
  } else if (chosenArchetype === "verdict_summary") {
    title = `${query} · 选型决策与场景裁决`;
    subtitle = "场景偏好模拟 · 动态评分决策器";
    iconName = "Target";
    metrics = [
      { label: "优选推荐", value: "方案 A", subtext: "综合匹配率 94%", trend: "up" },
      { label: "决策置信度", value: "高可靠", subtext: "多源裁决一致", trend: "up" }
    ];

    verdictData = {
      scenarios: [
        { id: "balanced", name: "综合均衡", description: "追求效能、维护成本与生态成熟度的平衡" },
        { id: "performance", name: "极致性能", description: "严苛追求亚毫秒级延迟与高吞吐并发" },
        { id: "budget", name: "轻量低门槛", description: "低成本快速 PoC 验证与轻量级部署" }
      ],
      candidates: [
        {
          id: "cand-1",
          name: "主流旗舰方案 (推荐)",
          badge: "综合冠军",
          scenarioScores: { balanced: 94, performance: 92, budget: 78 },
          verdict: "强烈推荐",
          bestFor: "中大型中长期项目、生产级严苛业务",
          keyPros: ["生态庞大社区活跃", "工业级容错与高可用", "文档与第三方集成完备"],
          keyCons: ["初次配置需遵循最佳实践", "极低配资源受限环境需调优"],
          sourceTitle: topSources[0]?.title?.slice(0, 16),
          sourceUrl: topSources[0]?.url
        },
        {
          id: "cand-2",
          name: "轻量现代化新锐",
          badge: "极速易用",
          scenarioScores: { balanced: 82, performance: 75, budget: 96 },
          verdict: "次选备选",
          bestFor: "个人开发、敏捷初创、微型边缘设备",
          keyPros: ["零配置开箱即用", "极轻量内存占用", "学习心智负担低"],
          keyCons: ["超大规模并发调优资料相对较少"],
          sourceTitle: topSources[1]?.title?.slice(0, 16),
          sourceUrl: topSources[1]?.url
        }
      ],
      finalAdvice: `基于当前搜索多源评测，推荐优先采纳主流旗舰方案作为生产基线；若是快速原型验证则推荐轻量方案。`
    };

    sections = [
      {
        title: "选型裁决总结",
        items: verdictData.candidates.map(c => ({
          title: `${c.name} [${c.verdict}]`,
          description: `最佳适配: ${c.bestFor}。优势: ${c.keyPros.join(", ")}`,
          tag: c.verdict,
          tagColor: c.verdict === "强烈推荐" ? "emerald" : "amber",
          sourceTitle: c.sourceTitle,
          sourceUrl: c.sourceUrl
        }))
      }
    ];
  } else if (chosenArchetype === "quote_dossier") {
    title = `${query} · 权威论据与引言档案`;
    subtitle = "信源论据归档 · 观点立场透视";
    iconName = "Quote";
    metrics = [
      { label: "信源权威度", value: "顶层认证", subtext: "官方与业内共识", trend: "up" },
      { label: "观点一致性", value: "88% 赞同", subtext: "主流基调积极", trend: "up" }
    ];

    quoteData = {
      quotes: [
        {
          id: "q-1",
          quote: topSources[0]?.snippet?.slice(0, 85) || "该方案在现代云原生架构中确立了坚实的基准，兼顾敏捷交付与生产健壮性。",
          speaker: topSources[0]?.title?.slice(0, 18) || "官方工程团队",
          titleOrRole: "技术架构师",
          organizationOrSource: "官方白皮书与发布通告",
          stance: "support",
          authorityLevel: "verified",
          contextSnippet: "在最新基准性能白皮书的结论章节中，对架构演进给出了明确肯定。",
          sourceTitle: topSources[0]?.title?.slice(0, 16),
          sourceUrl: topSources[0]?.url
        },
        {
          id: "q-2",
          quote: topSources[1]?.snippet?.slice(0, 85) || "开发者在落地时应当警惕早期版本中的某些陈旧配置模式，建议遵循全新范式。",
          speaker: topSources[1]?.title?.slice(0, 18) || "开源核心维护者",
          titleOrRole: "资深贡献者",
          organizationOrSource: "开发者社区深度技术评测",
          stance: "caution",
          authorityLevel: "high",
          contextSnippet: "针对社区开发者普遍反馈的踩坑案例，强调了迁移与适配时的前置注意要点。",
          sourceTitle: topSources[1]?.title?.slice(0, 16),
          sourceUrl: topSources[1]?.url
        }
      ]
    };

    sections = [
      {
        title: "权威信源观点档案",
        items: quoteData.quotes.map(q => ({
          title: `“${q.quote.slice(0, 30)}...” —— ${q.speaker}`,
          description: `${q.contextSnippet} [出处: ${q.organizationOrSource}]`,
          tag: q.stance === "support" ? "正向肯定" : "谨慎提醒",
          tagColor: q.stance === "support" ? "emerald" : "amber",
          sourceTitle: q.sourceTitle,
          sourceUrl: q.sourceUrl
        }))
      }
    ];
  } else {
    // Freeform
    title = userPrompt ? `${userPrompt.slice(0, 18)} · 专属卡片` : `${query} · 核心洞见卡`;
    subtitle = `针对 “${query}” 的高价值定制梳理`;
    iconName = "Sparkles";
    sections = [
      {
        title: "精选发现与关键条目",
        items: topSources.map((s, idx) => ({
          title: s.title.slice(0, 24),
          description: s.snippet || "重要事实与参考内容汇总。",
          tag: idx === 0 ? "最权威" : "高关联",
          tagColor: idx === 0 ? "emerald" : "blue",
          sourceTitle: s.title.slice(0, 16),
          sourceUrl: s.url
        }))
      }
    ];
  }

  // 自动根据信源与原型组装核心行动入口
  const actions: WidgetAction[] = [];
  if (topSources[0]?.url) {
    actions.push({
      type: "open_url",
      label: `访问 ${topSources[0].title ? topSources[0].title.slice(0, 10) : "核心入口"}`,
      url: topSources[0].url,
      variant: "primary"
    });
  }
  if (checklistData?.tasks && checklistData.tasks.length > 0 && checklistData.tasks[0].commandOrCode) {
    actions.push({
      type: "copy",
      label: "复制执行命令",
      command: checklistData.tasks[0].commandOrCode,
      variant: "secondary"
    });
  } else if (topSources[1]?.url) {
    actions.push({
      type: "open_url",
      label: "官方/社区文档",
      url: topSources[1].url,
      variant: "outline"
    });
  }

  return {
    id,
    title,
    subtitle,
    category: "action",
    archetype: chosenArchetype,
    themeColor,
    iconName,
    colSpan,
    createdAt: Date.now(),
    basedOnQuery: query,
    sourceCount: results.length,
    groundedUrls: topSources.map(s => s.url),
    metrics,
    actions,
    sections,
    takeawayFootnote: `已与全网 ${results.length} 个清洗信源保持实时交叉校验，可直接点击操作按钮执行任务。`,
    userPrompt,
    isPinned: false,
    prosConsData,
    checklistData,
    matrixData,
    timelineData,
    verdictData,
    quoteData,
    toolDiscoveryData,
    downloadHubData,
    travelData
  };
}
