import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { AiAnswerData } from "./types.js";
import { AiAnswerWidget, AiAnswerBackWidget } from "../../components/AiAnswerWidget.js";

export const AiAnswerExtensionWidget: React.FC<ExtensionComponentProps<AiAnswerData>> = ({
  data,
  context
}) => {
  const result = data?.activeResult || context.activeResult;
  const summary = data?.summary || result?.summary || (data as any)?.chatText || (data as any)?.answer || (data as any)?.content || "";
  const effectiveResult = result ? { ...result, summary: summary || result.summary } : ({ query: data?.query, summary } as any);
  return (
    <AiAnswerWidget
      result={effectiveResult}
      summary={summary}
      query={data?.query || result?.query || context.activeResult?.query}
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
  const result = data?.activeResult || context.activeResult;
  const summary = data?.summary || result?.summary || (data as any)?.chatText || (data as any)?.answer || (data as any)?.content || "";
  const effectiveResult = result ? { ...result, summary: summary || result.summary } : ({ query: data?.query, summary } as any);
  return (
    <AiAnswerBackWidget
      result={effectiveResult}
      summary={summary}
      query={data?.query || result?.query || context.activeResult?.query}
      onExecuteSearch={context.onExecuteSearch}
      openUrl={context.openUrl}
      copyText={context.copyText}
      flipTile={context.flipTile}
    />
  );
};
