import type { WidgetManifest } from "../../sdk/manifest.js";

export const manifest: WidgetManifest = {
  id: "company_info",
  name: "公司信息",
  version: "1.0.0",
  apiVersion: 1,
  description: "智能呈现企业与公司全景信息卡片，包含企业全称、总部园区实况照片、业务概览详述及维基百科权威溯源直达",
  category: "synthesis",
  tags: [
    "公司",
    "企业",
    "科技公司",
    "跨国公司",
    "维基百科",
    "谷歌",
    "商业实体",
    "企业概况"
  ],
  capabilities: [
    "company_info",
    "entity_profile",
    "overview_synthesis",
    "concept_definition",
    "official_site",
    "authoritative_entry"
  ],
  intents: [
    "company_info",
    "entity_profile",
    "concept_explanation",
    "general_knowledge",
    "explain"
  ],
  keywords: [
    "公司",
    "企业",
    "集团",
    "科技公司",
    "跨国公司",
    "总部",
    "创始人",
    "ceo",
    "市值",
    "上市",
    "有限责任公司",
    "股份有限公司",
    "谷歌",
    "google",
    "微软",
    "microsoft",
    "苹果",
    "apple",
    "腾讯",
    "tencent",
    "阿里",
    "alibaba",
    "百度",
    "baidu",
    "字节跳动",
    "bytedance",
    "英伟达",
    "nvidia",
    "meta",
    "facebook",
    "特斯拉",
    "tesla",
    "亚马逊",
    "amazon",
    "openai",
    "华为",
    "huawei",
    "小米",
    "xiaomi",
    "比亚迪",
    "byd",
    "三星",
    "samsung",
    "company",
    "corporation",
    "inc",
    "llc"
  ],
  examples: [
    "谷歌 公司简介与总部概况",
    "Google 跨国科技公司信息",
    "微软 公司概况与维基百科",
    "苹果 公司业务与总部",
    "OpenAI 公司架构与发展历程"
  ],
  layout: {
    defaultWidth: 25,
    minWidth: 25,
    maxWidth: 50,
    preferredHeight: 380,
    height: "auto"
  },
  agent: {
    selectable: true,
    minConfidence: 0.65,
    priority: 89,
    flexible: true
  },
  permissions: {
    network: true,
    clipboard: true
  }
};
