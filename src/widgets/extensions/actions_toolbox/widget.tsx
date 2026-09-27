import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { ActionsToolboxData } from "./types.js";
import { ActionsToolboxWidget } from "../../components/ActionsToolboxWidget.js";

export const ActionsToolboxExtensionWidget: React.FC<ExtensionComponentProps<ActionsToolboxData>> = ({
  data,
  context
}) => {
  return (
    <ActionsToolboxWidget
      activeResult={data.activeResult || context.activeResult}
      query={data.query || context.activeResult?.query}
      isCompact={context.isCompact}
    />
  );
};
