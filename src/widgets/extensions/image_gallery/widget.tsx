import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import {
  ImageGalleryWidget,
  ImageGalleryBackWidget,
  type ImageGalleryData
} from "../../components/ImageGalleryWidget.js";

export const ImageGalleryExtensionWidget: React.FC<ExtensionComponentProps<ImageGalleryData>> = ({
  data,
  context
}) => {
  return (
    <ImageGalleryWidget
      data={data}
      size={context.size || 75}
      isCompact={context.isCompact}
      isFlipped={context.isFlipped}
      openUrl={context.openUrl}
      onExecuteSearch={context.onExecuteSearch}
      onOpenImagePage={context.actions?.openImagePage}
    />
  );
};

export const ImageGalleryBackExtensionWidget: React.FC<ExtensionComponentProps<ImageGalleryData>> = ({
  data,
  context
}) => {
  return <ImageGalleryBackWidget data={data} openUrl={context.openUrl} />;
};
