import { WidgetModule } from "../sdk/types.js";
import { QuickAnswerWidget } from "../components/QuickAnswerWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：直接速答 (quick_answer)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息（名称 / 描述 / 分类 / 图标 / 尺寸档位 / 网格比例 / 主题）全部来自
 * 插件清单 manifests/quick_answer.json —— 要调网格比例，改那份 JSON 的
 * grid.ratio 即可，不需要碰这个文件。
 *
 * 清单网格规格的由来：速答正文需横向铺陈，6 格 × 2:1 ≈ 615×307px。
 */
export const quickAnswerModule: WidgetModule = {
  ...manifestMeta("quick_answer"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return (
      <QuickAnswerWidget
        query={res.query}
        summary={res.summary}
        keyTakeaways={res.keyTakeaways}
        sourceCount={res.filteredResults?.length ?? 0}
        languageName={res.detectedLanguage?.name}
        size={ctx.size}
        copyText={ctx.copyText}
      />
    );
  },
  // 背面已移除：原来的「结论置信度与质检」是一组编造指标
  // （98% 可信 / 事实交叉吻合率 96% / "无事实冲突"），不是任何真实检测结果。
};
