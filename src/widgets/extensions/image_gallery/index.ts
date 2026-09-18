import { manifest } from "./manifest.js";
import { imageGalleryAdapter } from "./adapter.js";
import { ImageGalleryExtensionWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { ImageGalleryData } from "./types.js";

const imageGalleryExtension: WidgetExtension<ImageGalleryData> = {
  manifest,
  adapter: imageGalleryAdapter,
  component: ImageGalleryExtensionWidget
};

export default imageGalleryExtension;
export { manifest, imageGalleryAdapter, ImageGalleryExtensionWidget };
