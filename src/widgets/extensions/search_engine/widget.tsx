import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { SearchEngineData } from "./types.js";
import { SearchEngineWidget } from "../../components/SearchEngineWidget.js";

export const SearchEngineExtensionWidget: React.FC<ExtensionComponentProps<SearchEngineData>> = ({
  data,
  context
}) => {
  const result = data.activeResult || context.activeResult;
  return (
    <SearchEngineWidget
      result={result}
      query={data.query || result?.query}
      onExecuteSearch={context.onExecuteSearch}
      openUrl={context.openUrl}
      copyText={context.copyText}
    />
  );
};
