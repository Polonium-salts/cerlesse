# Cerlesse

基于 SearXNG 实时检索与 OpenAI Codex 单智能体驱动的智能搜索引擎，支持多路实时搜索、结构化信源交叉核验、动态小组件选型与无重叠几何装箱（TileLayoutEngine）自适应排版。

---

## 核心特性

- **单智能体架构 (Codex Agent)**：严格遵循 `AGENTS.md` 规范，采用单 Agent 决策闭环（User Query -> Tool Call -> Tool Result -> Observation -> Re-decision -> Finish），杜绝多重 LLM 循环与黑盒规划。
- **全模型供应商支持**：
  - **DeepSeek 官方 API**（首选推荐）：支持 `deepseek-v4-flash`、`deepseek-v4-pro`，原生兼容 OpenAI Chat Completions 协议与 1M 超大上下文。
  - **OpenAI 官方与兼容网关**：支持 `gpt-4o-mini`、Groq、vLLM 等标准 OpenAI-compatible 端点。
  - **OpenRouter 兼容层**：自动识别 `OPENROUTER_API_KEY` 与免费模型池调度。
- **信源溯源与证据链核验**：
  - 集成 `verify_source` 工具实时核验权威性与证书；
  - 常驻 `ai_answer`（AI 精准速答）、`related_links`（权威入口与信源跳转）与 `image_gallery`（视觉图集），保证核心交付物永不失落；
  - 检索证据不足时如实标注「证据边界」，杜绝无源编造。
- **模块化小组件体系**：
  - 基于 JSON Manifest 清单与 SDK 规范驱动的 20+ 个专业小组件（对比矩阵、思维导图、天气、代码预览等）。
  - 严格通过 Orama 索引与注册表校验，由模型依据证据链按需选择。
- **无重叠自适应装箱排版**：
  - 严谨的 12 列磁贴求解器 (`TileLayoutEngine`)，支持 25%/50%/75%/100% 规范宽度，自动消解重叠与空洞。

---

## 环境配置

在项目根目录下创建 `.env` 文件（或从 `.env.example` 复制）：

```dotenv
# ==========================================
# 方式 1：DeepSeek 官方 API（推荐）
# ==========================================
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# AI_MODEL=deepseek-v4-flash

# ==========================================
# 方式 2：OpenAI 或第三方兼容网关
# ==========================================
# AI_API_BASE_URL=https://api.openai.com/v1
# AI_API_KEY=your_server_side_api_key
# AI_MODEL=gpt-4o-mini

# ==========================================
# 搜索服务（可选，默认使用内置 SearXNG 集群）
# ==========================================
# SEARXNG_URL=https://your-searxng-instance.example.com
```

> **安全须知**：API 密钥仅保存在服务端环境变量中，绝不暴露到浏览器或打入前端静态包中。

---

## 启动与调试

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 3000）
npm run dev

# 执行代码校验
npm run lint

# 运行自动化测试套件
npm test

# 生产构建
npm run build
```

---

## 服务端 API 概览

- `GET /api/config`：单一出口（SSOT）返回模型提供商状态（`provider`、`ready`、`models`、`defaultModel`、`hasDeepSeekKey` 等）。
- `GET /api/agent/health`：上游模型提供商最小开销健康度探测探针。
- `GET /api/agent/stream`：Agent 实时检索与排版决策 SSE 事件流。
- `POST /api/agent`：Agent 一次性检索合成接口。
- `GET /api/search` & `GET /api/images`：SearXNG 独立网页与图片检索接口。
- `GET /api/widgets/health`：小组件注册表一致性与生命周期健康度检查。


