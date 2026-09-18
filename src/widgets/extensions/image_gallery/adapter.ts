import type { WidgetAdapter } from "../../sdk/adapter.js";
import { buildImageGalleryData, type ImageGalleryData } from "../../components/ImageGalleryWidget.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const imageGalleryAdapter: WidgetAdapter<SearchSynthesisResult, ImageGalleryData> = {
  canHandle(query: string, result?: SearchSynthesisResult): boolean {
    const hasImages = Boolean(
      (result?.relatedImages && result.relatedImages.length > 0) ||
      (result?.filteredResults && result.filteredResults.some(r => Boolean(r.thumbnail)))
    );
    const hasImageQuery = /(图片|照片|图集|壁纸|素材|外观|长什么样|photo|image|wallpaper)/i.test(query);
    return hasImages || hasImageQuery;
  },

  transform(query: string, result?: SearchSynthesisResult): ImageGalleryData {
    return buildImageGalleryData(result);
  },

  validate(data: ImageGalleryData): boolean {
    return Boolean(data && Array.isArray(data.images));
  }
};
