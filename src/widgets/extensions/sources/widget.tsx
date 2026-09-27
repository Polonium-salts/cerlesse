import React from "react";
import type { SourcesData } from "./types.js";
import { SourcesWidget } from "../../components/SourcesWidget.js";

export const SourcesExtensionWidget: React.FC<{ data: SourcesData }> = ({ data }) => {
  return (
    <SourcesWidget
      result={data.activeResult}
      sources={data.sources}
    />
  );
};
