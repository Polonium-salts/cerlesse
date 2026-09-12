import { analyzeWidgetIntent } from '../server/widgetIntentAnalyzer.js';
import { composeWidgetsForTask } from '../server/widgetComposer.js';
import { planWidgetStrategy } from '../server/widgetPlanner.js';

async function testComposerPipeline() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE WIDGET COMPOSER PIPELINE TESTS');
  console.log('================================================================\n');

  const testCases = [
    {
      name: 'Case 1: Software Download Intent ("下载 Blender 4.2")',
      query: '下载 Blender 4.2',
      results: [
        { id: '1', title: 'Blender 4.2 官方正版下载 - 免费开源三维创作套件', url: 'https://www.blender.org/download/', snippet: 'Blender is the free and open source 3D creation suite. Supports Windows 64-bit, macOS, Linux.' }
      ]
    },
    {
      name: 'Case 2: Software Entity Intent ("Photoshop")',
      query: 'Photoshop',
      results: [
        { id: '2', title: 'Adobe Photoshop 官方中文网站 | 图像和设计软件', url: 'https://www.adobe.com/products/photoshop.html', snippet: 'Adobe Photoshop 提供强大的图像处理能力，最新版本支持生成式 AI 绘图与智能抠图。' }
      ]
    },
    {
      name: 'Case 3: Resource Search with Download & Favorite ("B站视频剪辑素材")',
      query: 'B站视频剪辑素材',
      results: [
        { id: '3', title: '4K超清绿幕转场+音效合集 | 视频素材库', url: 'https://bilibili.com/video/BV123456', snippet: '提供100+款精美无水印剪辑素材，免费无版权商用，含音效、转场与LUT调色预设。' }
      ]
    },
    {
      name: 'Case 4: Programming Study Tutorial ("Python学习")',
      query: 'Python学习',
      results: [
        { id: '4', title: 'Python 快速入门与实战教程', url: 'https://python.org/doc', snippet: '从基础语法到高级特性，包含变量、循环、函数与数据科学实操代码。' }
      ]
    },
    {
      name: 'Case 5: GitHub Open Source Project ("GitHub热门开源项目")',
      query: 'GitHub热门开源项目',
      results: [
        { id: '5', title: 'vllm-project/vllm: A high-throughput and memory-efficient LLM serving engine', url: 'https://github.com/vllm-project/vllm', snippet: 'Easy, fast, and cheap LLM serving for everyone. 32.5k stars.' }
      ]
    }
  ];

  for (const tc of testCases) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`📌 ${tc.name}`);
    console.log(`Query: "${tc.query}"`);

    // 1. Intent Analysis
    const intentAnalysis = await analyzeWidgetIntent({ query: tc.query, results: tc.results });
    console.log(`\n1️⃣ Intent Analysis Result:`);
    console.log(`   - Primary Intent:  ${intentAnalysis.intent}`);
    console.log(`   - Entity:          ${intentAnalysis.entity}`);
    console.log(`   - Intents:         [${(intentAnalysis.intents || []).join(', ')}]`);
    console.log(`   - Extracted Needs: [${(intentAnalysis.needs || []).join(', ')}]`);
    console.log(`   - Capabilities:    [${intentAnalysis.requiredCapabilities.slice(0, 4).join(', ')}...]`);
    console.log(`   - Confidence:      ${(intentAnalysis.confidence * 100).toFixed(0)}%`);

    // 2. Direct Widget Composer
    const blueprint = composeWidgetsForTask({ query: tc.query, results: tc.results, intentAnalysis });
    console.log(`\n2️⃣ Widget Composer Result:`);
    console.log(`   - Blueprint Title: ${blueprint.title}`);
    console.log(`   - Entity:          ${blueprint.entity}`);
    console.log(`   - Planned Size:    ${blueprint.size}`);
    console.log(`   - Layout:          ${blueprint.layout}`);
    console.log(`   - Theme Color:     ${blueprint.themeColor}`);
    console.log(`   - Matched Widgets: [${(blueprint.matchedWidgetIds || []).join(', ')}]`);
    console.log(`   - Multi-zone Nodes (${blueprint.components.length} components):`);
    for (const comp of blueprint.components) {
      console.log(`      * [${comp.capability}] (type: ${comp.type})`);
    }

    // 3. Full Widget Planner Strategy Integration
    const plan = await planWidgetStrategy({ query: tc.query, results: tc.results });
    console.log(`\n3️⃣ Full Widget Strategy Plan:`);
    console.log(`   - User Goal:       ${plan.userGoal}`);
    console.log(`   - Archetype:       ${plan.suggestedArchetype}`);
    console.log(`   - Capabilities:    [${plan.capabilities.join(', ')}]`);
    console.log(`   - Actions:         [${plan.primaryActions.map(a => a.label).join(', ')}]`);
    console.log(`   - Blueprint Pres.: ${Boolean(plan.blueprint)} (Size: ${plan.blueprint?.size})`);
  }

  console.log('\n================================================================');
  console.log('✅ ALL COMPOSER PIPELINE TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

testComposerPipeline().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
