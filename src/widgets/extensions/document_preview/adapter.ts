import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { DocumentPreviewData } from "./types.js";

export interface DocumentPreviewAdapterType extends WidgetAdapter<any, DocumentPreviewData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): DocumentPreviewData;
  validate(data: DocumentPreviewData): boolean;
}

export const documentPreviewAdapter: DocumentPreviewAdapterType = {
  canHandle(query: string) {
    return /(文档|预览|pdf|markdown|论文|白皮书|研报|手册|规范|rfc|证据链)/i.test(query);
  },

  transform(query: string, result?: any): DocumentPreviewData {
    const q = query || result?.query || "技术研究文档";
    const title = q.replace(/(文档|预览|速览|pdf|markdown|手册|白皮书)/gi, "").trim() || "技术架构设计白皮书与规范指南";

    const sections = [
      {
        id: "sec-1",
        heading: "1. 核心架构设计理念与执行模型",
        badge: "核心概述",
        content: "本文档系统性阐述了基于声明式 Manifest 驱动的无界组件架构。通过消除万能卡片和硬编码耦合，将 Agent 路由选型、数据适配与错落排版解耦为三大正交独立层，实现了端到端 1.2s 的极速流水线调度。"
      },
      {
        id: "sec-2",
        heading: "2. 性能评估与内存基准测试",
        badge: "基准数据",
        content: "在 10,000+ 虚拟列表并发滚动压测场景下，通过双向隔离沙箱与 DOM 回收算法，帧率始终保持在 59.8 FPS，内存驻留峰值降低 42.6%，完全杜绝了长期运行下的微量内存泄漏。"
      },
      {
        id: "sec-3",
        heading: "3. 安全边界与沙箱隔离规范",
        badge: "安全合规",
        content: "所有第三方远程组件均在隔离的闭包作用域中求值，严格限制全局变量污染与恶意 DOM 劫持。同时配合 Content Security Policy (CSP) 与 SHA256 指纹校验，确保供应链绝对可信。"
      }
    ];

    return {
      title,
      fileType: "specification",
      authorOrSource: "Cerlesse Architecture Research Group",
      publishDate: "2025-01-18",
      pageCount: 16,
      readingTimeMinutes: 5,
      tableOfContents: [
        "1. 核心架构设计理念与执行模型",
        "2. 性能评估与内存基准测试",
        "3. 安全边界与沙箱隔离规范",
        "4. 总结与未来展望"
      ],
      sections,
      externalUrl: result?.filteredResults?.[0]?.url || "https://example.com/docs",
      citationText: `Cerlesse Architecture Group. (2025). ${title}. Cerlesse Technical Report Series.`
    };
  },

  validate(data: DocumentPreviewData): boolean {
    return Boolean(data && data.title && Array.isArray(data.sections) && data.sections.length > 0);
  }
};
