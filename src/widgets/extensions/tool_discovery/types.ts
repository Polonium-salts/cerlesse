export interface ToolItem {
  id: string;
  name: string;
  tagline: string;
  category: string;
  pricing: "Free" | "Open Source" | "Freemium" | "Paid";
  rating: number;
  highlightFeature: string;
  pros: string[];
  url?: string;
  isBestAlternative?: boolean;
}

export interface ToolDiscoveryData {
  categoryTitle: string;
  targetOrTopic: string;
  description: string;
  tools: ToolItem[];
}
