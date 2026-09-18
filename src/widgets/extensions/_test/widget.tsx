import React from "react";
import type { ExtensionComponentProps } from "../../sdk/extension.js";
import type { TestExtensionData } from "./adapter.js";

export function TestWidget({ data }: ExtensionComponentProps<TestExtensionData>) {
  return (
    <div 
      data-widget-id="test_extension"
      className="p-4 rounded-xl border border-border bg-card text-card-foreground flex flex-col justify-center items-center h-full min-h-[120px] text-center"
    >
      <div className="text-sm font-semibold text-foreground">Widget Extension SDK OK</div>
      {data?.message && (
        <div className="text-xs text-muted-foreground mt-1">{data.message}</div>
      )}
    </div>
  );
}
