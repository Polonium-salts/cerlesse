import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { VerificationChecklistData, ChecklistItem } from "./types.js";

export function deriveChecklistItems(query: string, result?: any): ChecklistItem[] {
  const q = (query || result?.query || "").toLowerCase();
  if (q.includes("error") || q.includes("fail") || q.includes("bug") || q.includes("报错") || q.includes("解决")) {
    return [
      { id: "1", title: "核实运行环境与运行时版本", detail: "确保 Node/Python/Docker 版本满足官方基线要求" },
      { id: "2", title: "清理本地缓存与锁文件", detail: "删除 package-lock.json / node_modules 后重新构建" },
      { id: "3", title: "排查网络代理与镜像源配置", detail: "测试 registry.npmjs.org / pypi.org 连通性与证书有效性" },
      { id: "4", title: "确认系统权限与端口占用", detail: "检查端口是否被占用 (lsof -i :port) 及权限策略" }
    ];
  }
  return [
    { id: "1", title: "核查官方前置依赖条件", detail: "确认目标软件所需的系统级依赖与环境支持" },
    { id: "2", title: "验证安装包完整性与哈希", detail: "校验下载包的 SHA256 签名以确保无篡改" },
    { id: "3", title: "执行最小可行验证指令", detail: "运行 --version 或简单用例测试是否可正常工作" },
    { id: "4", title: "配置系统全局环境变量", detail: "将可执行路径添加至 PATH 并验证终端生效" }
  ];
}

export interface VerificationChecklistAdapterType extends WidgetAdapter<any, VerificationChecklistData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): VerificationChecklistData;
  validate(data: VerificationChecklistData): boolean;
}

export const verificationChecklistAdapter: VerificationChecklistAdapterType = {
  canHandle(query: string, result?: any) {
    if (result?.verificationChecklist) return true;
    return /(清单|checklist|核验|自检|检查表|排查清单|避坑)/i.test(query || "");
  },

  transform(query: string, result?: any): VerificationChecklistData {
    if (result?.verificationChecklist) {
      return result.verificationChecklist;
    }
    return {
      title: "故障排查与核验清单",
      description: "交互式步骤自检与避坑保障",
      items: deriveChecklistItems(query, result)
    };
  },

  validate(data: VerificationChecklistData): boolean {
    return Boolean(data && Array.isArray(data.items) && data.items.length > 0);
  }
};
