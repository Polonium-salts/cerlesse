import { SearchImage } from "../../src/types.js";
import { searchSearxngImages } from "../searxng.js";

export interface SearchImagesInput {
  query: string;
  limit?: number;
  language?: string;
}

export interface SearchImagesOutput {
  images: SearchImage[];
  total: number;
  query: string;
}

/**
 * search_images: 执行多源图片检索
 */
export async function searchImagesTool(
  input: SearchImagesInput,
  runtimeConfig?: { customSearxngUrl?: string; env?: Record<string, string | undefined> }
): Promise<SearchImagesOutput> {
  const query = (input.query || "").trim();
  if (!query) {
    return {
      images: [],
      total: 0,
      query: ""
    };
  }

  const images = await searchSearxngImages(query, {
    customUrl: runtimeConfig?.customSearxngUrl,
    language: input.language,
    limit: input.limit ?? 24,
    env: runtimeConfig?.env
  });

  return {
    images,
    total: images.length,
    query
  };
}
