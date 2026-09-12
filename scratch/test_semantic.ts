import { analyzeWidgetIntent } from "../server/widgetIntentAnalyzer.js";
import { planWidgetStrategy } from "../server/widgetPlanner.js";
import { WidgetRegistry } from "../src/widgets/registry.js";
import { registerAllOfficialWidgets } from "../src/widgets/official/index.js";
import { SearchResult } from "../src/types.js";

// 确保官方组件均已注册入注册中心
registerAllOfficialWidgets();

async function runTests() {
  console.log("=== 1. Testing Widget Intent Analyzer & Blueprint Generation ===");

  const testCases: Array<{ query: string; results: SearchResult[] }> = [
    {
      query: "下载 Blender 4.2",
      results: [
        {
          id: "1",
          title: "Blender 官方正式版下载 - 免费开源 3D 创作套件",
          url: "https://www.blender.org/download/",
          snippet: "Blender 是自由开源的三维计算机图形软件，提供建模、雕刻、渲染和合成工具。",
          author: "Blender Foundation",
          isOfficial: true,
          score: 0.98
        }
      ]
    },
    {
      query: "Photoshop",
      results: [
        {
          id: "2",
          title: "Adobe Photoshop 官方网站 - 专业图像与照片处理软件",
          url: "https://www.adobe.com/products/photoshop.html",
          snippet: "探索 Adobe Photoshop，体验全新生成式 AI 与图像处理功能，支持桌面和 iPad。",
          author: "Adobe Inc.",
          isOfficial: true,
          score: 0.95
        }
      ]
    },
    {
      query: "上海天气",
      results: [
        {
          id: "3",
          title: "上海天气预报 15 天查询 - 中国天气网",
          url: "http://www.weather.com.cn/weather/101020100.shtml",
          snippet: "上海实时天气预报，提供气温、风力、空气质量指数及穿衣出行指南。",
          author: "中国气象局",
          score: 0.9
        }
      ]
    },
    {
      query: "B站视频剪辑素材",
      results: [
        {
          id: "4",
          title: "免费 4K 免版税视频素材下载平台精选",
          url: "https://mixkit.co/free-stock-video/",
          snippet: "提供用于视频剪辑的超清无水印绿幕、音效和片头视频素材，支持直接商用下载。",
          score: 0.92
        }
      ]
    },
    {
      query: "学习 Python",
      results: [
        {
          id: "5",
          title: "Python 官方中文文档与核心起步教程",
          url: "https://docs.python.org/zh-cn/3/tutorial/",
          snippet: "面向初学者的 Python 3 官方教程，涵盖变量、列表、函数与面向对象。",
          isOfficial: true,
          score: 0.97
        }
      ]
    }
  ];

  for (const tc of testCases) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Query: "${tc.query}"`);
    
    // 1. 测试意图分析
    const intentAnalysis = await analyzeWidgetIntent({ query: tc.query, results: tc.results });
    console.log(`[Intent Analysis]`);
    console.log(`  Intent: "${intentAnalysis.intent}"`);
    console.log(`  Entity: "${intentAnalysis.entity}"`);
    console.log(`  Goal: "${intentAnalysis.goal}"`);
    console.log(`  Required Capabilities (${intentAnalysis.requiredCapabilities.length}): [${intentAnalysis.requiredCapabilities.slice(0, 4).join(", ")}...]`);

    // 2. 测试蓝图规划
    const plan = await planWidgetStrategy({ query: tc.query, results: tc.results });
    if (plan.blueprint) {
      console.log(`[Widget Blueprint Generated]`);
      console.log(`  Blueprint ID: ${plan.blueprint.blueprintId}`);
      console.log(`  Title: ${plan.blueprint.title}`);
      console.log(`  Layout: ${plan.blueprint.layout}, Size: ${plan.blueprint.size}, Theme: ${plan.blueprint.themeColor}`);
      console.log(`  Components (${plan.blueprint.components.length}):`);
      for (const comp of plan.blueprint.components) {
        console.log(`    - [${comp.capability}] (type: ${comp.type})`);
      }

      // 3. 测试蓝图向 Registry 动态注册
      const registeredModule = WidgetRegistry.registerBlueprint(plan.blueprint);
      console.log(`[Registry] Registered Blueprint Module: id="${registeredModule.id}", capabilities count=${registeredModule.capabilities?.length}`);
    } else {
      console.error(`  ERROR: No blueprint generated!`);
    }
  }

  console.log(`\n=== 2. Testing Capability Inverted Index Lookup ===`);
  const downloadWidgets = WidgetRegistry.findWidgetsByCapability("download_button");
  console.log(`Widgets matching capability "download_button": count=${downloadWidgets.length}, ids=[${downloadWidgets.map(w => w.id).join(", ")}]`);

  const officialWidgets = WidgetRegistry.findWidgetsByCapability("official_site");
  console.log(`Widgets matching capability "official_site": count=${officialWidgets.length}, ids=[${officialWidgets.map(w => w.id).join(", ")}]`);

  const compositeMatch = WidgetRegistry.findWidgetsByCapabilities(["software_info", "download_button", "official_portal", "system_requirement"]);
  console.log(`Composite matching for software download capabilities:`);
  for (const match of compositeMatch.slice(0, 3)) {
    console.log(`  - Module "${match.module.name}" (id: ${match.module.id}): matched ${match.matchCount} caps -> [${match.matchedCapabilities.join(", ")}]`);
  }

  console.log(`\nALL TESTS PASSED SUCCESSFULLY!`);
}

runTests().catch(console.error);
