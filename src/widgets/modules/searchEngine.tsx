import { WidgetModule } from "../sdk/types.js";
import { SearchEngineWidget } from "../components/SearchEngineWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：搜索引擎直达 (search_engine)
 * 独立模块文件 —— 支持 Google、Bing、百度等搜索引擎快速检索并直接跳转
 */
export const searchEngineModule: WidgetModule = {
  ...manifestMeta("search_engine"),
  render: (ctx) => {
    return (
      <SearchEngineWidget
        result={ctx.activeResult}
        query={ctx.activeResult?.query}
        onExecuteSearch={ctx.onExecuteSearch}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
      />
    );
  }
};
