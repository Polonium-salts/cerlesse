import { WidgetModule } from "../sdk/types.js";
import { VerificationChecklistWidget } from "../components/VerificationChecklistWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：事实核查清单 (verification_checklist)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 元信息全部来自插件清单 manifests/verification_checklist.json（含网格比例 grid.ratio）。
 *
 * 清单网格规格的由来：打勾清单：6 格 × 1:1 ≈ 615×615px。
 */
export const verificationChecklistModule: WidgetModule = {
  ...manifestMeta("verification_checklist"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return <VerificationChecklistWidget result={res} />;
  }
};
