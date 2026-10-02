import type { WidgetAdapter } from "../../sdk/adapter.js";
import type { CompanyInfoData, CompanyFact } from "./types.js";

export const COMPANY_QUERY_REGEX =
  /(公司|企业|集团|科技公司|跨国公司|总部|创始人|ceo|市值|上市|财报|财年|有限责任公司|股份有限公司|谷歌|google|微软|microsoft|苹果|apple|腾讯|tencent|阿里|alibaba|百度|baidu|字节跳动|bytedance|英伟达|nvidia|meta|facebook|特斯拉|tesla|亚马逊|amazon|openai|华为|huawei|小米|xiaomi|比亚迪|byd|三星|samsung|网易|netease|美团|meituan|京东|jd|快手|kuaishou|拼多多|pdd|pinduoduo|uber|airbnb|netflix|奈飞|intel|英特尔|amd|tsmc|台积电|oracle|甲骨文|ibm|salesforce|adobe|sony|索尼|spacex|company|corporation|inc|llc)/i;

/** 知名全球企业精选实景总部照片与官方档案 */
const PRESET_COMPANY_PROFILES: Record<string, Partial<CompanyInfoData>> = {
  谷歌: {
    name: "谷歌",
    englishName: "Google LLC",
    heroImage: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?auto=format&fit=crop&w=1200&q=80",
    description:
      "谷歌有限责任公司（Google LLC）是一家美国跨国科技公司，专注于信息技术、在线广告、搜索引擎技术、电子邮件、云计算、软件、量子计算、电子商务、消费电子产品和人工智能 (AI)。英国广播公司 (BBC) 曾称其为“世界上最强大的公司”，它也是世界上最有价值的品牌之一。谷歌的母公司Alphabet Inc.也被认为是一家大型科技公司。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/Google",
    headquarters: "美国加利福尼亚州山景城 (Googleplex)",
    founded: "1998年9月4日",
    founders: "拉里·佩奇、谢尔盖·布林",
    ceo: "桑达尔·皮查伊 (Sundar Pichai)",
    parentCompany: "Alphabet Inc.",
    industry: "跨国科技 · 互联网 · 云计算 · 人工智能",
    stockTicker: "NASDAQ: GOOGL",
    websiteUrl: "https://about.google"
  },
  google: {
    name: "谷歌",
    englishName: "Google LLC",
    heroImage: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?auto=format&fit=crop&w=1200&q=80",
    description:
      "谷歌有限责任公司（Google LLC）是一家美国跨国科技公司，专注于信息技术、在线广告、搜索引擎技术、电子邮件、云计算、软件、量子计算、电子商务、消费电子产品和人工智能 (AI)。英国广播公司 (BBC) 曾称其为“世界上最强大的公司”，它也是世界上最有价值的品牌之一。谷歌的母公司Alphabet Inc.也被认为是一家大型科技公司。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/Google",
    headquarters: "美国加利福尼亚州山景城 (Googleplex)",
    founded: "1998年9月4日",
    founders: "拉里·佩奇、谢尔盖·布林",
    ceo: "桑达尔·皮查伊 (Sundar Pichai)",
    parentCompany: "Alphabet Inc.",
    industry: "跨国科技 · 互联网 · 云计算 · 人工智能",
    stockTicker: "NASDAQ: GOOGL",
    websiteUrl: "https://about.google"
  },
  微软: {
    name: "微软",
    englishName: "Microsoft Corporation",
    heroImage: "https://images.unsplash.com/photo-1583339793403-3d9b001b6008?auto=format&fit=crop&w=1200&q=80",
    description:
      "微软公司（Microsoft Corporation）是一家美国跨国科技巨头，总部位于华盛顿州雷德蒙德。公司以研发、制造、授权和支持各类计算机软件、消费电子产品、个人电脑及相关服务闻名，其核心产品包括 Windows 操作系统系列、Microsoft 365 办公套件、Azure 云计算平台及 Xbox 游戏品牌，是全球市值最高的科技公司之一。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/微软",
    headquarters: "美国华盛顿州雷德蒙德",
    founded: "1975年4月4日",
    founders: "比尔·盖茨、保罗·艾伦",
    ceo: "萨提亚·纳德拉 (Satya Nadella)",
    industry: "软件开发 · 云计算 · 消费电子 · 人工智能",
    stockTicker: "NASDAQ: MSFT",
    websiteUrl: "https://www.microsoft.com"
  },
  microsoft: {
    name: "微软",
    englishName: "Microsoft Corporation",
    heroImage: "https://images.unsplash.com/photo-1583339793403-3d9b001b6008?auto=format&fit=crop&w=1200&q=80",
    description:
      "微软公司（Microsoft Corporation）是一家美国跨国科技巨头，总部位于华盛顿州雷德蒙德。公司以研发、制造、授权和支持各类计算机软件、消费电子产品、个人电脑及相关服务闻名，其核心产品包括 Windows 操作系统系列、Microsoft 365 办公套件、Azure 云计算平台及 Xbox 游戏品牌，是全球市值最高的科技公司之一。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/微软",
    headquarters: "美国华盛顿州雷德蒙德",
    founded: "1975年4月4日",
    founders: "比尔·盖茨、保罗·艾伦",
    ceo: "萨提亚·纳德拉 (Satya Nadella)",
    industry: "软件开发 · 云计算 · 消费电子 · 人工智能",
    stockTicker: "NASDAQ: MSFT",
    websiteUrl: "https://www.microsoft.com"
  },
  苹果: {
    name: "苹果",
    englishName: "Apple Inc.",
    heroImage: "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=1200&q=80",
    description:
      "苹果公司（Apple Inc.）是一家总部位于美国加州库比蒂诺的跨国高科技公司，也是全球按市值计算最具价值的企业之一。其知名核心产品包含 iPhone 智能手机、iPad 平板电脑、Mac 个人电脑、Apple Watch 智能手表以及 iOS/macOS 操作系统生态，并在半导体设计与数字服务领域拥有全球领先地位。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/Apple",
    headquarters: "美国加利福尼亚州库比蒂诺 (Apple Park)",
    founded: "1976年4月1日",
    founders: "史蒂夫·乔布斯、斯蒂夫·沃兹尼亚克、罗纳德·韦恩",
    ceo: "蒂姆·库克 (Tim Cook)",
    industry: "消费电子 · 计算机硬件与软件 · 数字服务",
    stockTicker: "NASDAQ: AAPL",
    websiteUrl: "https://www.apple.com"
  },
  apple: {
    name: "苹果",
    englishName: "Apple Inc.",
    heroImage: "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=1200&q=80",
    description:
      "苹果公司（Apple Inc.）是一家总部位于美国加州库比蒂诺的跨国高科技公司，也是全球按市值计算最具价值的企业之一。其知名核心产品包含 iPhone 智能手机、iPad 平板电脑、Mac 个人电脑、Apple Watch 智能手表以及 iOS/macOS 操作系统生态，并在半导体设计与数字服务领域拥有全球领先地位。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/Apple",
    headquarters: "美国加利福尼亚州库比蒂诺 (Apple Park)",
    founded: "1976年4月1日",
    founders: "史蒂夫·乔布斯、斯蒂夫·沃兹尼亚克、罗纳德·韦恩",
    ceo: "蒂姆·库克 (Tim Cook)",
    industry: "消费电子 · 计算机硬件与软件 · 数字服务",
    stockTicker: "NASDAQ: AAPL",
    websiteUrl: "https://www.apple.com"
  },
  英伟达: {
    name: "英伟达",
    englishName: "NVIDIA Corporation",
    heroImage: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80",
    description:
      "英伟达公司（NVIDIA Corporation）是一家美国跨国科技公司，全球图形处理器（GPU）与人工智能计算加速硬件的技术先驱与市场领导者。其开发的 CUDA 架构与专业计算芯片为现代大语言模型、深度学习研究以及超算中心提供了核心算力基础支撑。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/NVIDIA",
    headquarters: "美国加利福尼亚州圣克拉拉",
    founded: "1993年4月5日",
    founders: "黄仁勋 (Jensen Huang)、克里斯·马拉科夫斯基、柯蒂斯·普里姆",
    ceo: "黄仁勋 (Jensen Huang)",
    industry: "无厂半导体 · 人工智能算力 · 图形计算",
    stockTicker: "NASDAQ: NVDA",
    websiteUrl: "https://www.nvidia.com"
  },
  nvidia: {
    name: "英伟达",
    englishName: "NVIDIA Corporation",
    heroImage: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80",
    description:
      "英伟达公司（NVIDIA Corporation）是一家美国跨国科技公司，全球图形处理器（GPU）与人工智能计算加速硬件的技术先驱与市场领导者。其开发的 CUDA 架构与专业计算芯片为现代大语言模型、深度学习研究以及超算中心提供了核心算力基础支撑。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/NVIDIA",
    headquarters: "美国加利福尼亚州圣克拉拉",
    founded: "1993年4月5日",
    founders: "黄仁勋 (Jensen Huang)、克里斯·马拉科夫斯基、柯蒂斯·普里姆",
    ceo: "黄仁勋 (Jensen Huang)",
    industry: "无厂半导体 · 人工智能算力 · 图形计算",
    stockTicker: "NASDAQ: NVDA",
    websiteUrl: "https://www.nvidia.com"
  },
  openai: {
    name: "OpenAI",
    englishName: "OpenAI, Inc.",
    heroImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    description:
      "OpenAI 是设立于美国加利福尼亚州旧金山的人工智能研究实验室，由非营利组织 OpenAI, Inc. 与营利子公司 OpenAI Global, LLC 组成。其核心使命是推动安全与普惠的通用人工智能（AGI），知名代表作包括 GPT 系列大语言模型、ChatGPT 交互助手及 Sora 视频生成模型。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/OpenAI",
    headquarters: "美国加利福尼亚州旧金山",
    founded: "2015年12月11日",
    founders: "萨姆·奥特曼、埃隆·马斯克、伊利亚·苏茨克维、格雷格·布罗克曼",
    ceo: "萨姆·奥特曼 (Sam Altman)",
    industry: "人工智能技术 · 深度学习大模型 · 认知计算",
    websiteUrl: "https://openai.com"
  },
  特斯拉: {
    name: "特斯拉",
    englishName: "Tesla, Inc.",
    heroImage: "https://images.unsplash.com/photo-1536700503339-1e4b06520771?auto=format&fit=crop&w=1200&q=80",
    description:
      "特斯拉（Tesla, Inc.）是一家美国跨国汽车与清洁能源技术公司，总部位于得克萨斯州奥斯汀。公司专注于电动汽车制造、太阳能屋顶、全自动驾驶（FSD）以及 Megapack 电池储能系统的研发与量产，是全球清洁能源交通转型的核心代表。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/特斯拉",
    headquarters: "美国得克萨斯州奥斯汀",
    founded: "2003年7月1日",
    founders: "马丁·艾伯哈德、马克·塔彭宁",
    ceo: "埃隆·马斯克 (Elon Musk)",
    industry: "新能源汽车 · 清洁能源 · 储能设备 · 人形机器人",
    stockTicker: "NASDAQ: TSLA",
    websiteUrl: "https://www.tesla.com"
  },
  tesla: {
    name: "特斯拉",
    englishName: "Tesla, Inc.",
    heroImage: "https://images.unsplash.com/photo-1536700503339-1e4b06520771?auto=format&fit=crop&w=1200&q=80",
    description:
      "特斯拉（Tesla, Inc.）是一家美国跨国汽车与清洁能源技术公司，总部位于得克萨斯州奥斯汀。公司专注于电动汽车制造、太阳能屋顶、全自动驾驶（FSD）以及 Megapack 电池储能系统的研发与量产，是全球清洁能源交通转型的核心代表。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/特斯拉",
    headquarters: "美国得克萨斯州奥斯汀",
    founded: "2003年7月1日",
    founders: "马丁·艾伯哈德、马克·塔彭宁",
    ceo: "埃隆·马斯克 (Elon Musk)",
    industry: "新能源汽车 · 清洁能源 · 储能设备 · 人形机器人",
    stockTicker: "NASDAQ: TSLA",
    websiteUrl: "https://www.tesla.com"
  },
  腾讯: {
    name: "腾讯",
    englishName: "Tencent Holdings Ltd.",
    heroImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    description:
      "腾讯控股有限公司（Tencent Holdings Limited）是一家总部位于中国深圳的跨国科技与文化娱乐巨头，成立于1998年11月。公司旗下拥有微信、QQ、腾讯云、腾讯互娱等知名数字服务与社交生态，并在即时通信、数字内容分发与金融科技等领域保持行业领先。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/腾讯",
    headquarters: "中国广东省深圳市南山区腾讯滨海大厦",
    founded: "1998年11月11日",
    founders: "马化腾、张志东、许晨晔、陈一丹、曾李青",
    ceo: "马化腾",
    industry: "互联网 · 社交通信 · 数字文娱 · 云计算",
    stockTicker: "HKEX: 0700",
    websiteUrl: "https://www.tencent.com"
  },
  阿里巴巴: {
    name: "阿里巴巴",
    englishName: "Alibaba Group Holding Limited",
    heroImage: "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80",
    description:
      "阿里巴巴集团控股有限公司（Alibaba Group）是一家总部位于中国杭州的跨国科技控股集团，业务涵盖电子商务、阿里云智能、本地生活服务、菜鸟全球物流网络及数字媒体娱乐等领域，是全球顶尖的数字商业与云计算创新平台之一。",
    sourceName: "维基百科",
    sourceUrl: "https://zh.wikipedia.org/wiki/阿里巴巴集团",
    headquarters: "中国浙江省杭州市余杭区阿里巴巴西溪园区",
    founded: "1999年6月28日",
    founders: "马云及创始团队",
    ceo: "吴泳铭",
    industry: "电子商务 · 云计算 · 物流科技 · 数字媒体",
    stockTicker: "NYSE: BABA / HKEX: 9988",
    websiteUrl: "https://www.alibabagroup.com"
  }
};

export interface CompanyInfoAdapterType extends WidgetAdapter<any, CompanyInfoData> {
  canHandle(query: string, input?: any): boolean;
  transform(query: string, input?: any): CompanyInfoData;
  validate(data: CompanyInfoData): boolean;
}

export const companyInfoAdapter: CompanyInfoAdapterType = {
  canHandle(query: string, input?: any): boolean {
    const q = (query || input?.query || "").trim();
    if (COMPANY_QUERY_REGEX.test(q)) return true;

    // 检查是否有传入预设企业名称
    const lowerQ = q.toLowerCase();
    for (const key of Object.keys(PRESET_COMPANY_PROFILES)) {
      if (lowerQ.includes(key.toLowerCase())) return true;
    }

    // 检查检索信源语料中是否包含强企业实体特征
    const sources = input?.filteredResults || input?.sources || [];
    const corpus = sources.slice(0, 8).map((s: any) => `${s.title || ""} ${s.snippet || ""}`).join(" ");
    return /(有限责任公司|股份有限公司|跨国科技公司|商业控股|公司总部|创立于|上市企业|母公司|集团总部|corporation|inc\.|holdings)/i.test(corpus);
  },

  transform(query: string, result?: any): CompanyInfoData {
    const q = (query || result?.query || "企业实体").trim();
    const lowerQ = q.toLowerCase();

    // 1. 优先匹配世界知名预设科技企业（秒级精准匹配，图片高清，文字纯正）
    for (const [key, preset] of Object.entries(PRESET_COMPANY_PROFILES)) {
      if (lowerQ.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerQ)) {
        // 如果外部搜索带回了真实的维基百科或官方地址，优先融合
        const wikiSource = (result?.filteredResults || result?.sources || []).find(
          (s: any) => (s.url || "").includes("wikipedia.org") || (s.url || "").includes("baike.baidu.com")
        );
        const images = result?.images || [];
        const dynamicHero = images[0]?.imageUrl || preset.heroImage;

        const merged: CompanyInfoData = {
          ...(preset as CompanyInfoData),
          heroImage: dynamicHero || preset.heroImage,
          sourceUrl: wikiSource?.url || preset.sourceUrl,
          sourceName: wikiSource?.url?.includes("wikipedia") ? "维基百科" : (preset.sourceName || "权威档案")
        };
        return merged;
      }
    }

    // 2. 通用动态企业提炼
    const sources: any[] = result?.filteredResults || result?.sources || [];
    const wikiEntry = sources.find(
      (s) => (s.url || "").includes("wikipedia.org") || (s.url || "").includes("baike.baidu.com")
    );
    const officialEntry = sources.find((s) => s.isOfficial);

    // 清洗公司名
    let companyName = q.replace(/(公司|企业|集团|信息|简介|概况|维基百科|百科|介绍|怎么样|最新)/g, "").trim();
    if (!companyName && wikiEntry?.title) {
      companyName = wikiEntry.title.split(/[-_—]/)[0].trim();
    }
    companyName = companyName || q || "企业实体";

    // 提取正文概况段落
    let description = "";
    if (wikiEntry?.snippet) {
      description = wikiEntry.snippet.replace(/<[^>]*>/g, "").trim();
    } else if (sources[0]?.snippet) {
      description = sources[0].snippet.replace(/<[^>]*>/g, "").trim();
    }
    if (!description || description.length < 30) {
      description = result?.summary
        ? result.summary.slice(0, 180) + "..."
        : `${companyName}是一家知名商业与科技企业，在相关行业领域拥有广泛业务布局、持续的技术创新与成熟的全球市场服务能力。`;
    }

    // 图片提取
    const images: any[] = result?.images || [];
    const heroImage =
      images[0]?.imageUrl ||
      sources.find((s) => s.thumbnail)?.thumbnail ||
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80";

    const sourceUrl = wikiEntry?.url || officialEntry?.url || sources[0]?.url || "https://zh.wikipedia.org";
    const sourceName = wikiEntry ? "维基百科" : officialEntry ? "官方网站" : "权威信源";

    const facts: CompanyFact[] = [];
    return {
      name: companyName,
      englishName: `${companyName} Corporation`,
      heroImage,
      description,
      sourceName,
      sourceUrl,
      industry: "商业与高新技术实体",
      headquarters: "以权威工商注册与年报披露为准",
      founded: "以官方公示档案为准",
      websiteUrl: officialEntry?.url || undefined,
      facts
    };
  },

  validate(data: CompanyInfoData): boolean {
    return Boolean(data && data.name && data.description);
  }
};
