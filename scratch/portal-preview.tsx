import React from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import { OfficialPortalWidget } from "../src/widgets/components/OfficialPortalWidget.js";
import type { SearchResult } from "../src/types.js";

/** 临时预览：覆盖两个分支 × 三种宽度档 × 明暗两色 */

const official: SearchResult = {
  id: "1",
  title: "Apple (中国大陆) - 官方网站",
  url: "https://www.apple.com.cn/",
  snippet: "探索 Apple 的创新世界，选购各式 Mac、iPad、iPhone、Apple Watch 等产品，并获取相关支持服务。",
  displayDomain: "www.apple.com.cn",
  isOfficial: true
};

const longOfficial: SearchResult = {
  id: "2",
  title: "小米商城 - 小米手机、电视、笔记本等智能硬件官方直营网站，正品保障与全国联保服务",
  url: "https://www.mi.com/",
  snippet:
    "小米商城是小米公司官方直营的线上购物平台，提供小米手机、Redmi 手机、小米电视、小米笔记本、智能家居等全品类产品的正品购买渠道，支持七天无理由退货与全国联保。",
  displayDomain: "www.mi.com",
  isOfficial: true
};

/* 无 displayDomain，走 URL 解析路径，域名更长 */
const parsedOfficial: SearchResult = {
  id: "3",
  title: "DeepSeek | 深度求索",
  url: "https://www.deepseek.com/zh-Hans/",
  snippet: "深度求索致力于探索人工智能的前沿技术。",
  isOfficial: true
};

const WIDTHS = [
  { label: "wide · 8 列", w: 847 },
  { label: "large · 6 列", w: 631 },
  { label: "medium · 4 列（compact）", w: 415 }
];

const Columns: React.FC = () => (
  <div className="flex flex-wrap items-start gap-8 px-8 py-6">
    {WIDTHS.map(({ label, w }) => (
      <div key={label} className="flex flex-col gap-4" style={{ width: w }}>
        <span className="text-muted-foreground font-mono text-xs">{label}</span>
        <OfficialPortalWidget
          query="Apple 官网"
          officialWebsite={official}
          rawResultCount={128}
          filteredCount={42}
          isCompact={w <= 415}
        />
        <OfficialPortalWidget
          query="小米 15 Ultra 评测"
          officialWebsite={longOfficial}
          rawResultCount={216}
          filteredCount={37}
          isCompact={w <= 415}
        />
        <OfficialPortalWidget
          query="DeepSeek 官网"
          officialWebsite={parsedOfficial}
          rawResultCount={93}
          filteredCount={21}
          isCompact={w <= 415}
        />
        <OfficialPortalWidget
          query="小米 15 Ultra 深度评测与竞品横向对比"
          rawResultCount={216}
          filteredCount={37}
          isCompact={w <= 415}
        />
      </div>
    ))}
  </div>
);

createRoot(document.getElementById("root")!).render(
  <div className="flex flex-col">
    <div className="text-foreground bg-background py-3 text-center font-mono text-xs">LIGHT</div>
    <div className="bg-background">
      <Columns />
    </div>
    <div className="dark">
      <div className="text-foreground bg-background py-3 text-center font-mono text-xs">DARK</div>
      <div className="bg-background pb-1">
        <Columns />
      </div>
    </div>
  </div>
);
