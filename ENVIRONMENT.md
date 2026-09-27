# Server AI API configuration

The Agent and translation service use the OpenAI-compatible Chat Completions API through `@aktagon/llmkit-ts`. Configure the API endpoint, model ID, and API key on the server only. The key is never stored in browser settings, sent in API requests, or returned by `/api/config`.

## Supported variables

| Variable | Required | Description |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | Recommended | DeepSeek Official API key (from `platform.deepseek.com/api_keys`). Automatically activates DeepSeek (`https://api.deepseek.com/v1`, models `deepseek-v4-flash` / `deepseek-v4-pro`). |
| `AI_API_KEY` | Yes if no DeepSeek key | Generic OpenAI-compatible provider API key (server-side secret). |
| `AI_API_BASE_URL` | No | OpenAI-compatible API base URL. Defaults to `https://api.deepseek.com` if `DEEPSEEK_API_KEY` is present, or `https://api.openai.com` (the provider appends `/v1/chat/completions`); a trailing `/v1` or `/chat/completions` is accepted and normalized away. |
| `AI_MODEL` | No | Model ID. Defaults to `deepseek-v4-flash` for DeepSeek, or `gpt-4o-mini`. The selected model must support Chat Completions and tool/function calling for the Agent. |
| `AI_API_DISABLED` | No | Set to `true` to reject all AI calls with HTTP 503, even when a key is configured. |
| `OPENROUTER_API_KEY` / `OPENROUTER_KEY` | Legacy | Accepted as key aliases for migration. Without `AI_API_BASE_URL` or `AI_API_KEY`, retains the legacy OpenRouter base/model defaults. Prefer `DEEPSEEK_API_KEY` or `AI_API_*` for new setups. |
| `OPENROUTER_DISABLED` | Legacy | `true` continues to disable AI calls. Prefer `AI_API_DISABLED`. |
| `SEARXNG_URL` / `SEARXNG_URLS` | No | Optional custom SearXNG instance or comma-separated instance cluster. |

## Local development

1. Copy `.env.example` to `.env`.
2. Configure your provider, for example with DeepSeek official API:

   ```dotenv
   DEEPSEEK_API_KEY=sk-your_deepseek_api_key
   # AI_MODEL=deepseek-v4-flash
   ```

   Or with another OpenAI-compatible gateway:

   ```dotenv
   AI_API_BASE_URL=https://api.openai.com
   AI_API_KEY=your_server_side_api_key
   AI_MODEL=gpt-4o-mini
   # AI_API_DISABLED=false
   ```

   For a compatible gateway, point `AI_API_BASE_URL` at its API base and set `AI_MODEL` to a model supported by that gateway. Ensure the selected model supports tool calling, since the Agent relies on it.
3. Start or restart the server after changing `.env` so the environment is reloaded.

`.env.local` (if present) takes precedence over `.env`. Both are ignored by Git. Do not put secrets in `VITE_*` variables: Vite client variables are bundled for browser access.

## API endpoints and health checks

- `GET /api/config`: 返回单一数据源的模型提供商就绪状态 (`ModelProviderStatus`：含 `provider`、`ready`、`reason`、`models`、`defaultModel` 以及多语言与 SearXNG 配置)，绝不泄露 API Key。
- `GET /api/agent/health`: 发起最小开销真实探针检测模型上游联通性与鉴权，就绪返回 `HTTP 200`，上游异常返回 `HTTP 502`，未配置返回 `HTTP 503`。
- `GET /api/widgets/health`: 小组件注册表健康度检查。
- `POST /api/agent`, `POST /api/agent/run`, `/api/agent/stream`: 运行 OpenAI Codex 智能体检索与排版流。
- `POST /api/translate`: 机器翻译服务。
- `GET /api/search` / `GET /api/images`: 独立 SearXNG 网页与图片搜索。

## Deployment

Set `AI_API_KEY` as a server-side secret and `AI_API_BASE_URL` / `AI_MODEL` as server-side environment values on the hosting platform. For EdgeOne/Cloud Functions, configure them as function environment bindings. Never commit real keys or send them from the browser.
