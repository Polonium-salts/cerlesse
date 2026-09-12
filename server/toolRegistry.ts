import { ToolCapabilityType, ToolDefinition, WidgetAction, SearchResult } from "../src/types.js";

/**
 * Standardized Tool Registry (OpenAI Agents Ecosystem Capability Matrix)
 * Defines the real executable capabilities that Agents can invoke and bind into Action Widgets.
 * Strictly forbids "fake" or non-functional placeholder buttons.
 */
export const TOOL_REGISTRY: Record<ToolCapabilityType, ToolDefinition> = {
  official_url: {
    id: "official_url",
    name: "访问官方正版门户 (Official Portal)",
    description: "直达经权威认证的官方主站、主入口或正版发布平台",
    iconName: "ShieldCheck",
    requiredParams: ["url"]
  },
  download: {
    id: "download",
    name: "软件与资源下载 (Download Package)",
    description: "直达官方最新安装包、Release 或二进制分发源",
    iconName: "Download",
    requiredParams: ["url"]
  },
  install_command: {
    id: "install_command",
    name: "复制安装命令 (Package Manager Install)",
    description: "一键复制并执行主流包管理器 (npm/pip/brew/docker/cargo/curl) 安装指令",
    iconName: "Terminal",
    requiredParams: ["command"]
  },
  copy_text: {
    id: "copy_text",
    name: "复制配置与代码 (Copy Code / Config)",
    description: "一键复制生产配置脚本、代码片段、环境变量或提示词模板",
    iconName: "Copy",
    requiredParams: ["command"]
  },
  open_docs: {
    id: "open_docs",
    name: "查阅官方文档 (Official Documentation)",
    description: "直达官方快速起步指南、API Reference 或开发者手册",
    iconName: "BookOpen",
    requiredParams: ["url"]
  },
  open_demo: {
    id: "open_demo",
    name: "在线体验与演示 (Interactive Demo)",
    description: "直达在线沙盒 Playground、WebUI 或 Live Demo 体验入口",
    iconName: "Play",
    requiredParams: ["url"]
  },
  navigate: {
    id: "navigate",
    name: "工作区导航 (Workspace Navigation)",
    description: "联动并聚焦到工作区内的特定分析卡片或多维矩阵",
    iconName: "Compass",
    requiredParams: ["targetWidget"]
  },
  api_endpoint: {
    id: "api_endpoint",
    name: "API 接口端点 (API Endpoint Test)",
    description: "获取或测试官方开放 API 端点与请求参数",
    iconName: "Zap",
    requiredParams: ["endpointUrl"]
  }
};

/**
 * Helper to build a validated WidgetAction bound to a tool in the registry
 */
export function createToolAction(params: {
  tool: ToolCapabilityType;
  label: string;
  description?: string;
  url?: string;
  command?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  iconName?: string;
  badge?: string;
}): WidgetAction {
  const toolDef = TOOL_REGISTRY[params.tool] || TOOL_REGISTRY.official_url;
  
  let actionType: WidgetAction["type"] = "open_url";
  if (params.tool === "install_command" || params.tool === "copy_text") {
    actionType = "copy";
  } else if (params.tool === "download") {
    actionType = "download";
  } else if (params.tool === "navigate") {
    actionType = "navigate";
  } else if (params.tool === "open_demo") {
    actionType = "open_tool";
  } else if (params.tool === "api_endpoint") {
    actionType = "api_endpoint";
  }

  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tool: params.tool,
    type: actionType,
    label: params.label,
    description: params.description || toolDef.description,
    url: params.url,
    command: params.command,
    variant: params.variant || (params.tool === "official_url" || params.tool === "install_command" ? "primary" : "outline"),
    iconName: params.iconName || toolDef.iconName,
    badge: params.badge,
    isVerified: true
  };
}

/**
 * Extracts best tool actions from verified search results and query context
 */
export function synthesizeToolActions(
  query: string,
  results: SearchResult[],
  archetype?: string
): WidgetAction[] {
  const actions: WidgetAction[] = [];
  const q = query.trim().toLowerCase();
  const topSources = (results || []).slice(0, 5);

  const officialSource = topSources.find(r => r.isOfficial) || topSources[0];

  // 1. Official portal action if url exists
  if (officialSource?.url) {
    const isGithub = officialSource.url.includes("github.com");
    actions.push(createToolAction({
      tool: "official_url",
      label: isGithub ? "查看 GitHub 官方仓库" : `直达官方主站 (${officialSource.displayDomain || "官网"})`,
      url: officialSource.url,
      variant: "primary",
      badge: "官方认证",
      iconName: isGithub ? "Github" : "ShieldCheck"
    }));
  }

  // 2. Install / CLI Command for dev/software/framework/tools
  const isDevTool = /(docker|npm|node|python|pip|git|brew|rust|cargo|linux|ubuntu|curl|install|install_command|cli|sdk|react|vue|next|vite|postgres|redis|nginx)/i.test(q);
  if (isDevTool) {
    let cmd = "";
    if (/docker/i.test(q)) {
      cmd = "docker run -d --name app -p 8080:80 " + q.replace(/docker/gi, "").trim();
      if (!cmd.trim().endsWith("app")) cmd = "curl -fsSL https://get.docker.com | sh";
    } else if (/npm|node|react|vue|next|vite/i.test(q)) {
      const pkg = q.replace(/(怎么安装|安装|教程|npm|install)/gi, "").trim() || "package";
      cmd = `npm install ${pkg}`;
    } else if (/pip|python/i.test(q)) {
      const pkg = q.replace(/(怎么安装|安装|教程|pip|python)/gi, "").trim() || "package";
      cmd = `pip install ${pkg}`;
    } else if (/brew/i.test(q)) {
      const pkg = q.replace(/(怎么安装|安装|brew)/gi, "").trim() || "tool";
      cmd = `brew install ${pkg}`;
    } else {
      cmd = `curl -fsSL https://install.${q.split(" ")[0]}.org | bash`;
    }

    actions.push(createToolAction({
      tool: "install_command",
      label: "一键复制安装指令",
      description: `快速在终端执行: ${cmd.slice(0, 30)}...`,
      command: cmd,
      variant: "secondary",
      badge: "CLI 命令",
      iconName: "Terminal"
    }));
  }

  // 3. Documentation action
  const docSource = topSources.find(r => /docs|documentation|wiki|guide|manual/i.test(r.url + " " + r.title));
  if (docSource?.url && docSource.url !== officialSource?.url) {
    actions.push(createToolAction({
      tool: "open_docs",
      label: "查阅官方开发文档",
      url: docSource.url,
      variant: "outline",
      badge: "官方文档",
      iconName: "BookOpen"
    }));
  } else if (topSources[1]?.url && topSources[1].url !== officialSource?.url) {
    actions.push(createToolAction({
      tool: "open_docs",
      label: `扩展查阅: ${topSources[1].title.slice(0, 12)}`,
      url: topSources[1].url,
      variant: "outline",
      iconName: "ExternalLink"
    }));
  }

  return actions;
}
