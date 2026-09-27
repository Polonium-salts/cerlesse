/**
 * jsDelivr CDN 与远程小组件导入解析器 (Remote Widget CDN Resolver)
 * 
 * 核心设计：
 * 1. 支持标准 GitHub 路径: github.com/user/repo, user/repo, user/repo@tag
 * 2. 自动转换为 jsDelivr CDN: https://cdn.jsdelivr.net/gh/user/repo@tag/dist/manifest.json
 * 3. 支持直接输入 npm 包: vue@3, @cerlesse/widget-stock@1.0.0
 * 4. 支持任意绝对 https:// 链接（如自建 CDN 或 jsDelivr 完整 URL）
 * 5. 自动补全相对路径资源（如 icon: "./icon.svg" 或 "icon.png" 自动转为 CDN 绝对地址）
 * 6. 支持将解析出的清单动态封装注册为标准的 WidgetModule
 */

import { WidgetModule, WidgetCategoryType, WidgetSchema, TileSchemaDescriptor } from "./types.js";
import { resolveManifestIcon, FALLBACK_MANIFEST_ICON } from "../manifests/icons.js";
import { TileWidth } from "../../lib/tileLayoutEngine.js";

export interface RemoteWidgetManifest {
  $schema?: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  category?: WidgetCategoryType;
  tags?: string[];
  icon?: string; // Lucide 图标名或图片/SVG URL
  grid: {
    width: TileWidth;
    supportedWidths: TileWidth[];
    ratio?: string;
    minWidth?: TileWidth;
  };
  theme?: {
    accentColor?: string;
    gradient?: string;
    accentBg?: string;
    liveBadge?: string | number;
    flipAnimation?: "3d-flip" | "slide" | "fade";
  };
  agentHint?: {
    functionality: string;
    bestFor: string[];
    dataRequirements?: string[];
    selectionHeuristics: string;
    triggerKeywords?: string[];
    antiPatterns?: string[];
  };
  // 声明式组件树 (可选)
  schema?: WidgetSchema;
  // 静态或动态磁贴模板 (可选)
  tileTemplate?: TileSchemaDescriptor;
  // 远程 JS 入口 (可选，如果是 ESM 或沙箱 JS)
  entry?: string;
}

export interface ParsedCdnUrlResult {
  manifestUrl: string;
  baseUrl: string;
  sourceType: "github" | "npm" | "direct";
  repoOrPkg: string;
  versionOrTag: string;
}

/**
 * 解析用户输入的各类 URL / 标识符为标准 jsDelivr CDN 清单地址与基准 URL
 * 
 * 支持的格式：
 * 1. user/repo (默认 main 分支: https://cdn.jsdelivr.net/gh/user/repo@main/dist/manifest.json)
 * 2. user/repo@v1.0.0
 * 3. https://github.com/user/repo (或带有 /blob/main/... 路径)
 * 4. npm:package@version 或 pkg@1.0.0
 * 5. 完整的 https://cdn.jsdelivr.net/.../manifest.json
 */
export function parseWidgetCdnInput(input: string): ParsedCdnUrlResult {
  const raw = input.trim();
  if (!raw) {
    throw new Error("请输入小组件的 GitHub 仓库、npm 包名或 jsDelivr 链接");
  }

  // 1. 如果已经是完整的 https:// 或 http:// 链接
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const url = new URL(raw);

    // 如果用户粘贴的是 github 网页链接 (例如 https://github.com/Polonium-salts/my-widget)
    if (url.hostname === "github.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const user = parts[0];
        const repo = parts[1];
        let tag = "main";
        let subpath = "dist/manifest.json";

        // 处理形如 /blob/v1.0.0/dist/manifest.json 或 /tree/v1.0.0
        if (parts.length >= 4 && (parts[2] === "blob" || parts[2] === "tree")) {
          tag = parts[3];
          if (parts.length > 4) {
            subpath = parts.slice(4).join("/");
          }
        }

        const baseUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${tag}/`;
        const manifestUrl = subpath.endsWith(".json") 
          ? `https://cdn.jsdelivr.net/gh/${user}/${repo}@${tag}/${subpath}`
          : `${baseUrl}dist/manifest.json`;

        return {
          manifestUrl,
          baseUrl,
          sourceType: "github",
          repoOrPkg: `${user}/${repo}`,
          versionOrTag: tag
        };
      }
    }

    // 如果是直接的 jsDelivr CDN 链接或其他直接链接
    const manifestUrl = raw.endsWith(".json") ? raw : `${raw.replace(/\/+$/, "")}/dist/manifest.json`;
    const lastSlash = manifestUrl.lastIndexOf("/");
    const baseUrl = lastSlash !== -1 ? manifestUrl.substring(0, lastSlash + 1) : manifestUrl;

    return {
      manifestUrl,
      baseUrl,
      sourceType: "direct",
      repoOrPkg: url.pathname,
      versionOrTag: "latest"
    };
  }

  // 2. npm 包格式 (如 npm:@scope/pkg@1.0.0 或 pkg@1.0.0)
  if (raw.startsWith("npm:")) {
    const pkgSpec = raw.slice(4).trim();
    return resolveNpmCdn(pkgSpec);
  }

  // 3. GitHub 简写格式 (如 Polonium-salts/my-widget 或 Polonium-salts/my-widget@v1.0.0)
  const ghMatch = raw.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:@([a-zA-Z0-9_.-]+))?(?:\/(.+))?$/);
  if (ghMatch) {
    const user = ghMatch[1];
    const repo = ghMatch[2];
    const tag = ghMatch[3] || "main";
    const subpath = ghMatch[4] || "dist/manifest.json";

    const baseUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${tag}/`;
    const manifestUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${tag}/${subpath}`;

    return {
      manifestUrl,
      baseUrl,
      sourceType: "github",
      repoOrPkg: `${user}/${repo}`,
      versionOrTag: tag
    };
  }

  // 4. 普通 npm 包名简写
  return resolveNpmCdn(raw);
}

function resolveNpmCdn(pkgSpec: string): ParsedCdnUrlResult {
  // 解析包名与版本 (例如 @scope/pkg@1.0.0 或 pkg@1.0.0)
  let pkgName = pkgSpec;
  let version = "latest";

  const lastAt = pkgSpec.lastIndexOf("@");
  if (lastAt > 0) {
    pkgName = pkgSpec.slice(0, lastAt);
    version = pkgSpec.slice(lastAt + 1) || "latest";
  }

  const baseUrl = `https://cdn.jsdelivr.net/npm/${pkgName}@${version}/`;
  const manifestUrl = `${baseUrl}dist/manifest.json`;

  return {
    manifestUrl,
    baseUrl,
    sourceType: "npm",
    repoOrPkg: pkgName,
    versionOrTag: version
  };
}

/**
 * 将相对路径解析为基于 CDN 的绝对路径
 */
export function resolveCdnAssetUrl(assetPath: string, baseUrl: string): string {
  if (!assetPath) return "";
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://") || assetPath.startsWith("data:")) {
    return assetPath;
  }
  const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const cleanAsset = assetPath.startsWith("./") ? assetPath.slice(2) : assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  return `${cleanBase}${cleanAsset}`;
}

/**
 * 远程拉取小组件清单并校验
 */
export async function fetchRemoteWidgetManifest(inputUrl: string): Promise<{
  manifest: RemoteWidgetManifest;
  parsedCdn: ParsedCdnUrlResult;
}> {
  const parsedCdn = parseWidgetCdnInput(inputUrl);

  const res = await fetch(parsedCdn.manifestUrl, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`加载小组件清单失败 (HTTP ${res.status}): ${parsedCdn.manifestUrl}`);
  }

  const manifest = await res.json() as RemoteWidgetManifest;

  // 基础规格校验
  if (!manifest.id || !manifest.name) {
    throw new Error("清单缺少必需字段 'id' 或 'name'");
  }

  if (!manifest.grid || typeof manifest.grid.width !== "number") {
    // 兼容默认网格规格
    manifest.grid = {
      width: (manifest.grid?.width as TileWidth) || 50,
      supportedWidths: manifest.grid?.supportedWidths || [25, 50, 75, 100],
      ratio: manifest.grid?.ratio || "4:3"
    };
  }

  // 补全版本号
  if (!manifest.version) {
    manifest.version = parsedCdn.versionOrTag !== "latest" ? parsedCdn.versionOrTag : "1.0.0";
  }

  return { manifest, parsedCdn };
}
