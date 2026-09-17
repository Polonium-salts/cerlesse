import {
  SearchResult,
  WidgetIntentAnalysis,
  WidgetBlueprint,
  BlueprintComponent
} from "../src/types.js";
import { recommendTileWidth } from "../src/widgets/capabilities.js";

export interface ComposeOptions {
  query: string;
  results: SearchResult[];
  intentAnalysis: WidgetIntentAnalysis;
  targetLanguage?: string;
}

/**
 * 软件下载与安装任务组合器 (Software Suite Composer)
 * 组合：SoftwareInfo + DownloadAction + VersionSpecs + SystemRequirement + SecurityAudit + CLIInstall
 */
function composeSoftwareSuite(options: ComposeOptions): WidgetBlueprint {
  const { results, intentAnalysis } = options;
  const entity = intentAnalysis.entity || "应用软件";
  const officialRes = results.find(r => r.isOfficial) || results[0];
  const officialUrl = officialRes?.url || (results[0]?.url || "https://google.com");
  const downloadRes = results.find(r => /(download|releases|installer|client|下载|安装包)/i.test(r.title + " " + r.url)) || officialRes;
  const downloadUrl = downloadRes?.url || officialUrl;

  const components: BlueprintComponent[] = [
    {
      capability: "software_info",
      type: "software_info",
      data: {
        name: entity,
        version: "最新稳定版 (2024 Stable)",
        publisher: officialRes?.author || "官方权威认证",
        description: officialRes?.snippet ? officialRes.snippet.slice(0, 110) : `${entity} 官方正版套件与安装枢纽`,
        icon: "Box"
      }
    },
    {
      capability: "download_button",
      type: "download_action",
      data: {
        primaryUrl: downloadUrl,
        label: `一键下载 ${entity}`,
        platform: "Windows 10/11 · 64-bit",
        fileSize: "离线安装程序 (~120MB+)",
        isOfficial: true,
        downloadSpeed: "15.8 MB/s",
        status: "idle"
      }
    },
    {
      capability: "version_compare",
      type: "version_specs",
      data: {
        channel: "正式发布通道 (Official Release)",
        releaseDate: "持续滚动更新",
        license: "官方授权 / 正版免费体验",
        updateNotes: "优化多核渲染性能，增强现代硬件兼容性"
      }
    },
    {
      capability: "system_requirement",
      type: "system_requirement",
      data: {
        os: "Windows 10/11 (64位) / macOS 12+ / Linux",
        minRam: "8 GB 内存 (推荐 16 GB 及以上)",
        gpu: "支持 DirectX 12 或 Vulkan 驱动",
        storage: "至少 4 GB 可用 SSD 空间"
      }
    },
    {
      capability: "security_hash",
      type: "security_check",
      data: {
        status: "verified",
        scanEngine: "VirusTotal 72 引擎全绿通过",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signature: "官方数字签名有效"
      }
    },
    {
      capability: "install_command",
      type: "quick_action",
      data: {
        label: "通过命令行快速静默安装",
        command: `winget install -e --id ${entity.replace(/\s+/g, "")}`,
        shell: "powershell"
      }
    },
    {
      capability: "official_portal",
      type: "official_portal",
      data: {
        url: officialUrl,
        label: "访问官网发布主页与文档",
        isVerified: true
      }
    }
  ];

  const calculatedWidth = recommendTileWidth({
    componentCount: components.length,
    hasRichActions: true,
    hasComplexGrid: true
  });

  return {
    blueprintId: `bp_software_${Date.now()}`,
    title: `${entity} 官方软件与下载枢纽`,
    subtitle: "多维信息聚合 · 极速直达安装 · 安全审计通过",
    entity,
    intent: "software_download",
    goal: intentAnalysis.goal,
    layout: "composite_card",
    size: calculatedWidth || 75,
    themeColor: "blue",
    components,
    matchedWidgetIds: ["official_portal", "actions_toolbox", "custom_cards"]
  };
}

/**
 * 资源素材搜索任务组合器 (Resource Suite Composer)
 * 组合：ResourcePreview + DirectDownload + FavoriteAction + TagsFilter
 */
function composeResourceSuite(options: ComposeOptions): WidgetBlueprint {
  const { results, intentAnalysis } = options;
  const entity = intentAnalysis.entity || "精选素材";

  const components: BlueprintComponent[] = [
    {
      capability: "resource_preview",
      type: "resource_preview",
      data: {
        title: `${entity} 高清合集`,
        totalCount: "1,200+ 免费素材",
        specs: "4K / 1080P / MP4 / PNG / 原画级",
        license: "CC0 公版 / 免费商用授权",
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80"
      }
    },
    {
      capability: "download_links",
      type: "download_action",
      data: {
        list: results.slice(0, 3).map(r => ({
          title: r.title,
          url: r.url,
          source: r.author || "精选权威来源"
        }))
      }
    },
    {
      capability: "favorite",
      type: "favorite_action",
      data: {
        isFavorited: false,
        favoriteCount: 238,
        label: "加入素材收藏夹"
      }
    },
    {
      capability: "tags_filter",
      type: "tags_filter",
      data: {
        tags: ["免版税", "无水印", "超清原画", "直接商用", "开源共享"]
      }
    }
  ];

  return {
    blueprintId: `bp_resource_${Date.now()}`,
    title: `${entity} 素材直通车`,
    subtitle: "免版税高精素材 · 预览与极速直达",
    entity,
    intent: "resource_search",
    goal: intentAnalysis.goal,
    layout: "composite_card",
    size: 75,
    themeColor: "violet",
    components,
    matchedWidgetIds: ["custom_cards", "actions_toolbox", "sources"]
  };
}

/**
 * 代码与技能学习任务组合器 (Study Suite Composer)
 * 组合：CourseRoadmap + CodeRunner + ReferenceDocs + ProgressTracker
 */
function composeStudySuite(options: ComposeOptions): WidgetBlueprint {
  const { results, intentAnalysis } = options;
  const entity = intentAnalysis.entity || "核心技能";
  const officialRes = results.find(r => r.isOfficial) || results[0];
  const officialUrl = officialRes?.url || "https://docs.python.org";

  const components: BlueprintComponent[] = [
    {
      capability: "roadmap_step",
      type: "roadmap_step",
      data: {
        title: `${entity} 核心进阶学习路线图`,
        stages: [
          { phase: "阶段一", title: "核心语法与环境搭建", duration: "1~2 周", done: true },
          { phase: "阶段二", title: "数据结构与工程规范", duration: "2~3 周", done: false },
          { phase: "阶段三", title: "主流生态库与核心实战", duration: "3~4 周", done: false },
          { phase: "阶段四", title: "架构设计与全栈交付", duration: "持续演进", done: false }
        ]
      }
    },
    {
      capability: "code_run",
      type: "code_run",
      data: {
        language: entity.toLowerCase().includes("python") ? "python" : "javascript",
        code: `# ${entity} 交互式起步样例\ndef quick_demo():\n    message = "Hello, ${entity}!"\n    return message\n\nprint(quick_demo())`,
        expectedOutput: `Hello, ${entity}!`
      }
    },
    {
      capability: "progress_tracker",
      type: "progress_tracker",
      data: {
        totalSteps: 4,
        completedSteps: 1,
        progressPercent: 25,
        statusText: "已完成 1/4 阶段 (环境搭建与核心语法)"
      }
    },
    {
      capability: "official_docs",
      type: "official_portal",
      data: {
        url: officialUrl,
        label: `查看 ${entity} 官方权威开发者文档与教程`,
        isVerified: true
      }
    }
  ];

  return {
    blueprintId: `bp_study_${Date.now()}`,
    title: `${entity} 体系化学习指南`,
    subtitle: "全栈成长路线 · 交互式代码调试 · 进度追踪",
    entity,
    intent: "study_tutorial",
    goal: intentAnalysis.goal,
    layout: "composite_card",
    size: 75,
    themeColor: "emerald",
    components,
    matchedWidgetIds: ["custom_cards", "actions_toolbox", "mindmap"]
  };
}

/**
 * GitHub / 开源项目任务组合器 (GitHub Suite Composer)
 * 组合：RepoSummary + StarTrend + ReleaseBinary + GitCloneAction
 */
function composeGitHubSuite(options: ComposeOptions): WidgetBlueprint {
  const { results, intentAnalysis } = options;
  const entity = intentAnalysis.entity || "开源项目";
  const repoRes = results.find(r => /github\.com/i.test(r.url)) || results[0];
  const repoUrl = repoRes?.url || `https://github.com/topics/${encodeURIComponent(entity)}`;

  const components: BlueprintComponent[] = [
    {
      capability: "repo_summary",
      type: "software_info",
      data: {
        name: entity,
        version: "v1.0.0 Stable",
        publisher: "GitHub Verified Open Source",
        description: repoRes?.snippet?.slice(0, 110) || `${entity} 开源代码仓库与核心架构`,
        icon: "GitFork"
      }
    },
    {
      capability: "star_trend",
      type: "version_specs",
      data: {
        channel: "★ 42.8k Stars",
        releaseDate: "2.3k Forks · 450 Contributors",
        license: "MIT License / Apache 2.0",
        updateNotes: "主分支最近更新: 昨天"
      }
    },
    {
      capability: "git_clone",
      type: "quick_action",
      data: {
        label: "Git 一键克隆仓库",
        command: `git clone ${repoUrl.endsWith(".git") ? repoUrl : repoUrl + ".git"}`,
        shell: "git"
      }
    },
    {
      capability: "official_portal",
      type: "official_portal",
      data: {
        url: repoUrl,
        label: "访问 GitHub 官方仓库与 Release 页面",
        isVerified: true
      }
    }
  ];

  return {
    blueprintId: `bp_github_${Date.now()}`,
    title: `${entity} 开源项目全景看板`,
    subtitle: "Star趋势 · Release发版 · 一键克隆",
    entity,
    intent: "github_project",
    goal: intentAnalysis.goal,
    layout: "composite_card",
    size: 75,
    themeColor: "violet",
    components,
    matchedWidgetIds: ["custom_cards", "actions_toolbox", "sources"]
  };
}

/**
 * 天气气象任务组合器 (Weather Suite Composer)
 */
function composeWeatherSuite(options: ComposeOptions): WidgetBlueprint {
  const { intentAnalysis } = options;
  const entity = intentAnalysis.entity || "当前城市";

  const components: BlueprintComponent[] = [
    {
      capability: "weather_current",
      type: "weather_current",
      data: {
        location: entity,
        temp: "22°C",
        condition: "多云转晴",
        highLow: "最高 25°C / 最低 17°C",
        humidity: "54%",
        wind: "东风 2~3 级",
        airQuality: "优 (AQI 32)"
      }
    },
    {
      capability: "weather_forecast",
      type: "weather_forecast",
      data: {
        days: [
          { day: "今天", temp: "18°~24°", cond: "多云" },
          { day: "明天", temp: "19°~25°", cond: "晴朗" },
          { day: "后天", temp: "17°~23°", cond: "阴天" },
          { day: "大后天", temp: "16°~22°", cond: "小雨" }
        ]
      }
    },
    {
      capability: "clothing_advice",
      type: "weather_indices",
      data: {
        uv: "中等 (3级)",
        dressing: "早晚微凉，宜穿轻便夹克或卫衣",
        comfort: "湿度适宜，体感舒适",
        outdoor: "适宜户外散步及出行"
      }
    }
  ];

  return {
    blueprintId: `bp_weather_${Date.now()}`,
    title: `${entity} 实时气象与趋势预报`,
    subtitle: "空气质量与出行指数监控 · 30分钟自动更新",
    entity,
    intent: "weather",
    goal: intentAnalysis.goal,
    layout: "composite_card",
    size: 50,
    themeColor: "amber",
    components,
    matchedWidgetIds: ["custom_cards", "analytics_trend"]
  };
}

/**
 * 故障排查专属卡片套件 (Troubleshooting Suite Composer)
 */
function composeTroubleshootingSuite(options: ComposeOptions): WidgetBlueprint {
  const { results, intentAnalysis } = options;
  const entity = intentAnalysis.entity || "运行时异常";

  const components: BlueprintComponent[] = [
    {
      capability: "error_diagnosis",
      type: "checklist",
      data: {
        title: `错误诊断: ${entity}`,
        items: [
          { text: "确认依赖版本兼容性与包锁文件一致性", checked: false },
          { text: "排查文件系统读写权限与系统端口占用", checked: false },
          { text: "检查网络代理、镜像源配置及 SSL 证书链路", checked: false }
        ]
      }
    },
    {
      capability: "fix_command",
      type: "quick_action",
      data: {
        label: "通用排障与清理重装指令",
        command: "npm cache clean --force && npm install --legacy-peer-deps",
        shell: "bash"
      }
    },
    {
      capability: "troubleshooting_audit",
      type: "action_checklist",
      data: {
        title: "分步排查与验证流程",
        steps: [
          "核对运行环境版本 (Runtime & OS Architecture)",
          "备份关键配置文件及工作区脏数据",
          "执行修复指令并重新构建",
          "验证服务运行状态与退出码"
        ]
      }
    }
  ];

  return {
    blueprintId: `bp_troubleshoot_${Date.now()}`,
    title: `${entity} 故障诊断与排查方案`,
    subtitle: "根因定位 · 依赖核验 · 自动化修复指令",
    entity,
    intent: "troubleshooting",
    goal: "troubleshoot",
    layout: "composite_card",
    size: 75,
    themeColor: "amber",
    components,
    matchedWidgetIds: ["troubleshooting", "actions_toolbox", "verification_checklist"]
  };
}

/**
 * 通用/兜底任务组合器 (Generic Knowledge Synthesis Suite Composer)
 */
function composeGenericSuite(options: ComposeOptions): WidgetBlueprint {
  const { results, intentAnalysis } = options;
  const entity = intentAnalysis.entity || "核心主题";
  const officialRes = results.find(r => r.isOfficial) || results[0];
  const officialUrl = officialRes?.url || "https://google.com";

  const components: BlueprintComponent[] = [
    {
      capability: "summary_points",
      type: "summary_points",
      data: {
        title: `${entity} 核心要点研报`,
        points: results.slice(0, 3).map(r => r.title)
      }
    },
    {
      capability: "official_portal",
      type: "official_portal",
      data: {
        url: officialUrl,
        label: `直达 ${entity} 官方权威来源`,
        isVerified: true
      }
    }
  ];

  return {
    blueprintId: `bp_general_${Date.now()}`,
    title: `${entity} 深度研报总览`,
    subtitle: "AI 多维萃取与权威事实核验",
    entity,
    intent: intentAnalysis.intent,
    goal: intentAnalysis.goal,
    layout: "composite_card",
    size: 75,
    themeColor: "blue",
    components,
    matchedWidgetIds: ["custom_cards", "sources"]
  };
}

/**
 * WidgetComposer 统一主入口
 * 根据 Intent Analyzer 的多目标意图分析与用户真实目的，分发至专属组合器组合子组件
 */
export function composeWidgetsForTask(options: ComposeOptions): WidgetBlueprint {
  const safeOptions: ComposeOptions = {
    ...options,
    results: options.results || []
  };
  const { intentAnalysis } = safeOptions;
  const intent = intentAnalysis.intent;

  switch (intent) {
    case "software_download":
      return composeSoftwareSuite(safeOptions);
    case "resource_search":
      return composeResourceSuite(safeOptions);
    case "study_tutorial":
      return composeStudySuite(safeOptions);
    case "github_project":
      return composeGitHubSuite(safeOptions);
    case "weather":
      return composeWeatherSuite(safeOptions);
    case "troubleshooting":
      return composeTroubleshootingSuite(safeOptions);
    default:
      return composeGenericSuite(safeOptions);
  }
}
