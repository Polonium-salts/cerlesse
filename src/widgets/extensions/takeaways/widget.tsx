import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import { TakeawaysWidget, type TakeawaysData } from "../../components/TakeawaysWidget.js";

export const TakeawaysExtensionWidget: React.FC<ExtensionComponentProps<TakeawaysData>> = ({
  data,
  context
}) => {
  return (
    <TakeawaysWidget
      data={data}
      storageGet={context.storage.getItem}
      storageSet={context.storage.setItem}
      copyText={context.copyText}
    />
  );
};
