async function testApiStream() {
  console.log('Testing SSE /api/agent/stream endpoint for "Photoshop"...');
  const res = await fetch('http://localhost:3000/api/agent/stream?q=Photoshop');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No body');

  const decoder = new TextDecoder();
  let buffer = '';
  let completePayload: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const chunk of lines) {
      if (chunk.startsWith(': keepalive')) continue;
      const eventMatch = chunk.match(/event:\s*([^\n]+)/);
      const dataMatch = chunk.match(/data:\s*([\s\S]+)/);
      if (eventMatch && dataMatch) {
        const event = eventMatch[1];
        try {
          const data = JSON.parse(dataMatch[1]);
          console.log(`[SSE Event: ${event}]`, event === 'complete' ? 'Received complete result payload!' : (data.message || Object.keys(data)));
          if (event === 'complete') {
            completePayload = data;
          }
        } catch {
          console.log(`[SSE Event: ${event}] (raw text)`);
        }
      }
    }

    if (completePayload) break;
  }

  if (completePayload) {
    console.log('\n--- VERIFYING COMPLETE PAYLOAD ---');
    console.log('Widget Plan:', {
      suggestedArchetype: completePayload.widgetPlan?.suggestedArchetype,
      capabilities: completePayload.widgetPlan?.capabilities?.slice(0, 5),
      hasBlueprint: Boolean(completePayload.widgetPlan?.blueprint),
      blueprintTitle: completePayload.widgetPlan?.blueprint?.title,
      blueprintComponents: completePayload.widgetPlan?.blueprint?.components?.map((c: any) => c.type)
    });
    console.log('Custom Cards count:', completePayload.customCards?.length);
    console.log('Tile Spans count:', completePayload.customWidgetSpans?.length);
  }
}

testApiStream().catch(err => {
  console.error('API test failed:', err);
  process.exit(1);
});
