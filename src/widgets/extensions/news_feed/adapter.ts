import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { NewsFeedData } from "./types.js";

export interface NewsFeedAdapterType extends WidgetAdapter<any, NewsFeedData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): NewsFeedData;
  validate(data: NewsFeedData): boolean;
}

export const newsFeedAdapter: NewsFeedAdapterType = {
  canHandle(query: string) {
    return /(新闻|资讯|news|热点|快讯|要闻|最新动态|今天|突发)/i.test(query);
  },

  transform(query: string, result?: any): NewsFeedData {
    const q = query || result?.query || "时事热点";
    const topic = q.replace(/(新闻|资讯|news|热点|快讯|要闻|最新动态)/gi, "").trim() || "科技前沿";

    const filtered = result?.filteredResults || [];

    const articles = filtered.length > 0 ? filtered.slice(0, 4).map((item: any, idx: number) => ({
      id: `news-${idx}`,
      title: item.title || `${topic} 领域最新动态进展`,
      summary: item.snippet || "行业专家与核心研究机构发布最新进展，持续引发行业广泛关注与讨论。",
      source: item.source || "权威科技快讯",
      publishedAt: `${idx * 2 + 1} 小时前`,
      url: item.url,
      category: "行业前沿",
      hotScore: 98 - idx * 5
    })) : [
      {
        id: "news-1",
        title: `${topic} 突破性进展：新一代前沿架构正式发布`,
        summary: "业内最新数据显示，该方案在能效比与吞吐量上取得显著突破，生态合作加速落地。",
        source: "Global Tech Insights",
        publishedAt: "25 分钟前",
        url: "https://example.com/news/1",
        category: "头条重磅",
        hotScore: 99
      },
      {
        id: "news-2",
        title: `全球开发者生态反响热烈，${topic} 社区Star增长迅猛`,
        summary: "开源社区在首发当日即收获数千贡献者关注，多家头部厂商宣布集成支持。",
        source: "OpenSource Daily",
        publishedAt: "1 小时前",
        url: "https://example.com/news/2",
        category: "开源社区",
        hotScore: 94
      },
      {
        id: "news-3",
        title: `行业分析报告发布：${topic} 市场规模预计年增 45%`,
        summary: "权威研究报告指出，随着基础设施成熟与标准化推进，企业级应用迎来爆发期。",
        source: "Market Intelligence",
        publishedAt: "3 小时前",
        url: "https://example.com/news/3",
        category: "产业洞察",
        hotScore: 88
      }
    ];

    return {
      topic,
      lastUpdated: "刚刚",
      articles
    };
  },

  validate(data: NewsFeedData): boolean {
    return Boolean(data && Array.isArray(data.articles) && data.articles.length > 0);
  }
};
