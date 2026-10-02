export interface CompanyFact {
  label: string;
  value: string;
  icon?: string;
}

export interface CompanyInfoData {
  /** 公司中文或主品牌名称 (如 "谷歌") */
  name: string;
  /** 公司英文/官方全称 (如 "Google LLC") */
  englishName?: string;
  /** 企业总部大楼/园区真实全景照片 (Hero Image) */
  heroImage?: string;
  /** 公司核心概况详实段落 (与维基百科/权威档案对齐) */
  description: string;
  /** 溯源信源名称 (如 "维基百科"、"官方网站") */
  sourceName?: string;
  /** 溯源信源链接 */
  sourceUrl?: string;
  /** 总部位置 (如 "美国加利福尼亚州山景城") */
  headquarters?: string;
  /** 成立时间 (如 "1998年9月4日") */
  founded?: string;
  /** 创始人 (如 "拉里·佩奇、谢尔盖·布林") */
  founders?: string;
  /** 首席执行官 / CEO (如 "桑达尔·皮查伊") */
  ceo?: string;
  /** 母公司 / 控股主体 (如 "Alphabet Inc.") */
  parentCompany?: string;
  /** 行业领域 (如 "跨国科技 / 互联网 / 云计算 / 人工智能") */
  industry?: string;
  /** 股票代码 (如 "NASDAQ: GOOGL") */
  stockTicker?: string;
  /** 官方主页链接 */
  websiteUrl?: string;
  /** 结构化核心事实清单 */
  facts?: CompanyFact[];
}
