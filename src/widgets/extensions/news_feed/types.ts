export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url?: string;
  category?: string;
  hotScore?: number;
  imageUrl?: string;
}

export interface NewsFeedData {
  topic: string;
  lastUpdated: string;
  articles: NewsItem[];
}
