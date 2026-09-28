import { searchSearxngImages } from "../searxng.js";

export interface ImageSearchOptions {
  customUrl?: string;
  language?: string;
  limit?: number;
  page?: number;
}

export async function executeImageSearch(query: string, options: ImageSearchOptions = {}) {
  const page = Math.max(options.page || 1, 1);
  const limit = Math.min(Math.max(options.limit || 36, 1), 72);
  const images = await searchSearxngImages(query.trim(), {
    customUrl: options.customUrl,
    language: options.language,
    limit,
    page
  });

  return {
    query: query.trim(),
    images,
    page,
    total: images.length
  };
}
