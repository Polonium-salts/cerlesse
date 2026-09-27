import { WidgetAction, ToolCapabilityType } from "../../src/types.js";
import { isOfficialDomain } from "./sourceVerifyTool.js";

export interface CreateActionInput {
  capability: "official_url" | "download" | "copy_text" | "open_docs" | "open_demo" | "navigate";
  label: string;
  url?: string;
  command?: string;
  targetWidget?: string;
  description?: string;
  sourceUrl?: string;
}

export interface CreateActionOutput {
  success: boolean;
  action?: WidgetAction;
  error?: string;
}

export interface UserApprovalRecord {
  approvalId: string;
  actionType: string;
  description: string;
  approved: boolean;
  resolvedAt?: number;
  reason?: string;
}

const approvalStore = new Map<string, UserApprovalRecord>();

export function requestUserApproval(actionType: string, description: string): string {
  const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  approvalStore.set(approvalId, {
    approvalId,
    actionType,
    description,
    approved: false
  });
  return approvalId;
}

export function resolveUserApproval(approvalId: string, approved: boolean, reason?: string): UserApprovalRecord {
  const existing = approvalStore.get(approvalId);
  if (!existing) {
    const rec: UserApprovalRecord = {
      approvalId,
      actionType: "unknown",
      description: "Direct resolution",
      approved,
      resolvedAt: Date.now(),
      reason
    };
    approvalStore.set(approvalId, rec);
    return rec;
  }
  existing.approved = approved;
  existing.resolvedAt = Date.now();
  existing.reason = reason;
  return existing;
}

export interface ExecuteActionInput {
  actionType: string;
  payload?: Record<string, unknown>;
  requireApproval?: boolean;
  approvalId?: string;
  description?: string;
}

export interface ExecuteActionOutput {
  status: "success" | "pending" | "failed";
  requiresApproval?: boolean;
  approvalId?: string;
  message: string;
  result?: unknown;
}

export function executeActionTool(input: ExecuteActionInput): ExecuteActionOutput {
  const isDangerous =
    input.requireApproval ||
    /delete|remove|drop|truncate|purge|destroy|overwrite/i.test(input.actionType);

  if (isDangerous) {
    if (!input.approvalId) {
      const apprId = requestUserApproval(input.actionType, input.description || "危险操作需要用户明确确认");
      return {
        status: "pending",
        requiresApproval: true,
        approvalId: apprId,
        message: `操作 "${input.actionType}" 属于高危敏感行为，已触发审批流程，等待用户授权确认。`
      };
    }

    const appr = approvalStore.get(input.approvalId);
    if (!appr || !appr.approved) {
      return {
        status: "failed",
        requiresApproval: true,
        approvalId: input.approvalId,
        message: `操作未被批准或已拒绝授权: ${appr?.reason || "用户未同意"}`
      };
    }
  }

  return {
    status: "success",
    message: `动作 ${input.actionType} 已安全执行完成。`,
    result: { actionType: input.actionType, payload: input.payload, executedAt: Date.now() }
  };
}

/**
 * create_action: 创建经过来源核验的可执行 Action 按钮
 * 动作必须经过校验：拒绝无效或假冒链接。
 */
export function actionTool(input: CreateActionInput): CreateActionOutput {
  const cap = input.capability;

  if (cap === "official_url" || cap === "download" || cap === "open_docs" || cap === "open_demo") {
    const targetUrl = (input.url || "").trim();
    if (!targetUrl || !targetUrl.startsWith("http")) {
      return {
        success: false,
        error: `Action "${cap}" requires a valid HTTP/HTTPS URL.`
      };
    }

    let isOfficial = false;
    try {
      const hostname = new URL(targetUrl).hostname.replace(/^www\./, "");
      isOfficial = isOfficialDomain(hostname);
    } catch {
      // ignore
    }

    const actionTypeMap: Record<string, "open_url" | "download"> = {
      official_url: "open_url",
      download: "download",
      open_docs: "open_url",
      open_demo: "open_url"
    };

    const action: WidgetAction = {
      id: `act-${Math.random().toString(36).substring(2, 9)}`,
      tool: cap as ToolCapabilityType,
      type: actionTypeMap[cap] || "open_url",
      label: input.label,
      description: input.description,
      url: targetUrl,
      isVerified: isOfficial,
      variant: cap === "official_url" || cap === "download" ? "primary" : "outline",
      iconName: cap === "download" ? "Download" : cap === "official_url" ? "ShieldCheck" : "ExternalLink"
    };

    return {
      success: true,
      action
    };
  }

  if (cap === "copy_text") {
    const cmd = (input.command || "").trim();
    if (!cmd) {
      return {
        success: false,
        error: "Action 'copy_text' requires a non-empty command or text to copy."
      };
    }

    return {
      success: true,
      action: {
        id: `act-${Math.random().toString(36).substring(2, 9)}`,
        tool: "copy_text",
        type: "copy",
        label: input.label || "复制命令",
        command: cmd,
        description: input.description,
        isVerified: true,
        variant: "secondary",
        iconName: "Copy"
      }
    };
  }

  if (cap === "navigate") {
    const target = (input.targetWidget || "").trim();
    return {
      success: true,
      action: {
        id: `act-${Math.random().toString(36).substring(2, 9)}`,
        tool: "navigate",
        type: "navigate",
        label: input.label,
        description: input.description,
        params: { targetWidget: target },
        isVerified: true,
        variant: "outline",
        iconName: "Compass"
      }
    };
  }

  return {
    success: false,
    error: `Unsupported action capability: "${cap}"`
  };
}
