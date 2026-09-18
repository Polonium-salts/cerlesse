import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { TokenUsageData } from "./types.js";
import { TokenUsageWidget } from "../../components/TokenUsageWidget.js";

export const TokenUsageExtensionWidget: React.FC<ExtensionComponentProps<TokenUsageData>> = ({
  data,
  context
}) => {
  const result = data.activeResult || context.activeResult;
  return (
    <TokenUsageWidget
      result={result}
      query={data.query || result?.query}
      copyText={context.copyText}
    />
  );
};
