export interface ReleaseLogItem {
  version: string;
  tag: string;
  date: string;
  type: "major" | "minor" | "patch" | "lts";
  title: string;
  highlights: string[];
  breakingChanges?: string[];
  author?: string;
  downloadUrl?: string;
}

export interface ReleaseHistoryData {
  projectName: string;
  latestVersion: string;
  totalReleases?: number;
  releases: ReleaseLogItem[];
  changelogUrl?: string;
}
