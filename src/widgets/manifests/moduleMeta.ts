import type { WidgetModule } from "../sdk/types.js";
import { MANIFEST_BY_ID, type WidgetManifest } from "./index.js";
import { resolveManifestIcon } from "./icons.js";

/**
 * 清单 → 模块元信息 (Manifest → WidgetModule Meta)
 * ============================================================
 * 模块文件（modules/*.tsx）从此只保留 `render` / `data` / `actions` 这类
 * **行为**，全部**元信息**（名称 / 描述 / 分类 / 图标 / 尺寸档位 / 网格比例 /
 * 主题色）统一由清单 JSON 提供。
 *
 * 这样做的好处：
 *   1. 改网格比例、换图标、调节默认宽度，都只需要编辑 JSON —— 不碰任何 TSX，
 *      也不会有"改了模块忘了同步布局引擎比例表"这种两边失配的问题；
 *   2. 插件市场、图标渲染、布局引擎共用同一份数据源，天然一致。
 */

/** 模块元信息切片：清单能提供的所有字段 */
export type WidgetModuleMeta = Pick<
  WidgetModule,
  | "id"
  | "name"
  | "version"
  | "description"
  | "category"
  | "tags"
  | "agentHint"
  | "icon"
  | "width"
  | "supportedWidths"
  | "tileTheme"
>;

/** 把一份清单展开成 WidgetModule 的元信息部分 */
export function manifestToModuleMeta(manifest: WidgetManifest): WidgetModuleMeta {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    category: manifest.category,
    tags: manifest.tags,
    agentHint: manifest.agentHint,
    icon: resolveManifestIcon(manifest.icon),
    // 宽度档位的唯一事实来源就是清单的 grid 段
    width: manifest.grid.width,
    supportedWidths: manifest.grid.supportedWidths,
    tileTheme: manifest.theme
  };
}

/**
 * 按 id 取元信息 —— 模块文件的唯一入口。
 *
 * 模块文件写法：
 *   export const xxxModule: WidgetModule = {
 *     ...manifestMeta("xxx"),
 *     render: (ctx) => <...>
 *   };
 *
 * 清单缺失属于装配错误（id 拼错、或忘了在 manifests/index.ts 登记）。
 * 这里选择「大声降级」而非抛错：抛错会中断 modules/index 的导入链，
 * 让全部 16 个小组件一起消失；降级只让这一个模块丢元信息，其余照常可用，
 * 同时控制台留下可定位的报错。
 */
export function manifestMeta(id: string): WidgetModuleMeta {
  const manifest = MANIFEST_BY_ID[id];
  if (!manifest) {
    console.error(
      `[WidgetManifest] 找不到小组件清单 "${id}"。请确认 src/widgets/manifests/ 下存在同名 JSON，` +
        `且已登记进 manifests/index.ts 的 WIDGET_MANIFESTS 清单。`
    );
    return {
      id,
      name: id,
      version: "0.0.0",
      width: 50,
      supportedWidths: [25, 50, 75, 100]
    };  }
  return manifestToModuleMeta(manifest);
}
