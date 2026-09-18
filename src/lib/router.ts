/**
 * 零依赖 History API 路由：让每个页面拥有独立的 URL 目录。
 *
 * 路径约定：
 *   /            首页（聚光搜索）
 *   /search      全景网格（结果主页面）
 *   /mindmap     思维导图
 *   /comparison  对比矩阵
 *   /sources     已验证信源
 *   /reasoning   AgentTeam 协作
 *
 * 查询词通过 ?q=<query> 携带，支持深链接分享与浏览器前进/后退。
 */
import { useEffect, useState } from "react";

export type RouteTab =
  | "bento"
  | "images"
  | "mindmap"
  | "comparison"
  | "sources"
  | "reasoning";

export const ROUTE_PATHS = {
  home: "/",
  search: "/search",
  images: "/images",
  mindmap: "/mindmap",
  comparison: "/comparison",
  sources: "/sources",
  reasoning: "/reasoning"
} as const;

/** 页面标签 -> URL 目录 */
const TAB_TO_PATH: Record<RouteTab, string> = {
  bento: ROUTE_PATHS.search,
  images: ROUTE_PATHS.images,
  mindmap: ROUTE_PATHS.mindmap,
  comparison: ROUTE_PATHS.comparison,
  sources: ROUTE_PATHS.sources,
  reasoning: ROUTE_PATHS.reasoning
};

/** URL 目录 -> 页面标签 */
const PATH_TO_TAB: Record<string, RouteTab> = {
  [ROUTE_PATHS.search]: "bento",
  [ROUTE_PATHS.images]: "images",
  [ROUTE_PATHS.mindmap]: "mindmap",
  [ROUTE_PATHS.comparison]: "comparison",
  [ROUTE_PATHS.sources]: "sources",
  [ROUTE_PATHS.reasoning]: "reasoning"
};

export interface RouteSnapshot {
  /** 归一化后的路径，例如 /mindmap */
  path: string;
  /** 当前页面标签；首页为 null */
  tab: RouteTab | null;
  /** 是否处于首页 */
  isHome: boolean;
  /** 是否为已注册路由（未知路径会被回退到首页） */
  isKnown: boolean;
  /** 地址栏携带的查询词 */
  query: string;
}

function normalizePath(pathname: string): string {
  const trimmed = (pathname || "/")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
  return (trimmed === "" ? "/" : trimmed).toLowerCase();
}

/** 读取当前地址栏对应的路由快照 */
export function readRoute(): RouteSnapshot {
  if (typeof window === "undefined") {
    return { path: ROUTE_PATHS.home, tab: null, isHome: true, isKnown: true, query: "" };
  }
  const path = normalizePath(window.location.pathname);
  const query = new URLSearchParams(window.location.search).get("q") || "";
  const tab = PATH_TO_TAB[path] ?? null;
  const isHome = path === ROUTE_PATHS.home;
  return { path, tab, isHome, isKnown: isHome || tab !== null, query };
}

/** 由页面标签与查询词拼出目标地址 */
export function buildPath(tab: RouteTab | null, query?: string): string {
  const base = tab ? TAB_TO_PATH[tab] : ROUTE_PATHS.home;
  const q = (query || "").trim();
  return q ? `${base}?q=${encodeURIComponent(q)}` : base;
}

/** 页面跳转（tab 为 null 表示首页）；不触发整页刷新，仅切换 URL */
export function navigate(
  tab: RouteTab | null,
  query?: string,
  options: { replace?: boolean } = {}
): void {
  if (typeof window === "undefined") return;
  const target = buildPath(tab, query);
  const current = `${window.location.pathname}${window.location.search}`;
  if (target === current) return;

  if (options.replace) {
    window.history.replaceState(null, "", target);
  } else {
    window.history.pushState(null, "", target);
  }
  // 复用 popstate 事件，让 useRoute 统一感知路由变化
  window.dispatchEvent(new Event("popstate"));
}

/** 订阅路由变化（含浏览器前进/后退） */
export function useRoute(): RouteSnapshot {
  const [route, setRoute] = useState<RouteSnapshot>(() => readRoute());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setRoute(readRoute());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return route;
}
