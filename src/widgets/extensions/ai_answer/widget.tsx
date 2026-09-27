import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { AiAnswerData } from "./types.js";
import { AiAnswerWidget, AiAnswerBackWidget } from "../../components/AiAnswerWidget.js";

export const AiAnswerExtensionWidget: React.FC<ExtensionComponentProps<AiAnswerData>> = ({
  data,
  context
}) => {
  const result = data.activeResult || context.activeResult;
  return (
    <AiAnswerWidget
      result={result}
      query={data.query || result?.query}
      onExecuteSearch={context.onExecuteSearch}
      openUrl={context.openUrl}
      copyText={context.copyText}
      flipTile={context.flipTile}
    />
  );
};

export const AiAnswerBackExtensionWidget: React.FC<ExtensionComponentProps<AiAnswerData>> = ({
  data,
  context
}) => {
  const result = data.activeResult || context.activeResult;
  return (
    <AiAnswerBackWidget
      result={result}
      query={data.query || result?.query}
      onExecuteSearch={context.onExecuteSearch}
      openUrl={context.openUrl}
      copyText={context.copyText}
      flipTile={context.flipTile}
    />
  );
};
