import type { WidgetAdapter } from "../../sdk/adapter.js";
import { buildImageGalleryData, type ImageGalleryData } from "../../components/ImageGalleryWidget.js";
import type { SearchSynthesisResult } from "../../../types.js";

export const imageGalleryAdapter: WidgetAdapter<SearchSynthesisResult, ImageGalleryData> = {
  canHandle(_query: string, _result?: SearchSynthesisResult): boolean {
    return true;
  },

  transform(query: string, result?: SearchSynthesisResult): ImageGalleryData {
    return buildImageGalleryData(result);
  },

  validate(data: ImageGalleryData): boolean {
    return Boolean(data && Array.isArray(data.images));
  }
};
