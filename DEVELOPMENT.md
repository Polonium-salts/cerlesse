# Cerlesse 开发文档（开发手册）

> 基于仓库现有 `README.md`、`AGENTS.md`、`ENVIRONMENT.md`、`WIDGET_DEVELOPMENT_SPEC.md`、`.codex/skills/*` 及源码架构综合整理。  
> 文档版本：对应仓库最新状态 (2026-09-27)。

---

## 一、项目概述

**Cerlesse** 是一个基于 **SearXNG 实时检索 + 单智能体（Codex Agent）** 驱动的智能搜索引擎。

核心能力：
- 多路实时搜索与结构化信源交叉核验
- 证据驱动的动态小组件选型
- 无重叠 12 列磁贴几何装箱（TileLayoutEngine）自适应排版

技术栈：
| 层 | 技术 |
|----|------|
| 前端 | React 19 + Vite 6 + Tailwind CSS 4 + Motion + Muuri + Radix UI |
| 后端 | Express + tsx + `@aktagon/llmkit-ts` |
| 搜索 | SearXNG（可配置集群） |
| AI | OpenAI-compatible Chat Completions + Tool Calling |
| 校验 | Zod + Orama（小组件索引） |

---

## 二、架构铁律（AGENTS.md）

必须严格遵守，不可违反：

1. **只用一个 Agent**：OpenAI Codex，禁止引入第二个 Agent 循环或 LLM 规划器/路由器。
2. **小组件是能力，不是 Agent**：必须来自注册表。
3. **模型禁止输出 JSX 或任意 JavaScript**。
4. **搜索结果必须可追溯到 source ID**。
5. **没有真实 tool result 不得声称工具已执行**。
6. **证据不足时必须再次搜索或明确声明证据不足**。
7. **布局不是业务决策层**：模型只声明语义意图（角色、宽度档位、关系），几何由 `solve_layout` / TileLayoutEngine 求解。
8. **危险操作需显式授权**。

决策闭环：

```
User Query → Tool Call → Tool Result → Observation → Re-decision → Tool Call / Finish
```

---

## 三、环境配置与启动

### 3.1 环境变量（仅服务端）

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 推荐 | DeepSeek 官方 Key，自动启用官方端点 |
| `UNOROUTER_API_KEY` | 可选 | UnoRouter 聚合网关 |
| `AI_API_KEY` | 无 DeepSeek 时必填 | 通用 OpenAI-compatible Key |
| `AI_API_BASE_URL` | 可选 | 自定义 Base URL |
| `AI_MODEL` | 可选 | 模型 ID（必须支持 tool calling） |
| `AI_API_DISABLED` | 可选 | `true` 时拒绝所有 AI 调用 |
| `SEARXNG_URL` / `SEARXNG_URLS` | 可选 | 自定义 SearXNG 实例 |

密钥**绝不**使用 `VITE_*` 前缀，绝不下发到浏览器。

### 3.2 推荐配置示例

```dotenv
# 推荐：DeepSeek
DEEPSEEK_API_KEY=sk-xxxxxxxx
# AI_MODEL=deepseek-v4-flash

# 或：UnoRouter
# UNOROUTER_API_KEY=sk-xxxxxxxx

# 或：通用网关
# AI_API_BASE_URL=https://api.openai.com/v1
# AI_API_KEY=sk-xxxxxxxx
# AI_MODEL=gpt-4o-mini
```

### 3.3 常用命令

```bash
npm install
npm run dev          # 开发服务器（端口 3000）
npm run lint         # TypeScript 检查
npm test             # 自动化测试
npm run build        # 生产构建
npm run widgets:scan
npm run widgets:validate
npm run ci           # 完整 CI 流水线
```

---

## 四、服务端 API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 模型提供商状态（SSOT，不泄露 Key） |
| GET | `/api/agent/health` | 上游模型健康探针 |
| GET | `/api/agent/stream` | Agent SSE 实时流 |
| POST | `/api/agent` | Agent 一次性合成 |
| ALL | `/api/models/detect` | 根据 Key/BaseURL 动态探测模型 |
| GET | `/api/search` | 独立网页搜索 |
| GET | `/api/images` | 独立图片搜索 |
| GET | `/api/widgets/health` | 小组件注册表健康检查 |
| POST | `/api/translate` | 机器翻译 |

---

## 五、Agent 工具与工作流

### 5.1 可用工具

| 工具 | 用途 |
|------|------|
| `search_web` | 网页检索（聚焦关键词） |
| `search_images` | 图片检索（仅图片意图时调用） |
| `verify_source` | 信源权威性与证书核验 |
| `get_widget_catalog` | 查看已注册小组件 |
| `prepare_widget` | 绑定小组件与证据 |
| `solve_layout` | 12 列无重叠几何求解 |
| `browser_read` | 深度阅读指定 URL |
| `inspect_repository` | 开源仓库元数据 |
| `create_action` | 创建可执行动作按钮 |

### 5.2 标准工作流顺序

1. `search_web`（聚焦查询）
2. `get_widget_catalog`
3. `prepare_widget`（必须包含 `ai_answer` + `related_links`，其余按证据）
4. `solve_layout`
5. 输出最终结构化回答并引用真实 source ID

### 5.3 图片组件启用条件（重点）

`image_gallery` **不是常驻组件**，必须满足以下任一条件才会被选型：

- Agent 已调用 `search_images` 并拿到真实图片
- 信源结果带有 `thumbnail`
- 查询命中图片意图正则：`/(图片|照片|图集|图库|壁纸|长什么样|外观|photo|image|picture|gallery|wallpaper)/i`

---

## 六、小组件开发规范（摘要）

完整规范见仓库 `WIDGET_DEVELOPMENT_SPEC.md`（v3.2.0）。

### 6.1 架构总览

```
SearchAgent（意图 + 证据选型）
        ↓
TileLayoutEngine（12 列无重叠装箱）
        ↓
┌──────────────────┬──────────────────┐
│ 声明式 Schema    │ 原生 React Module │
│ （零 XSS）        │ （丰富交互）       │
└──────────────────┴──────────────────┘
        ↓
沙箱运行时 + Live Tile 桌面
```

### 6.2 宽度契约（硬约束）

| 档位 | 栅格跨度 | 占比 | 典型场景 |
|------|----------|------|----------|
| 25 | 3 格 | 1/4 | 要点、官网卡片 |
| 50 | 6 格 | 1/2 | AI 回答、对比表 |
| 75 | 9 格 | 3/4 | 思维导图、图集 |
| 100 | 12 格 | 全宽 | 大表格、全景 |

高度以 `宽度 ÷ ratio` 为下限，内容可继续增高，绝不裁切。

### 6.3 新增小组件标准流程

1. **写 Manifest**  
   `src/widgets/manifests/xxx.json`（含 `id`、`tags`、`agentHint`、`grid`）

2. **写 Extension Manifest**（推荐）  
   `src/widgets/extensions/xxx/manifest.ts`（含 `intents`、`keywords`、`capabilities`）

3. **写渲染模块**  
   - 原生：`src/widgets/modules/XxxWidget.tsx` 或 `extensions/xxx/widget.tsx`
   - 或声明式 Schema

4. **注册**  
   确保进入 `WidgetRegistry` / `extensionRegistry`

5. **校验**  
   ```bash
   npm run widgets:scan
   npm run widgets:validate
   ```

### 6.4 关键接口

- `WidgetModule`：id、render、renderBack、data、actions
- `WidgetContext`：data、size、state、storage、openUrl、copyText、flipTile
- `agentHint`：functionality、bestFor、dataRequirements、selectionHeuristics、triggerKeywords、antiPatterns

### 6.5 常驻 vs 条件组件

| 类型 | 组件 | 说明 |
|------|------|------|
| 常驻 | `ai_answer`、`related_links` | 几乎每次都会绑定 |
| 条件 | `image_gallery`、`weather`、`comparison`、`mindmap` 等 | 必须有意图或真实证据 |

---

## 七、选型与适用性双门禁

1. **服务端选型技能包**（`server/codex/widgetSelectionSkill.ts`）  
   - 确定性评分 + 证据门禁  
   - 垂直组件只认明确意图  
   - `image_gallery` 必须有图片证据或图片意图

2. **前端适用性网关**（`src/widgets/applicability.ts`）  
   - 最终确认是否真正上桌  
   - 无数据 / 无意图的组件直接过滤，不占布局空间

---

## 八、目录结构速查

```
cerlesse/
├── AGENTS.md                    # Agent 铁律
├── ENVIRONMENT.md               # 环境变量说明
├── WIDGET_DEVELOPMENT_SPEC.md   # 小组件完整开发规范
├── DEVELOPMENT.md               # 综合开发手册
├── .env.example
├── server.ts                    # 入口
├── server/
│   ├── aiProvider.ts            # 多模型供应商抽象
│   ├── gateway.ts               # UnoRouter / OpenRouter 网关
│   ├── codex/                   # Agent 核心与 system prompt
│   ├── tools/                   # search_web / search_images 等
│   └── searxng.ts
├── src/
│   ├── App.tsx
│   ├── widgets/
│   │   ├── manifests/           # JSON 清单
│   │   ├── extensions/          # 扩展组件（含 image_gallery 等）
│   │   ├── components/          # 渲染组件
│   │   ├── applicability.ts     # 适用性网关
│   │   └── registry*
│   └── layout/                  # TileLayoutEngine 相关
├── scripts/widgets/             # scan / validate / generate
└── tests/
```

---

## 九、安全与最佳实践

- API Key 仅存服务端环境变量
- 模型禁止输出任意 JS/JSX
- 所有信源必须可追溯 source ID
- 外部链接通过 `openUrl` 沙箱打开
- Prompt 注入有基础清洗与安全模式
- 危险操作需显式授权

---

## 十、参考文件索引

| 文档 / 文件 | 用途 |
|-------------|------|
| `README.md` | 项目简介与快速启动 |
| `AGENTS.md` | Agent 架构铁律 |
| `ENVIRONMENT.md` | 环境变量与部署 |
| `WIDGET_DEVELOPMENT_SPEC.md` | 小组件完整开发规范（v3.2.0） |
| `DEVELOPMENT.md` | 综合开发手册 |
| `.codex/skills/*` | Agent 技能包 |
| `server/codex/codexConfig.ts` | System Prompt 与工作流 |
| `server/codex/widgetSelectionSkill.ts` | 证据驱动选型逻辑 |
| `src/widgets/applicability.ts` | 前端适用性网关 |
