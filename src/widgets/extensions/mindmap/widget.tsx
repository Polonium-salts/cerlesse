import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { MindMapData } from "./types.js";
import { MindMapWidget } from "../../components/MindMapWidget.js";

export const MindMapExtensionWidget: React.FC<ExtensionComponentProps<MindMapData>> = ({
  data,
  context
}) => {
  return (
    <MindMapWidget
      activeResult={data.activeResult || context.activeResult}
      query={data.query || context.activeResult?.query}
      isCompact={context.isCompact}
    />
  );
};
