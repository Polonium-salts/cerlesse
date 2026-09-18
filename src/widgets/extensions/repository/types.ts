export interface RepositoryData {
  repoName: string;
  owner: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  watchers?: number;
  openIssues: number;
  primaryLanguage: string;
  languageColor?: string;
  languages?: Array<{ name: string; percentage: number; color: string }>;
  license: string;
  lastCommitDate: string;
  defaultBranch: string;
  cloneUrl: string;
  sshUrl: string;
  repoUrl: string;
  topics: string[];
  readmeSummary?: string;
}
