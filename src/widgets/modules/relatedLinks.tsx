import { WidgetModule } from "../sdk/types.js";
import { RelatedLinksWidget } from "../components/RelatedLinksWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：相关多链接跳转 (related_links)
 * 独立模块文件 —— 智能聚合收录与相关主题深度链接
 */
export const relatedLinksModule: WidgetModule = {
  ...manifestMeta("related_links"),
  render: (ctx) => {
    return (
      <RelatedLinksWidget
        result={ctx.activeResult}
        query={ctx.activeResult?.query}
        onExecuteSearch={ctx.onExecuteSearch}
        openUrl={ctx.openUrl}
        copyText={ctx.copyText}
      />
    );
  }
};
