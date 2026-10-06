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
  // 优先用宿主显式注入的最新步骤，回退到 data/result 上的真实 steps
  const agentSteps = (context as any)?.agentSteps
    || data?.agentSteps
    || result?.steps
    || undefined;
  return (
    <AiAnswerWidget
      result={effectiveResult}
      summary={summary}
      query={data?.query || result?.query || context.activeResult?.query}
      openUrl={context.openUrl}
      copyText={context.copyText}
      flipTile={context.flipTile}
      agentSteps={agentSteps}
      language={(context as any)?.language}
      askModeHint
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
      openUrl={context.openUrl}
      copyText={context.copyText}
      flipTile={context.flipTile}
      language={(context as any)?.language}
    />
  );
};
