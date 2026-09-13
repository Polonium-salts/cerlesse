async function verify() {
  console.log("Testing Agent API with Widget Schema & Plugin System...");
  const base = process.env.CERLESSE_URL || "http://localhost:3100";
  const res = await fetch(`${base}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "Docker Desktop 替代方案与一键安装配置",
      deep: false
    })
  });

  if (!res.ok) {
    throw new Error(`API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  console.log("Agent response received!");
  console.log(`- Query: ${data.query}`);
  console.log(`- Layout strategy intent: ${data.layoutStrategy?.intentType}`);
  console.log(`- Custom cards count: ${data.customCards?.length || 0}`);

  if (data.customCards && data.customCards.length > 0) {
    data.customCards.forEach((c: any, i: number) => {
      console.log(`\nCard ${i + 1}: [${c.title}]`);
      console.log(`  Archetype: ${c.archetype}`);
      console.log(`  ThemeColor: ${c.themeColor}`);
      console.log(`  Has Schema: ${Boolean(c.schema)}`);
      if (c.schema) {
        console.log(`  Schema Component Count: ${c.schema.components?.length || 0}`);
        console.log(`  Schema Component Types: ${c.schema.components?.map((n: any) => n.type).join(", ")}`);
      }
      console.log(`  Actions Count: ${c.actions?.length || 0}`);
    });
  }

  console.log("\n[SUCCESS] E2E Verification Complete!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
