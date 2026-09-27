import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { RepositoryData } from "./types.js";

export interface RepositoryAdapterType extends WidgetAdapter<any, RepositoryData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): RepositoryData;
  validate(data: RepositoryData): boolean;
}

export const repositoryAdapter: RepositoryAdapterType = {
  canHandle(query: string) {
    return /(github|gitlab|gitee|repo|repository|开源|git clone|源码库|代码库)/i.test(query);
  },

  transform(query: string, result?: any): RepositoryData {
    const q = query || result?.query || "开源仓库";
    
    let raw = q.replace(/(github|gitlab|gitee|repo|repository|开源|代码库|源码|地址|官网)/gi, "").trim() || "awesome-project";
    raw = raw.replace(/[^a-zA-Z0-9_\-\/]/g, "").toLowerCase() || "open-source";

    const parts = raw.split("/");
    const owner = parts.length > 1 ? parts[0] : "community";
    const repoName = parts.length > 1 ? parts[1] : (parts[0] || "project");
    const fullName = `${owner}/${repoName}`;

    return {
      repoName,
      owner,
      fullName,
      description: result?.summary ? result.summary.slice(0, 150) + "..." : "现代化企业级开源架构与开发套件，具备极致性能与完备的开发者工具链生态。",
      stars: 42800,
      forks: 5620,
      watchers: 890,
      openIssues: 124,
      primaryLanguage: "TypeScript",
      languageColor: "#3178c6",
      languages: [
        { name: "TypeScript", percentage: 86.4, color: "#3178c6" },
        { name: "Rust", percentage: 9.8, color: "#dea584" },
        { name: "HTML/CSS", percentage: 3.8, color: "#e34c26" }
      ],
      license: "MIT License",
      lastCommitDate: "2 小时前",
      defaultBranch: "main",
      cloneUrl: `https://github.com/${fullName}.git`,
      sshUrl: `git@github.com:${fullName}.git`,
      repoUrl: `https://github.com/${fullName}`,
      topics: ["typescript", "react", "high-performance", "bento-ui", "open-source", "developer-tools"]
    };
  },

  validate(data: RepositoryData): boolean {
    return Boolean(data && data.fullName && data.cloneUrl);
  }
};
