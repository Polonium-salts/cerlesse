async function test() {
  const res = await fetch("http://localhost:3000/api/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "iPhone 16 Pro 评测与购买建议", deepSearch: false })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("CustomCards count:", data.customCards?.length);
  if (data.customCards) {
    data.customCards.forEach((c: any, i: number) => {
      console.log(`Card ${i + 1}: [${c.archetype}] ${c.title} (tools: ${c.tools?.map((t: any) => t.type).join(", ")})`);
      if (c.matrixData) {
        console.log("  Matrix features:", c.matrixData.features?.slice(0, 2));
      }
    });
  }
  console.log("Layout plan:", data.agentLayoutPlan ? {
    layout_type: data.agentLayoutPlan.layout_type,
    grid_columns: data.agentLayoutPlan.grid_columns,
    widgets: data.agentLayoutPlan.widgets?.map((w: any) => `${w.widget_id}: ${w.size} (span ${w.colSpan}, row ${w.rowIndex})`)
  } : "No agentLayoutPlan");
  console.log("WidgetPlan:", data.widgetPlan?.widgets?.map((w: any) => `${w.type}: ${w.size} (priority ${w.priority})`));
}

test().catch(console.error);
