import { WidgetModule } from "../sdk/types.js";
import { MobileQRConnectWidget } from "../components/MobileQRConnectWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

/**
 * 小组件：复制本页链接 (mobile_qr)
 * 独立模块文件 —— 一个文件即一个小组件。
 *
 * 说明：原「移动互联二维码」绘制的是一张无法扫描的假二维码（见组件内注释），
 * 且把官网 URL 当作"移动端接手地址"传递。现改为呈现当前页面真实链接并提供复制，
 * 模块 id 与能力标签保持不变，避免影响布局引擎与能力标签表的既有映射。
 *
 * 元信息全部来自插件清单 manifests/mobile_qr.json（含网格比例 grid.ratio）。
 */
export const mobileQRModule: WidgetModule = {
  ...manifestMeta("mobile_qr"),
  render: (ctx) => {
    const res = ctx.activeResult;
    if (!res) return null;
    return <MobileQRConnectWidget query={res.query} />;
  }
};
