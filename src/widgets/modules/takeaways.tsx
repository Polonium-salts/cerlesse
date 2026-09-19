import { WidgetModule } from "../sdk/types.js";
import {
  TakeawaysWidget,
  buildTakeawaysData,
  type TakeawaysData
} from "../components/TakeawaysWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：核心要点 (takeaways)
 * 条目式核心结论提炼，勾选进度经 ctx.storage 写入按 widget_id 隔离的命名空间
 */
export const takeawaysModule: WidgetModule<TakeawaysData> = {
  ...manifestMeta("takeaways"),
  data: (activeResult) => buildTakeawaysData(activeResult),
  render: (ctx) => (
    <TakeawaysWidget
      data={ctx.data}
      storageGet={ctx.storage.getItem}
      storageSet={ctx.storage.setItem}
      copyText={ctx.copyText}
    />
  )
};
