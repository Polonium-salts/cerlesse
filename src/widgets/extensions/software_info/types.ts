export interface SoftwareInfoData {
  name: string;
  tagline?: string;
  version?: string;
  releaseDate?: string;
  developer?: string;
  license?: string;
  platforms?: Array<{
    name: string;
    icon?: string;
    supported: boolean;
  }>;
  category?: string;
  size?: string;
  officialUrl?: string;
  githubUrl?: string;
  tags?: string[];
  description?: string;
  rating?: number;
  downloadsCount?: string;
  pricingType?: "free" | "open_source" | "freemium" | "commercial";
}
