import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { SourcesData } from "./types.js";
import { SourcesWidget } from "../../components/SourcesWidget.js";

export const SourcesExtensionWidget: React.FC<ExtensionComponentProps<SourcesData>> = ({
  data,
  context
}) => {
  return (
    <SourcesWidget
      activeResult={data.activeResult || context.activeResult}
      query={data.query || context.activeResult?.query}
      isCompact={context.isCompact}
    />
  );
};
