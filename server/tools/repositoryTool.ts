export interface RepositoryInspectInput {
  repoPathOrUrl: string;
}

export interface RepositoryInspectOutput {
  success: boolean;
  name: string;
  stars?: number;
  forks?: number;
  description?: string;
  defaultBranch?: string;
  license?: string;
  latestRelease?: string;
  error?: string;
}

/**
 * inspect_repository: 查看开源代码仓库与包元数据
 */
export async function repositoryTool(input: RepositoryInspectInput): Promise<RepositoryInspectOutput> {
  const target = (input.repoPathOrUrl || "").trim();
  let owner = "";
  let repo = "";

  const githubMatch = target.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (githubMatch) {
    owner = githubMatch[1];
    repo = githubMatch[2].replace(/\.git$/, "");
  } else {
    const slashParts = target.split("/");
    if (slashParts.length === 2) {
      owner = slashParts[0];
      repo = slashParts[1];
    }
  }

  if (!owner || !repo) {
    return {
      success: false,
      name: target,
      error: "Invalid repository format. Please provide 'owner/repo' or a GitHub URL."
    };
  }

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Cerlesse-Agent/2.0",
        "Accept": "application/vnd.github.v3+json"
      },
      signal: AbortSignal.timeout(3000)
    });

    if (!res.ok) {
      return {
        success: false,
        name: `${owner}/${repo}`,
        error: `GitHub API returned ${res.status}: ${res.statusText}`
      };
    }

    const data = await res.json();
    return {
      success: true,
      name: data.full_name || `${owner}/${repo}`,
      stars: data.stargazers_count,
      forks: data.forks_count,
      description: data.description,
      defaultBranch: data.default_branch,
      license: data.license?.spdx_id || data.license?.name
    };
  } catch (err: any) {
    return {
      success: false,
      name: `${owner}/${repo}`,
      error: err.message || "Failed to inspect repository"
    };
  }
}
