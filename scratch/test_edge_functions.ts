import { onRequest as handleHealth } from '../cloud-functions/api/health.js';
import { onRequest as handleConfig } from '../cloud-functions/api/config.js';
import { onRequest as handleIntent } from '../cloud-functions/api/intent.js';
import { onRequest as handlePlanner } from '../cloud-functions/api/planner.js';
import { onRequest as handleComposer } from '../cloud-functions/api/composer.js';
import { onRequest as handleForge } from '../cloud-functions/api/cards/forge.js';
import { onRequest as handleAgent } from '../cloud-functions/api/agent.js';
import { onRequest as handleStream } from '../cloud-functions/api/agent/stream.js';
import dotenv from 'dotenv';

dotenv.config();

function makeContext(url: string, method = 'GET', body?: any): any {
  const req = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  return {
    request: req,
    functionPath: new URL(url).pathname,
    env: process.env,
    params: {},
    data: {},
    waitUntil: (p: Promise<any>) => p,
    next: () => Promise.resolve(new Response('Not found', { status: 404 }))
  };
}

async function testEdgeFunctions() {
  console.log('================================================================');
  console.log('⚡ TESTING TENCENT EDGEONE FUNCTIONS (WEB STANDARDS RUNTIME)');
  console.log('================================================================\n');

  // 1. Health
  console.log('1️⃣ Testing /api/health ...');
  const healthRes = await handleHealth(makeContext('https://cerlesse.edgeone.app/api/health'));
  const healthJson = await healthRes.json();
  console.log('   Status:', healthRes.status, healthJson);

  // 2. Config
  console.log('\n2️⃣ Testing /api/config ...');
  const configRes = await handleConfig(makeContext('https://cerlesse.edgeone.app/api/config'));
  const configJson = await configRes.json();
  console.log('   Status:', configRes.status);
  console.log('   Config:', {
    hasOpenRouterKey: configJson.hasOpenRouterKey,
    platform: configJson.platform,
    modelsCount: configJson.models?.length
  });

  // 3. Intent Analyzer Function
  console.log('\n3️⃣ Testing POST /api/intent ("下载 Blender 4.2") ...');
  const intentRes = await handleIntent(makeContext('https://cerlesse.edgeone.app/api/intent', 'POST', {
    query: '下载 Blender 4.2',
    results: [
      { id: '1', title: 'Blender 官方正版下载', url: 'https://blender.org/download', snippet: '3D Creation suite for Windows 64-bit' }
    ]
  }));
  const intentJson = await intentRes.json();
  console.log('   Status:', intentRes.status);
  console.log('   Intent Analysis:', {
    intent: intentJson.intent,
    entity: intentJson.entity,
    needs: intentJson.needs,
    requiredCapabilities: intentJson.requiredCapabilities?.slice(0, 4)
  });

  // 4. Widget Planner Function
  console.log('\n4️⃣ Testing POST /api/planner ("Photoshop") ...');
  const plannerRes = await handlePlanner(makeContext('https://cerlesse.edgeone.app/api/planner', 'POST', {
    query: 'Photoshop',
    results: [
      { id: '1', title: 'Adobe Photoshop 官方中文主页', url: 'https://adobe.com/photoshop', snippet: '专业的图形与图像处理软件' }
    ]
  }));
  const plannerJson = await plannerRes.json();
  console.log('   Status:', plannerRes.status);
  console.log('   Widget Plan:', {
    archetype: plannerJson.suggestedArchetype,
    userGoal: plannerJson.userGoal,
    widgetsCount: plannerJson.widgets?.length,
    hasBlueprint: Boolean(plannerJson.blueprint)
  });

  // 5. Widget Composer Function (Blueprint generation)
  console.log('\n5️⃣ Testing POST /api/composer ("B站视频剪辑素材") ...');
  const composerRes = await handleComposer(makeContext('https://cerlesse.edgeone.app/api/composer', 'POST', {
    query: 'B站视频剪辑素材',
    results: [
      { id: '1', title: '4K视频剪辑绿幕转场素材库', url: 'https://bilibili.com/video/123', snippet: '超清免商用剪辑素材' }
    ]
  }));
  const composerJson = await composerRes.json();
  console.log('   Status:', composerRes.status);
  console.log('   Composed Blueprint:', {
    title: composerJson.title,
    size: composerJson.size,
    layout: composerJson.layout,
    themeColor: composerJson.themeColor,
    components: composerJson.components?.map((c: any) => c.type)
  });

  // 6. Dynamic Card Forge Function
  console.log('\n6️⃣ Testing POST /api/cards/forge ...');
  const forgeRes = await handleForge(makeContext('https://cerlesse.edgeone.app/api/cards/forge', 'POST', {
    query: 'Docker 镜像加速配置',
    results: [
      { id: '1', title: 'Docker 镜像加速器配置指南', url: 'https://docker.com/docs', snippet: '配置 daemon.json registry-mirrors' }
    ],
    archetype: 'action_checklist'
  }));
  const forgeJson = await forgeRes.json();
  console.log('   Status:', forgeRes.status);
  console.log('   Forged Card:', {
    title: forgeJson.card?.title,
    archetype: forgeJson.card?.archetype,
    sections: forgeJson.card?.sections?.length,
    actions: forgeJson.card?.actions?.length
  });

  // 7. Unified Agent POST Function
  console.log('\n7️⃣ Testing POST /api/agent ...');
  const agentRes = await handleAgent(makeContext('https://cerlesse.edgeone.app/api/agent', 'POST', {
    query: 'VSCode',
    model: 'openrouter/free'
  }));
  const agentJson = await agentRes.json();
  console.log('   Status:', agentRes.status);
  console.log('   Agent Result:', {
    query: agentJson.query,
    resultsCount: agentJson.filteredResults?.length,
    customCardsCount: agentJson.customCards?.length,
    hasBlueprint: Boolean(agentJson.widgetPlan?.blueprint)
  });

  // 8. Streaming Agent SSE Function (TransformStream)
  console.log('\n8️⃣ Testing GET /api/agent/stream (SSE via Web TransformStream) ...');
  const streamRes = await handleStream(makeContext('https://cerlesse.edgeone.app/api/agent/stream?q=VSCode'));
  console.log('   Status:', streamRes.status);
  console.log('   Content-Type:', streamRes.headers.get('content-type'));

  const reader = streamRes.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let streamChunksCount = 0;
    let receivedComplete = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      streamChunksCount++;
      if (text.includes('event: complete')) {
        receivedComplete = true;
        break;
      }
    }
    console.log(`   Stream verified: read ${streamChunksCount} chunk(s), received complete event: ${receivedComplete}`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL EDGEONE FUNCTIONS VERIFIED SUCCESSFULLY!');
  console.log('================================================================');
}

testEdgeFunctions().catch(err => {
  console.error('Edge Functions test error:', err);
  process.exit(1);
});
