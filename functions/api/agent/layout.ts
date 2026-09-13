// EdgeOne Pages Function 别名路由：/api/agent/layout -> 小组件排版 Agent
// 与 /api/layout/plan 共用同一实现，便于不同调用方按语义选择入口。
export { onRequest } from "../layout/plan.js";
