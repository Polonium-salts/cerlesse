import { WidgetModule } from "../sdk/types.js";
import { SourcesWidget } from "../components/SourcesWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：权威信源存证 (sources)
 */
export const sourcesModule: WidgetModule = {
  ...manifestMeta("sources"),
  render: (ctx) => {
    return (
      <SourcesWidget
        activeResult={ctx.activeResult}
        query={ctx.activeResult?.query}
        isCompact={ctx.isCompact}
      />
    );
  }
};
