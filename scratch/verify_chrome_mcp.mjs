// Chrome MCP 连通性自检：启动 chrome-devtools-mcp 完成 MCP 握手，并列出它暴露给 AI 的工具
// 运行：node scratch/verify_chrome_mcp.mjs
import { spawn } from "node:child_process";

const server = spawn(
  "npx",
  ["-y", "chrome-devtools-mcp@latest", "--isolated", "--no-usage-statistics"],
  { stdio: ["pipe", "pipe", "inherit"], shell: true }
);

let buf = "";
const send = (obj) => server.stdin.write(JSON.stringify(obj) + "\n");

server.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }

    if (msg.id === 1) {
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    }

    if (msg.id === 2) {
      const tools = msg.result?.tools ?? [];
      console.log(`MCP 握手成功，chrome-devtools 暴露工具 ${tools.length} 个：`);
      console.log(tools.map((t) => t.name).join(", "));
      server.kill();
      process.exit(0);
    }
  }
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "probe", version: "1.0.0" }
  }
});

setTimeout(() => {
  console.error("超时：未收到 tools/list 响应");
  server.kill();
  process.exit(1);
}, 90000);
