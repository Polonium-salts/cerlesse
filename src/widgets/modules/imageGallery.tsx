import { WidgetModule } from "../sdk/types.js";
import {
  ImageGalleryWidget,
  ImageGalleryBackWidget,
  buildImageGalleryData,
  type ImageGalleryData
} from "../components/ImageGalleryWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：相关图片 (image_gallery)
 * 聚合检索结果缩略图与研报配图，正面用图片网格墙呈现，背面列出图源清单便于溯源
 */
export const imageGalleryModule: WidgetModule<ImageGalleryData> = {
  ...manifestMeta("image_gallery"),
  width: 75,
  data: (activeResult) => buildImageGalleryData(activeResult),
  render: (ctx) => (
    <ImageGalleryWidget
      data={ctx.data}
      size={ctx.size || 75}
      isCompact={ctx.isCompact}
      isFlipped={ctx.isFlipped}
      openUrl={ctx.openUrl}
      onExecuteSearch={ctx.onExecuteSearch}
      onOpenImagePage={ctx.actions?.openImagePage}
    />
  ),
  renderBack: (ctx) => (
    <ImageGalleryBackWidget data={ctx.data} openUrl={ctx.openUrl} />
  )
};
