export interface DownloadReleaseOption {
  id: string;
  platform: "macos" | "windows" | "linux" | "docker" | "generic";
  platformLabel: string;
  arch: string; // e.g., "Apple Silicon (M1/M2/M3)", "x64 (Intel/AMD)", "ARM64"
  version: string;
  fileType: string; // e.g., ".dmg", ".exe / .msi", ".tar.gz / .deb", "docker pull"
  size?: string;
  downloadUrl?: string;
  command?: string;
  sha256?: string;
  isRecommended?: boolean;
}

export interface DownloadWidgetData {
  softwareName: string;
  latestVersion: string;
  releaseDate?: string;
  officialSiteUrl?: string;
  systemRequirements?: string;
  options: DownloadReleaseOption[];
  quickCopyCommand?: string;
  signatureVerified?: boolean;
}
