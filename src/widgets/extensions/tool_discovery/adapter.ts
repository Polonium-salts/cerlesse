import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { ToolDiscoveryData } from "./types.js";

export interface ToolDiscoveryAdapterType extends WidgetAdapter<any, ToolDiscoveryData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): ToolDiscoveryData;
  validate(data: ToolDiscoveryData): boolean;
}

export const toolDiscoveryAdapter: ToolDiscoveryAdapterType = {
  canHandle(query: string) {
    return /(工具|替代品|alternative|推荐|竞品|好用|类似|类似软件|软件推荐)/i.test(query);
  },

  transform(query: string, result?: any): ToolDiscoveryData {
    const q = query || result?.query || "生产力工具";
    const topic = q.replace(/(工具|替代品|alternative|推荐|竞品|好用|类似|类似软件|有哪些)/g, "").trim() || "高能效";

    const tools = [
      {
        id: "tool-1",
        name: "Appflowy / Obsidian",
        tagline: "本地优先、隐私加密的知识库与生产力套件",
        category: "知识库 / 笔记",
        pricing: "Open Source" as const,
        rating: 4.9,
        highlightFeature: "端到端加密 & 离线 Markdown 优先",
        pros: ["完全自托管", "插件生态丰富", "零数据泄露风险"],
        url: result?.filteredResults?.[0]?.url || "https://obsidian.md",
        isBestAlternative: true
      },
      {
        id: "tool-2",
        name: "Affine PRO",
        tagline: "下一代一体化白板、文档与思维导图协同画布",
        category: "白板 / 协同",
        pricing: "Freemium" as const,
        rating: 4.7,
        highlightFeature: "无界白板与结构化文档无缝切换",
        pros: ["多模态排版", "实时协同", "现代化界面设计"],
        url: result?.filteredResults?.[1]?.url || "https://affine.pro"
      },
      {
        id: "tool-3",
        name: "Bruno / Hoppscotch",
        tagline: "轻量快速、Git 友好的下一代 API 调试测试客户端",
        category: "API 调试 / 开发者",
        pricing: "Free" as const,
        rating: 4.8,
        highlightFeature: "集合纯文本存储，直接随代码仓库提交版本管理",
        pros: ["轻量免登录", "完全离线可用", "自动化回归测试"],
        url: "https://usebruno.com"
      },
      {
        id: "tool-4",
        name: "Penpot",
        tagline: "首个专为跨职能团队打造的开源 Web 原生设计与原型平台",
        category: "UI 设计 / 原型",
        pricing: "Open Source" as const,
        rating: 4.6,
        highlightFeature: "基于标准 SVG / Flex 布局规范，与前端代码天然互通",
        pros: ["浏览器跨平台", "支持自建服务器", "设计转代码零损耗"],
        url: "https://penpot.app"
      }
    ];

    return {
      categoryTitle: `${topic} 精选工具与替代推荐`,
      targetOrTopic: topic,
      description: `基于社区评价、开源生态与功能完备度严选的 ${topic} 优质工具矩阵。`,
      tools
    };
  },

  validate(data: ToolDiscoveryData): boolean {
    return Boolean(data && Array.isArray(data.tools) && data.tools.length > 0);
  }
};
