/**
 * 该文件由 scripts/widgets/generate.ts 自动构建生成
 * 严禁手动修改！构建期已执行 Manifest 与标准 Capabilities/Intents 校验。
 */
import type { ExtensionCatalogEntry } from "./extensionCatalog.js";

export const GENERATED_EXTENSION_CATALOG: ExtensionCatalogEntry[] = [
  {
    "id": "test_extension",
    "name": "Test Extension",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "Widget Extension SDK 测试组件",
    "category": "analysis",
    "tags": [
      "test"
    ],
    "capabilities": [
      "direct_answer"
    ],
    "intents": [
      "general_knowledge"
    ],
    "keywords": [
      "test"
    ],
    "examples": [
      "测试组件"
    ],
    "layout": {
      "defaultWidth": 50,
      "minWidth": 25,
      "maxWidth": 75
    },
    "agent": {
      "selectable": false
    }
  },
  {
    "id": "code_playground",
    "name": "代码演练场",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "提供交互式代码编辑、即时运行控制台、多语言代码片段与控制台输出模拟",
    "category": "developer",
    "tags": [
      "代码",
      "运行",
      "Playground",
      "TypeScript",
      "Python",
      "调试",
      "Console",
      "语法高亮"
    ],
    "capabilities": [
      "code_snippet",
      "code_run",
      "copy_text",
      "cli_execution"
    ],
    "intents": [
      "study_tutorial",
      "troubleshooting",
      "concept_explanation"
    ],
    "keywords": [
      "代码",
      "运行",
      "playground",
      "code",
      "snippet",
      "调试",
      "控制台",
      "输出",
      "示例代码"
    ],
    "examples": [
      "JavaScript 异步并发控制代码运行",
      "Python 列表推导式与数据处理示例",
      "TypeScript 泛型与条件类型演练"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 75,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.7,
      "priority": 85,
      "flexible": true
    }
  },
  {
    "id": "document_preview",
    "name": "文档速览与研报",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "快速预览技术规范、PDF 研报、Markdown 手册与学术证据链摘要",
    "category": "data",
    "tags": [
      "文档",
      "预览",
      "PDF",
      "Markdown",
      "研报",
      "文献",
      "规范",
      "摘要"
    ],
    "capabilities": [
      "verified_docs",
      "literature_archive",
      "citation_retrieval",
      "evidence_chain"
    ],
    "intents": [
      "research",
      "concept_explanation",
      "study_tutorial"
    ],
    "keywords": [
      "文档",
      "预览",
      "pdf",
      "markdown",
      "论文",
      "白皮书",
      "研报",
      "规范",
      "rfc",
      "手册"
    ],
    "examples": [
      "TypeScript 5.0 规范白皮书速览",
      "深度学习模型论文摘要与证据链",
      "RFC 9110 HTTP 语义规范预览"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.72,
      "priority": 83,
      "flexible": true
    }
  },
  {
    "id": "download",
    "name": "下载中心",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "提供多平台安装包下载、包管理器一键安装指令、版本镜像与 SHA256 校验",
    "category": "action",
    "tags": [
      "下载",
      "安装包",
      "Release",
      "平台包",
      "macOS",
      "Windows",
      "Linux",
      "Docker"
    ],
    "capabilities": [
      "download",
      "releases",
      "release_binary",
      "install_command",
      "package_manager",
      "official_site"
    ],
    "intents": [
      "software_download",
      "github_project"
    ],
    "keywords": [
      "下载",
      "安装",
      "installer",
      "dmg",
      "exe",
      "release",
      "brew",
      "npm",
      "pip",
      "curl",
      "download"
    ],
    "examples": [
      "Node.js 安装包下载",
      "Docker Desktop 客户端下载",
      "VS Code macOS 与 Windows 下载"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.75,
      "priority": 95,
      "flexible": true
    }
  },
  {
    "id": "map",
    "name": "地理位置与地图导览",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "展示地理位置、周边 POI 兴趣点探索、路线规划与旅行交通建议",
    "category": "location",
    "tags": [
      "地图",
      "地理位置",
      "POI",
      "景点",
      "导航",
      "路线规划",
      "旅行",
      "周边"
    ],
    "capabilities": [
      "location_map",
      "attractions_map",
      "route_plan",
      "itinerary_timeline"
    ],
    "intents": [
      "travel",
      "general_knowledge"
    ],
    "keywords": [
      "地图",
      "位置",
      "地址",
      "景点",
      "路线",
      "导航",
      "交通",
      "周边",
      "map",
      "location",
      "旅游攻略"
    ],
    "examples": [
      "杭州西湖旅游地图与周边景点",
      "东京新宿美食与交通路线导览",
      "北京故宫博物院参观路线与周边"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.75,
      "priority": 85,
      "flexible": true
    }
  },
  {
    "id": "news_feed",
    "name": "时事资讯",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "汇聚全网即时要闻、热点资讯、科技动态与时序演进摘要",
    "category": "data",
    "tags": [
      "新闻",
      "时事",
      "热点",
      "快讯",
      "科技资讯",
      "动态",
      "资讯流"
    ],
    "capabilities": [
      "temporal_analysis",
      "temporal_evolution",
      "citation_retrieval",
      "overview_synthesis"
    ],
    "intents": [
      "general_knowledge",
      "research"
    ],
    "keywords": [
      "新闻",
      "资讯",
      "news",
      "时事",
      "热点",
      "最新动态",
      "快讯",
      "要闻"
    ],
    "examples": [
      "AI 人工智能最新行业要闻",
      "全球开源大模型前沿发布快讯",
      "近期科技产业热点速递"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.72,
      "priority": 81,
      "flexible": true
    }
  },
  {
    "id": "release_history",
    "name": "版本历史",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "展示软件/项目的历史版本演进、更新日志 (Changelog)、重大特性与破坏性变更",
    "category": "data",
    "tags": [
      "版本历史",
      "更新日志",
      "Changelog",
      "Release",
      "里程碑",
      "版本更新",
      "演进"
    ],
    "capabilities": [
      "version_history",
      "releases",
      "timeline_evolution",
      "milestones",
      "history"
    ],
    "intents": [
      "software_download",
      "github_project",
      "research"
    ],
    "keywords": [
      "版本历史",
      "更新日志",
      "changelog",
      "releases",
      "更新了什么",
      "新特性",
      "历史版本",
      "v2",
      "v3"
    ],
    "examples": [
      "React 19 更新日志与破坏性改动",
      "Next.js 历史版本演进",
      "Tailwind CSS v4 发布说明"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.7,
      "priority": 82,
      "flexible": true
    }
  },
  {
    "id": "repository",
    "name": "开源代码库",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "展示 GitHub/GitLab 仓库详情、Star/Fork 统计、语言构成、快速克隆指令与健康度",
    "category": "data",
    "tags": [
      "GitHub",
      "GitLab",
      "代码仓库",
      "Star",
      "Fork",
      "开源项目",
      "git clone",
      "开源"
    ],
    "capabilities": [
      "git_clone",
      "software_info",
      "trend_signals",
      "copy_text",
      "verified_docs"
    ],
    "intents": [
      "github_project",
      "study_tutorial",
      "software_download"
    ],
    "keywords": [
      "github",
      "gitlab",
      "repo",
      "repository",
      "开源",
      "star",
      "git clone",
      "代码库",
      "源码"
    ],
    "examples": [
      "facebook/react GitHub 仓库",
      "vercel/next.js 代码库与 Star 趋势",
      "tailwindlabs/tailwindcss 开源项目"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.75,
      "priority": 86,
      "flexible": true
    }
  },
  {
    "id": "software_info",
    "name": "软件信息",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "展示软件名称、版本、支持平台、开发者、开源许可证与核心规格",
    "category": "data",
    "tags": [
      "软件",
      "版本",
      "平台",
      "开发者",
      "许可证",
      "规格",
      "开源"
    ],
    "capabilities": [
      "software_info",
      "version_history",
      "copy_text",
      "official_site",
      "license_info"
    ],
    "intents": [
      "software_download",
      "github_project",
      "tool_discovery"
    ],
    "keywords": [
      "软件",
      "版本",
      "开发者",
      "平台",
      "许可证",
      "license",
      "version",
      "developer",
      "software"
    ],
    "examples": [
      "VS Code 软件信息",
      "Docker 版本与支持平台",
      "Node.js 运行环境与许可证"
    ],
    "layout": {
      "defaultWidth": 50,
      "minWidth": 50,
      "maxWidth": 75
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.7,
      "priority": 88,
      "flexible": true
    }
  },
  {
    "id": "tool_discovery",
    "name": "工具发现与替代品",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "发现精选效能工具、竞品与开源替代方案，包含价格模型与核心优势对比",
    "category": "portal",
    "tags": [
      "工具",
      "替代品",
      "竞品",
      "开源替代",
      "生产力",
      "SaaS",
      "推荐",
      "发现"
    ],
    "capabilities": [
      "tool_cards",
      "try_online",
      "software_directory",
      "free_tool",
      "pricing_comparison"
    ],
    "intents": [
      "tool_discovery",
      "software_download",
      "tech_comparison"
    ],
    "keywords": [
      "工具",
      "替代品",
      "alternative",
      "推荐",
      "好用",
      "开源替代",
      "竞品",
      "类似软件"
    ],
    "examples": [
      "Notion 开源替代品推荐",
      "Figma 替代设计工具",
      "Postman 现代化 API 测试工具发现"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.72,
      "priority": 84,
      "flexible": true
    }
  },
  {
    "id": "translation",
    "name": "多语言翻译",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "文本翻译、双语释义、发音与例句",
    "category": "action",
    "tags": [
      "翻译",
      "双语",
      "词典",
      "英语",
      "日语",
      "发音"
    ],
    "capabilities": [
      "language_translation",
      "text_translation",
      "bilingual_comparison",
      "pronunciation_guide",
      "dictionary_lookup"
    ],
    "intents": [
      "translation"
    ],
    "keywords": [
      "翻译",
      "英文",
      "英语",
      "日语",
      "韩语",
      "translate",
      "translation",
      "什么意思"
    ],
    "examples": [
      "苹果英语怎么说",
      "hello 中文",
      "这个词是什么意思"
    ],
    "layout": {
      "defaultWidth": 50,
      "minWidth": 50,
      "maxWidth": 75
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.75
    }
  },
  {
    "id": "trend_chart",
    "name": "趋势与时序图表",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "可视化时序趋势走势、行业增长曲线、Star 增长率与对比图表",
    "category": "data",
    "tags": [
      "趋势",
      "图表",
      "时序",
      "增长率",
      "走势",
      "数据可视化",
      "统计"
    ],
    "capabilities": [
      "trend_signals",
      "temporal_evolution",
      "sentiment_distribution",
      "temporal_analysis"
    ],
    "intents": [
      "research",
      "tech_comparison",
      "github_project"
    ],
    "keywords": [
      "趋势",
      "走势",
      "图表",
      "增长",
      "数据",
      "统计",
      "chart",
      "trend",
      "历史走势"
    ],
    "examples": [
      "AI 大模型关注度增长走势图",
      "React vs Vue 过去 12 个月 npm 下载量趋势",
      "GitHub Star 增长历史曲线"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.72,
      "priority": 84,
      "flexible": true
    }
  },
  {
    "id": "troubleshooting",
    "name": "故障排查与诊断指南",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "分步式问题排查、终端命令快速复制与解决流程",
    "category": "action",
    "tags": [
      "排错",
      "故障",
      "诊断",
      "报错",
      "修复",
      "终端",
      "命令行",
      "troubleshooting"
    ],
    "capabilities": [
      "error_diagnosis",
      "troubleshooting_audit",
      "fix_command"
    ],
    "intents": [
      "troubleshooting"
    ],
    "keywords": [
      "报错",
      "错误",
      "故障",
      "异常",
      "失败",
      "error",
      "failed",
      "exception",
      "fix",
      "crash"
    ],
    "examples": [
      "npm install 报错怎么解决",
      "502 bad gateway 排查",
      "git merge conflict 怎么修复"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.75
    }
  },
  {
    "id": "verification_checklist",
    "name": "排查与核验清单",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "故障诊断、环境依赖检查与实操交互式核验避坑清单",
    "category": "action",
    "tags": [
      "排查",
      "诊断",
      "核验",
      "清单",
      "checklist",
      "troubleshooting"
    ],
    "capabilities": [
      "verification_checklist",
      "prerequisites_check"
    ],
    "intents": [
      "troubleshooting"
    ],
    "keywords": [
      "核验",
      "清单",
      "检查",
      "checklist",
      "verification",
      "排查清单",
      "避坑"
    ],
    "examples": [
      "上线发布前核验清单",
      "Node.js 环境安装核查清单",
      "服务崩溃排查检查表"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 100
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.75
    }
  },
  {
    "id": "weather",
    "name": "实时天气",
    "version": "1.0.0",
    "apiVersion": 1,
    "description": "展示目标地区实时天气、未来预报与气象指标",
    "category": "data",
    "tags": [
      "天气",
      "气象",
      "气温",
      "预报",
      "降雨",
      "空气质量"
    ],
    "capabilities": [
      "weather_current",
      "weather_forecast",
      "weather_indices",
      "air_quality",
      "clothing_advice"
    ],
    "intents": [
      "weather",
      "travel"
    ],
    "keywords": [
      "天气",
      "气象",
      "气温",
      "下雨",
      "下雪",
      "预报",
      "weather",
      "forecast"
    ],
    "examples": [
      "北京今天天气",
      "上海周末天气",
      "伦敦未来三天天气"
    ],
    "layout": {
      "defaultWidth": 75,
      "minWidth": 50,
      "maxWidth": 75
    },
    "agent": {
      "selectable": true,
      "minConfidence": 0.75
    }
  }
];

export function getGeneratedExtensionCatalog(): ExtensionCatalogEntry[] {
  return GENERATED_EXTENSION_CATALOG;
}

export function buildExtensionCatalog(registry?: any): ExtensionCatalogEntry[] {
  if (registry && typeof registry.getAll === "function") {
    return registry.getAll().map((ext: any) => ({
      ...ext.manifest,
      layout: ext.manifest?.layout,
      agent: ext.manifest?.agent
    }));
  }
  return GENERATED_EXTENSION_CATALOG;
}
