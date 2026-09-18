import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { ComparisonData } from "./types.js";
import { ComparisonWidget } from "../../components/ComparisonWidget.js";

export const ComparisonExtensionWidget: React.FC<ExtensionComponentProps<ComparisonData>> = ({
  data,
  context
}) => {
  return (
    <ComparisonWidget
      activeResult={data.activeResult || context.activeResult}
      query={data.query || context.activeResult?.query || ""}
      isCompact={context.isCompact}
    />
  );
};
