import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { RelatedLinksData } from "./types.js";
import { RelatedLinksWidget } from "../../components/RelatedLinksWidget.js";

export const RelatedLinksExtensionWidget: React.FC<ExtensionComponentProps<RelatedLinksData>> = ({
  data,
  context
}) => {
  const result = data.activeResult || context.activeResult;
  return (
    <RelatedLinksWidget
      result={result}
      query={data.query || result?.query}
      onExecuteSearch={context.onExecuteSearch}
      openUrl={context.openUrl}
      copyText={context.copyText}
    />
  );
};
