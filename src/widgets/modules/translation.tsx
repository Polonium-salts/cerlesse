import { WidgetModule } from "../sdk/types.js";
import { TranslationWidget } from "../components/TranslationWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：多语言翻译与词典 (translation)
 * 独立模块文件 —— 支持跨语言翻译、词性发音、双语例句与一键复制
 */
export const translationModule: WidgetModule = {
  ...manifestMeta("translation"),
  render: (ctx) => {
    return (
      <TranslationWidget
        activeResult={ctx.activeResult}
        query={ctx.activeResult?.query}
        isCompact={ctx.isCompact}
      />
    );
  }
};
