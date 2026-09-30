# 智能桌面小组件 (Widget & Live Tile) 开发规范与接口开发文档

> 本文档面向前端开发者、小组件插件作者以及大模型 Agent 工程师，详细阐述 Cerlesse 智搜系统中可交互业务小组件（Widget & Live Tile）的架构设计、清单描述符（Manifest）、标签与属性启发式选取、数据接口契约、尺寸规范以及完整的开发接入标准。

---

## 目录
- [一、小组件架构总览](#一小组件架构总览)
- [二、小组件标签 (Tags) 与底层属性 (AgentHint) 机制](#二小组件标签-tags-与底层属性-agenthint-机制)
- [三、清单规范 (Widget Manifest Specification)](#三清单规范-widget-manifest-specification)
- [四、设计与排版规范（12 栅格磁贴系统）](#四设计与排版规范12-栅格磁贴系统)
- [五、核心接口与数据契约 (SDK Interfaces)](#五核心接口与数据契约-sdk-interfaces)
  - [1. 插件模块定义 (WidgetModule)](#1-插件模块定义-widgetmodule)
  - [2. 运行时沙箱上下文 (WidgetContext)](#2-运行时沙箱上下文-widgetcontext)
  - [3. 声明式组件树 (WidgetSchema & SchemaNode)](#3-声明式组件树-widgetschema--schemanode)
  - [4. 规范能力分类体系 (Canonical Capabilities)](#4-规范能力分类体系-canonical-capabilities)
- [六、小组件业务原型 (Archetypes) 与官方库](#六小组件业务原型-archetypes-与官方库)
- [七、实战开发范式与完整示例](#七实战开发范式与完整示例)
  - [步骤 1：编写小组件清单 (Manifest JSON)](#步骤-1编写小组件清单-manifest-json)
  - [步骤 2：编写原生 React 交互插件模块（含 3D 翻转）](#步骤-2编写原生-react-交互插件模块含-3d-翻转)
  - [步骤 3：声明式 JSON Schema 零代码动态组件](#步骤-3声明式-json-schema-零代码动态组件)
  - [步骤 4：组件注册与挂载 (Widget Registry)](#步骤-4组件注册与挂载-widget-registry)
- [八、安全约束与最佳实践](#八安全约束与最佳实践)

---

## 一、小组件架构总览

Cerlesse 采用**单智能体端到端编排 + 清单驱动 (Manifest-Driven) + 双轨制渲染架构**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SearchAgent 意图分析与组件智能决策                      │
│     (根据搜索内容、信源特征，结合小组件 Tags、AgentHint 与启发式准则优选)      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     LayoutAgent 12 栅格装箱排版引擎                      │
│        (读取 Manifest 网格尺寸与 ratio，输出最优 colSpan 与优先序)       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
     【声明式 Schema 路径】                  【原生 React Module 路径】
   Agent 输出结构化纯 JSON                 编写独立 TypeScript/React 组件
   零 XSS 风险，跨端极速解析               丰富交互、自定义动效与本地存储隔离
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       沙箱运行时与 Live Tile 桌面                        │
│   - WidgetContext 沙箱隔离 (受控 actions, 命名空间持久化 storage)         │
│   - 12 栅格行带对齐排版 (TileLayoutEngine: 3/6/9/12 格对齐)            │
│   - 3D Live Tile 正反面翻转、全景小组件中心与焦点联动                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、小组件标签 (Tags) 与底层属性 (AgentHint) 机制

为保证 Agent 能够精准结合用户搜索意图和检索数据质量，选取**实用性最佳**的小组件，系统引入了**标签（Tags）**与**底层属性启发式契约（AgentHint）**。

### 1. 标签属性结构 (Tagging Schema)

每个小组件在清单中定义显式标签数组与底层提示契约：

```json
{
  "tags": ["官网导航", "官方入口", "多链接直达", "安全校验", "权威信源"],
  "agentHint": {
    "functionality": "聚合检索结果中提炼的官方正版入口与主要子频道，以长方形圆角卡片陈列，提供一键外部安全直达",
    "bestFor": [
      "用户寻找工具、软件、平台、服务的官方网站或正版入口",
      "检索内容包含多个官方子频道或权威镜像链接",
      "导航类、下载类、平台登录类意图"
    ],
    "dataRequirements": [
      "检索结果中包含经过域名权威度校验的有效 URL",
      "包含网站名称与功能简述"
    ],
    "selectionHeuristics": "当且仅当检索到明确的官网正版入口时最高优先级推荐；若仅有零散讨论贴则降级",
    "triggerKeywords": ["官网", "下载", "正版", "网址", "官方网站", "入口", "主页", "官方平台"],
    "antiPatterns": [
      "纯学术理论探讨或历史常识名词解释（无对应官方站点）"
    ]
  }
}
```

### 2. Agent 选取决策流程

1. **意图匹配度评分**：Agent 提取用户 Query 关键词与意图类型（如 `portal_navigation`, `tool_discovery`, `explain`, `comparison`），与各小组件的 `triggerKeywords` 和 `bestFor` 进行向量与关键字双重匹配。
2. **底层数据特征判定**：根据 `dataRequirements` 校验检索到的实时信源（如是否存在有效链接、表格数据、步骤列表、对比维度）。
3. **启发式裁决 (`selectionHeuristics`)**：排斥命中 `antiPatterns` 的组件，将实用性得分最高的 2~4 个组件打包为当前查询的 `widgetPlan`。

---

## 三、清单规范 (Widget Manifest Specification)

所有小组件的形状、尺寸、元信息均由 JSON 清单统一声明（位于 `src/widgets/manifests/*.json`），修改清单即可调整磁贴尺寸与长宽比，**无需修改渲染代码**。

### 字段说明清单

| 字段名 | 类型 | 必填 | 描述说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 全局唯一 ID，必须与 `WidgetModule.id` 完全一致。 |
| `name` | `string` | 是 | 磁贴标题栏显示的友好名称。 |
| `version` | `string` | 是 | 语义化版本号（遵循 semver）。 |
| `description` | `string` | 否 | 一句话描述，用于小组件中心/插件市场卡片。 |
| `category` | `enum` | 是 | 分组：`synthesis`（综合）\| `analysis`（分析）\| `action`（行动）\| `portal`（入口）\| `custom`（自定义）。 |
| `tags` | `string[]` | 是 | 语义与功能标签列表，供 Agent 提示与用户检索。 |
| `agentHint` | `object` | 是 | 底层功能描述、适用场景、信源要求与启发式选取准则。 |
| `icon` | `string` | 否 | Lucide 图标名称（白名单定义于 `icons.ts`）。 |
| `grid.width` | `TileWidth` | 是 | 默认占列宽度档位，**只能取 `25` \| `50` \| `75` \| `100`**（对应 12 栅格中的 3 / 6 / 9 / 12 列）。 |
| `grid.supportedWidths`| `TileWidth[]` | 是 | 允许用户手动缩放切换的宽度档位集合，取值同样限定在 `25/50/75/100`，且必须包含 `grid.width`。 |
| `grid.ratio` | `string` | 是 | 宽高比基线（`1:1`, `4:3`, `3:2`, `16:9`, `2:1`, `3:1`, `4:5`）。高度以 `宽度 ÷ ratio` 为**下限**，内容放不下时可继续增高（见下方说明），但绝不会被压到比例之下。 |
| `grid.minWidth` | `TileWidth` | 否 | 最小宽度保护档位，必须 ≤ `grid.width` 且落在四档内（如 `25`）。 |
| `theme.accentColor` | `string` | 否 | 强调点缀色 HEX（如 `#0ea5e9`）。 |
| `theme.badgeText` | `string` | 否 | 磁贴右上角实时徽标文案（如 `PRO`, `LIVE`）。 |
| `theme.animation` | `string` | 否 | 动效类名（如 `pulse`, `glow`, `none`）。 |

---

## 四、设计与排版规范（12 栅格磁贴系统）

系统基于现代 Bento Grid 与磁贴排版系统，统一采用 **12 列栅格（12-Column Grid）** 进行行带对齐装箱。

### 1. 尺寸档位契约 (`TileWidth`)

宽度词汇表**全链路唯一**：清单、SDK 契约、Agent 决策、装箱求解器、渲染层一律使用 `TileWidth`，
取值仅限 **`25` / `50` / `75` / `100`**（百分比语义，即占满行的比例）。

| 宽度档位 (`TileWidth`) | 栅格跨度 (`colSpan`) | 占比 | 典型应用场景 | 建议长宽比 |
| :--- | :--- | :--- | :--- | :--- |
| `25` | **3 格** | 1/4 宽 | 快速指标、核心要点速记、官网跳转卡片、单值小组件 | `4:3` 或 `1:1` |
| `50` | **6 格** | 1/2 宽 (半屏) | AI 智能回答、对比分析矩阵、参数对照、检查清单 | `4:3` 或 `3:2` |
| `75` | **9 格** | 3/4 宽 | 综合思维导图、全流程步骤拆解、宽幅时间线 | `4:3` 或 `16:9` |
| `100` | **12 格** | 100% 满宽 | 超宽全景研报、大表格、全链路知识图谱 | `3:1` 或 `16:9` |

> 📌 **宽度契约要点**：
> - 类型定义位于 `src/lib/tileLayoutEngine.ts`：`export type TileWidth = 25 | 50 | 75 | 100;`
> - **历史清单兼容**：旧清单中的 `small` / `medium` / `large` / `wide` / `tall` / `full` 名称不会被拒绝，
>   由 `normalizeTileWidth()` 自动映射到**最近的档位**后再参与排版；新组件请直接写数字。
> - **官网跳转 (`related_links`)**：默认 `25`（3 格窄栏，`ratio: 4:3`），置顶推荐。
> - **AI 智能回答 (`ai_answer`)**：默认 `50`（6 格半宽，`ratio: 4:3`），与官网卡片或其它深度分析并排呈现，避免过度占用整屏空间。
> - **核心要点 (`takeaways`)**：默认 `25`（3 格窄栏，`ratio: 4:3`）。
>
> ⚠️ **宽度是硬契约，高度是下限**：磁贴的实际像素宽度**严格等于** `占据列数 ÷ 12 × 容器宽`，
> 由 `grid.width` 唯一决定；高度则取 `max(宽度 ÷ ratio, 实测内容高度)`——渲染层会实测内容的
> 自然高度并回填 `contentHeightPx`，宁可让磁贴长高，也不裁切文字。因此 `ratio` 是"最少给这么多
> 高度"，而不是"只能这么多"。
>
> ⚠️ **新增/修改小组件时，`grid.ratioMode` 默认必须为 `flexible`**：
> 仅当组件的内容在设计上就应该固定展示区域、超出部分理应通过内部滚动查看（例如聊天记录、日志流这类天然无限增长的内容）时，
> 才允许显式声明 `"ratioMode": "strict"`，并需注明理由。对于"随检索结果数量变化的列表/卡片流"类组件（如官网入口、来源列表、
> 核对清单等），一律使用 `flexible`，让磁贴随内容数量自然长高，不得依赖内部滚动掩盖内容被裁切的问题。可配置 `itemHeightPx` 与
> `baseHeightPx` 进行首帧高度预估以避免页面加载抖动。

### 2. 响应式规则
- **桌面端 (Desktop ≥ 1024px)**: 完整 12 列栅格，严格遵循装箱对齐；
- **平板端 (Tablet 640px~1023px)**: 自适应折叠为 6 列网格；
- **移动端 (Mobile < 640px)**: 统一平铺为单列 100% 宽度，触控区高亮且 ≥ 44px。

---

## 五、核心接口与数据契约 (SDK Interfaces)

所有小组件 SDK 类型定义均导出自 `src/widgets/sdk/types.ts`。

### 1. 插件模块定义 (`WidgetModule`)

```typescript
export interface WidgetModule<TData = any> {
  /** 唯一组件标识符（如 'action_checklist' 或 'related_links'） */
  id: string | ResultWidgetKey;
  
  /** 组件显示名称 */
  name: string;
  
  /** 语义化版本号 */
  version: string;
  
  /** 功能简述 */
  description?: string;
  
  /** 分类：synthesis | analysis | action | portal | custom */
  category?: WidgetCategoryType;
  
  /** 图标组件（Lucide 图标）或图标名 */
  icon?: React.ComponentType<{ className?: string }> | string;
  
  /** 默认磁贴宽度（25 / 50 / 75 / 100，对应 12 栅格的 3 / 6 / 9 / 12 列） */
  width: TileWidth;
  
  /** 支持切换的宽度列表，取值仅限 25 / 50 / 75 / 100 */
  supportedWidths?: TileWidth[];
  
  /** 磁贴主题配置（点缀色、磁贴徽标、动效） */
  tileTheme?: TileThemeConfig;

  /** 声明式纯 JSON 结构树（若为纯 Schema 组件） */
  schema?: WidgetSchema;
  
  /** 原生 React 渲染函数 */
  render?: (ctx: WidgetContext<TData>) => React.ReactNode | TileSchemaDescriptor;
  
  /** Live Tile 3D 背面渲染函数（承载设置项、数据明细、历史记录） */
  renderBack?: (ctx: WidgetContext<TData>) => React.ReactNode | TileSchemaDescriptor;

  /** 数据清洗/映射管道：将全网搜索与 Agent 综合研报清洗为组件私有数据 */
  data?: (activeResult?: SearchSynthesisResult) => TData;

  /** 注册的动作处理函数映射表 */
  actions?: Record<string, (ctx: WidgetContext<TData>, payload?: any) => void | Promise<void>>;
}
```

---

### 2. 运行时沙箱上下文 (`WidgetContext`)

在小组件渲染或动作执行时，系统向其注入受限且类型安全的沙箱上下文：

```typescript
export interface WidgetContext<TData = any> {
  /** 输入数据源（经由 data 管道清洗后的数据） */
  data: TData;
  
  /** 全网检索与 Agent 研报原始对象 */
  activeResult?: SearchSynthesisResult;
  
  /** 当前组件的磁贴宽度档位（25 / 50 / 75 / 100） */
  size: TileWidth;
  
  /** 是否处于紧凑视图 (25% 窄栏 / mobile) */
  isCompact: boolean;
  
  /** 宿主桥接：请求将当前磁贴切换到指定宽度档位 */
  onResize?: (nextSize: TileWidth) => void;
  
  /** 局域响应式状态 */
  state: Record<string, any>;
  
  /** 局域状态更新器 */
  setState: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  
  /** 动作调度总线：触发当前组件已注册的 actions */
  actions: Record<string, (payload?: any) => void>;
  
  /** 宿主桥接：触发应用二次检索 */
  onExecuteSearch?: (query: string, deep?: boolean) => void;
  
  /** 宿主桥接：安全打开外部链接（防钓鱼与属性隔离） */
  openUrl?: (url: string) => void;
  
  /** 宿主桥接：复制文本到剪贴板并弹出 Toast */
  copyText?: (text: string) => void;
  
  /** Live Tile 翻转状态与翻转操作 */
  isFlipped?: boolean;
  flipTile?: () => void;

  /** 命名空间隔离的本地持久化存储（避免不同组件间 storage 键冲突） */
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
}
```

---

### 3. 声明式组件树 (`WidgetSchema` & `WidgetSchemaNode`)

大模型或后端可以直接生成纯 JSON 格式的 `WidgetSchema`，由前端渲染引擎 (`schemaRenderer.tsx`) 统一渲染为高度一致且安全的 UI 节点：

```typescript
export interface WidgetSchema {
  type: "widget";
  id: string;
  name: string;
  version?: string;
  size: TileWidth;
  layout: "card" | "dashboard" | "split" | "list" | "matrix";
  themeColor?: "blue" | "emerald" | "violet" | "amber" | "rose" | "zinc";
  iconName?: string;
  description?: string;
  components: WidgetSchemaNode[];
}

export type WidgetSchemaNode =
  | { type: "text"; text: string; variant?: "title" | "subtitle" | "body" | "caption" | "code"; color?: string; }
  | { type: "metric"; label: string; value: string | number; trend?: string; unit?: string; icon?: string; }
  | { type: "badge"; label: string; variant?: "blue" | "emerald" | "amber" | "rose" | "zinc" | "violet"; icon?: string; }
  | { type: "button"; label: string; action: string; payload?: any; variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; icon?: string; }
  | { type: "kv_list"; items: Array<{ key: string; val: string; copyable?: boolean }>; }
  | { type: "checklist"; items: Array<{ id: string; text: string; done?: boolean }>; }
  | { type: "timeline"; events: Array<{ time?: string; title: string; desc?: string; status?: "completed" | "current" | "pending" }>; }
  | { type: "table"; headers: string[]; rows: string[][]; }
  | { type: "code"; code: string; language?: string; copyable?: boolean; }
  | { type: "link"; label: string; url: string; isExternal?: boolean; }
  | { type: "progress"; value: number; max?: number; label?: string; }
  | { type: "tags"; items: string[]; };
```

---

### 4. 规范能力分类体系 (`Canonical Capabilities`)

所有能力标识统一在 `src/widgets/capabilities.ts` 与 `capabilityTaxonomy.ts` 中声明：

- **官方与导航类**：`official_portal`, `download`, `release_binary`, `environment_checklist`, `install_command`
- **分析与决策类**：`instant_verdict`, `summary_points`, `compare_table`, `pros_cons`, `benchmark_table`, `evidence_chain`
- **学习与规划类**：`roadmap_step`, `code_snippet`, `verified_docs`, `progress_tracker`, `trend_signals`

---

## 六、小组件业务原型 (Archetypes) 与官方库

### 1. 已实现并注册的官方小组件库

系统中所有小组件已通过 **统一扩展 SDK (`src/widgets/extensions/`)** 与 **清单驱动架构 (`src/widgets/manifests/`)** 完整实现，每个小组件均具备独立的 `manifest.ts`、`adapter.ts`、`widget.tsx` 与类型契约，在启动期由 `scripts/widgets/generate.ts` 与 `generatedRegistry.ts` 静态注册并挂载到注册中心（Extension Registry）：

| 组件 ID | 业务原型 | 核心标签 (Tags) | 默认宽度 (`grid.width`) | 核心功能与亮点 |
| :--- | :--- | :--- | :--- | :--- |
| `ai_answer` | `synthesis` | AI回答, 深度推理, 核心结论 | `100` / `50` | 结构化多源提炼、Markdown 高亮、长文自适应提升至 75% |
| `sources` | `analysis` | 权威信源, 引文存证, 交叉校验 | `50`（6 格半宽） | 全网信源引文出处、域名权重、时间戳与存证溯源卡片 |
| `related_links` | `portal` | 官网导航, 官方入口, 多链接直达 | `50` / `25` | 提炼官方网站及子频道，提供安全直达与导航推荐，默认常驻 |
| `takeaways` | `synthesis` | 核心要点, 提炼速记 | `50` / `25` | 结构化核心要点速览清单，支持逐条勾选并本地存储记忆 |
| `comparison` | `analysis` | 对比矩阵, 横向评测, 优劣分析 | `75`（9 格宽） | 多维横向对比矩阵、参数 PK 与多方案决策对比表格 |
| `mindmap` | `synthesis` | 知识导图, 拓扑架构, 逻辑树 | `75`（9 格宽） | 层级知识树、系统拓扑与全景架构导图，支持全屏联动 |
| `troubleshooting`| `action` | 排错诊断, 故障排查, 解决方案 | `75`（9 格宽） | 错误原因定位、修复步骤与排错解决方案 |
| `verification_checklist` | `action` | 校验清单, 依赖检查, 前置条件 | `50`（6 格半宽） | 信源交叉核验清单与环境检查，支持交互勾选与验证存证 |
| `actions_toolbox`| `action` | 快捷工具, CLI 命令, 操作执行 | `50`（6 格半宽） | 一键运行 CLI、命令复制、环境安装与实用工具链 |
| `image_gallery` | `portal` | 图片矩阵, 视觉呈现, 视觉信源 | `75`（9 格宽） | 检索图片高清瀑布流、大图预览与视觉溯源 |
| `search_engine` | `portal` | 跨引擎直达, 搜索引擎, 聚合搜索 | `25`（3 格窄栏） | 跨各大搜索引擎（Google/Bing/DuckDuckGo/Baidu）一键直达 |
| `token_usage` | `analysis` | Token统计, 耗时监控, 成本分析 | `25`（3 格窄栏） | 检索与生成过程的实时 Token 消耗、延时指标与历史趋势统计 |
| `weather` | `portal` | 实时天气, 气温预报, 空气质量 | `50`（6 格半宽） | 目标城市实时气象、逐小时趋势与多日预报 |
| `translation` | `portal` | 文本翻译, 双语释义, 词典例句 | `50`（6 格半宽） | 多语言实时翻译、音标语法、例句与生词本存储 |
| `code_playground`| `action` | 代码试验, 在线运行, 语法高亮 | `75`（9 格宽） | 代码片段在线演练、编辑与语法高亮 |
| `software_info` | `portal` | 软件详情, 版本架构, 安装方式 | `50`（6 格半宽） | 软件/开源项目元信息、许可证、安装命令与版本矩阵 |
| `repository` | `analysis` | 代码仓库, Star趋势, Commit动态 | `50`（6 格半宽） | GitHub 仓库实时统计、语言分布与贡献者概览 |
| `download` | `portal` | 资源下载, 二进制包, 镜像地址 | `50`（6 格半宽） | 官方与镜像下载通道、哈希校验码与安装指引 |
| `trend_chart` | `analysis` | 趋势走向, 热度指数, 历时变动 | `75`（9 格宽） | 时序数据可视化图表与关键转折点标注 |
| `custom_cards` | `custom` | 业务卡片套件, Agent锻造 | `100` / `75` | Agent 运行时动态锻造的特定领域业务卡片（由 `cardForge` 生成） |

### 2. 规划层意图裁决与容错机制 (`server/widgetPlanner.ts`)

`server/widgetPlanner.ts` 与前端 `TileDesktopView` 协同遵循以下健壮性规则：

1. **统一白名单过滤 (`RENDERABLE_WIDGET_IDS`)**：自动将所有已注册官方小组件与扩展 Catalog 纳入合法白名单，杜绝未定义类型。
2. **意图降级兜底**：若 Agent 提议的组件类型暂未注册，若其具有较强解答/摘要属性，自动优雅降级映射为 `ai_answer`，绝不输出空白桌面。
3. **空模块剔除防幽灵磁贴**：前端渲染层在磁贴装箱前校验模块有效性，未注册模块直接跳过，防止占用网格空间形成白块。
4. **统一适用性网关 (`Unified Applicability Gate`)**：`evaluateWidgetApplicability` 结合信源质量与意图类型对组件做前置放行与拦截（如纯文本搜索拦截无信源的图片或天气组件），避免无效组件渲染。

---

## 七、实战开发范式与完整示例

### 步骤 1：编写小组件清单 (Manifest JSON)

在 `src/widgets/manifests/` 下创建 `my_tool_widget.json`：

```json
{
  "$schema": "./widget-manifest.schema.json",
  "id": "my_tool_widget",
  "name": "极速开发工具箱",
  "version": "1.0.0",
  "description": "提供开发常用命令一键生成与校验",
  "category": "action",
  "tags": ["开发工具", "代码生成", "命令执行", "效率提效"],
  "agentHint": {
    "functionality": "提取检索结果中的核心 CLI 命令或配置模板，提供一键复制与本地状态暂存",
    "bestFor": ["代码开发、配置环境、CLI 工具使用类检索"],
    "dataRequirements": ["包含可执行的 Shell/Git/Docker 命令或配置片段"],
    "selectionHeuristics": "当用户查询包含安装、配置、指令生成时优先选择",
    "triggerKeywords": ["cli", "command", "安装", "配置", "指令", "脚本"],
    "antiPatterns": ["纯概念科普问答"]
  },
  "icon": "Terminal",
  "grid": {
    "width": 50,
    "supportedWidths": [25, 50, 75, 100],
    "ratio": "4:3",
    "minWidth": 25
  },
  "theme": {
    "accentColor": "#10b981",
    "badgeText": "CLI",
    "animation": "glow"
  }
}
```

---

### 步骤 2：编写原生 React 交互插件模块（含 3D 翻转）

创建 `src/widgets/modules/MyToolWidget.tsx`：

```tsx
import React from "react";
import { WidgetModule, WidgetContext } from "../sdk/types.js";
import { Terminal, Copy, RotateCw, CheckCircle2 } from "lucide-react";

interface ToolItem {
  id: string;
  name: string;
  cmd: string;
}

interface ToolData {
  title: string;
  tools: ToolItem[];
}

export const MyToolWidget: WidgetModule<ToolData> = {
  id: "my_tool_widget",
  name: "极速开发工具箱",
  version: "1.0.0",
  category: "action",
  width: 50,
  supportedWidths: [25, 50, 75, 100],

  // 数据清洗管道
  data: (activeResult) => {
    return {
      title: activeResult?.query ? `${activeResult.query} 常用指令` : "常用开发指令",
      tools: [
        { id: "1", name: "启动开发服务", cmd: "npm run dev" },
        { id: "2", name: "构建生产包", cmd: "npm run build" },
        { id: "3", name: "代码质量检查", cmd: "npm run lint" }
      ]
    };
  },

  // 动作分发
  actions: {
    copyCommand: (ctx, payload: { cmd: string }) => {
      ctx.copyText?.(payload.cmd);
      ctx.storage.setItem("last_copied", payload.cmd);
    }
  },

  // 正面渲染
  render: (ctx: WidgetContext<ToolData>) => {
    const { title, tools } = ctx.data;

    return (
      <div className="flex flex-col h-full justify-between p-4 space-y-3">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground truncate">{title}</h4>
          </div>
          <button
            onClick={ctx.flipTile}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="翻转查看说明"
          >
            <RotateCw className="size-3.5" />
          </button>
        </div>

        {/* 列表 */}
        <div className="space-y-2 flex-1 overflow-y-auto">
          {tools.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 text-xs"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{item.name}</span>
                <code className="text-[11px] text-muted-foreground font-mono">{item.cmd}</code>
              </div>
              <button
                onClick={() => ctx.actions.copyCommand({ cmd: item.cmd })}
                className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                title="一键复制"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
          <span>点击图标可一键复制到剪贴板</span>
          <CheckCircle2 className="size-3 text-primary" />
        </div>
      </div>
    );
  },

  // 3D 背面渲染
  renderBack: (ctx: WidgetContext<ToolData>) => {
    const lastCopied = ctx.storage.getItem("last_copied") || "暂无记录";

    return (
      <div className="flex flex-col h-full justify-between p-4 bg-muted/20">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">关于工具箱</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            最近一次复制的指令：<code className="text-primary font-mono">{lastCopied}</code>
          </p>
        </div>
        <button
          onClick={ctx.flipTile}
          className="w-full py-1.5 px-3 bg-secondary text-secondary-foreground text-xs rounded-lg hover:bg-secondary/80 transition-colors"
        >
          返回正面
        </button>
      </div>
    );
  }
};
```

---

### 步骤 3：声明式 JSON Schema 零代码动态组件

如果由 Agent 动态输出或后端 API 直出，只需返回结构化 JSON：

```json
{
  "type": "widget",
  "id": "python-env-setup",
  "name": "Python 极速环境配置",
  "size": 50,
  "layout": "card",
  "themeColor": "emerald",
  "iconName": "Terminal",
  "components": [
    {
      "type": "metric",
      "label": "推荐环境管理",
      "value": "uv / rye",
      "unit": "Rust 极速版",
      "icon": "Zap"
    },
    {
      "type": "code",
      "code": "curl -LsSf https://astral.sh/uv/install.sh | sh",
      "language": "bash",
      "copyable": true
    },
    {
      "type": "checklist",
      "items": [
        { "id": "1", "text": "安装最新包管理工具", "done": true },
        { "id": "2", "text": "配置镜像源加速", "done": false }
      ]
    }
  ]
}
```

---

### 步骤 4：组件注册与挂载 (`Widget Registry`)

在 `src/widgets/registry.tsx` 中完成统一挂载：

```typescript
import { WidgetRegistry } from "./registry.js";
import { MyToolWidget } from "./modules/MyToolWidget.js";

// 注册新组件
WidgetRegistry.register(MyToolWidget);
```

注册完成后，`SearchAgent` 与 `LayoutAgent` 即可自动感知该小组件，在命中相应意图或触发关键词时自动编排并渲染于 12 栅格磁贴桌面中。

> 📌 **别忘了同步清单**：仅有 `WidgetModule` 还不足以驱动尺寸与元信息——磁贴的宽度档位与长宽比由
> `src/widgets/manifests/<id>.json` 的 `grid` 段声明（见步骤 1）。`width` 的**唯一合法取值是
> `25` / `50` / `75` / `100`**，若清单缺失该组件会回落到默认 `50`。

---

## 八、安全约束与最佳实践

1. **绝对禁止直接注入危险代码**：
   - 严禁使用 `eval()`、`new Function()` 或在 JSX 中使用未经过滤的 `dangerouslySetInnerHTML`。
   - 所有外部链接必须使用 `ctx.openUrl(url)` 或显式添加 `rel="noopener noreferrer"`。
2. **状态与存储隔离**：
   - 必须使用 `ctx.storage` 替代直接读写全局 `localStorage`，系统会自动按 `widget_id` 注入命名空间前缀，防止键名污染。
3. **容错与优雅降级**：
   - 组件内部对空数据、网络超时的字段必须提供保底缺省值（Default Props），确保即使搜索结果不完整也能正常渲染。
4. **单行文本与无死角响应式**：
   - 按钮、指标徽标（Badge）、Tab 项文本必须保持单行（`whitespace-nowrap`），禁止折行破坏 12 栅格整体对齐。

---

## 九、基于 jsDelivr + GitHub 的远程小组件发布规范 (jsDelivr CDN Specification)

小组件开发者无需自行购买或运维 CDN 服务器，即可通过 **GitHub 仓库 + Git Release/Tag + jsDelivr** 将小组件免维护发布给 Cerlesse 用户即插即用：

### 1. 推荐开源仓库目录结构

```text
my-widget-repo/
├── package.json
├── src/
│   ├── index.tsx          # 小组件 React 代码 (可选)
│   ├── manifest.json      # Cerlesse 标准 Manifest
│   └── icon.svg           # 小组件矢量图标 (可选)
├── dist/                  # 构建输出目录 (发布分支或 Release)
│   ├── manifest.json      # 核心清单文件 (必需)
│   ├── index.js           # 构建好的 JS 代码 (可选)
│   └── icon.svg           # 矢量或 PNG 图标 (可选)
└── README.md
```

### 2. 标准 jsDelivr CDN 访问路径

- **小组件清单**: `https://cdn.jsdelivr.net/gh/<用户名>/<仓库名>@<版本Tag>/dist/manifest.json`
- **图标素材**: `https://cdn.jsdelivr.net/gh/<用户名>/<仓库名>@<版本Tag>/dist/icon.svg`
- **JS 模块入口**: `https://cdn.jsdelivr.net/gh/<用户名>/<仓库名>@<版本Tag>/dist/index.js`

### 3. 用户在 Cerlesse 磁贴商店一键导入

在磁贴市场抽屉的「从 jsDelivr / GitHub 导入小组件」中，支持以下便捷格式：
- `user/repo@v1.0.0` （自动转换至 jsDelivr CDN 对应版本）
- `user/repo` （自动匹配 main 分支最新版本）
- `https://github.com/user/repo` （直接粘贴 GitHub 仓库链接）
- `npm:pkg@1.0.0` （npm 包形式发布的小组件）

Cerlesse 会自动异步获取清单、解析相对路径的图片图标，并在本地沙箱中安全注册为磁贴模块，立即可上架至桌面网格中。

---

*文档版本：v3.2.0 ｜ 维护团队：Cerlesse Agent Core Team*
