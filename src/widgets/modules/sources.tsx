import { WidgetModule } from "../sdk/types.js";
import { SourcesWidget } from "../components/SourcesWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：信源溯源存证 (sources)
 * 独立模块文件 —— 基于全网交叉核验的权威信源存证与引用链
 */
export const sourcesModule: WidgetModule = {
  ...manifestMeta("sources"),
  render: (ctx) => {
    return (
      <SourcesWidget
        result={ctx.activeResult}
        sources={ctx.data?.sources || ctx.activeResult?.sources}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
      />
    );
  },
  data: (activeResult) => {
    const list = activeResult?.sources || activeResult?.filteredResults || [];
    return {
      sources: list,
      count: list.length
    };
  }
};
