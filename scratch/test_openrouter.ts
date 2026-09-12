async function main() {
  const key = "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";
  const t0 = Date.now();
  console.log("Sending request to openrouter/free...");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "user", content: "hello" }]
      })
    });
    console.log("Status:", res.status, "Time:", Date.now() - t0, "ms");
    const txt = await res.text();
    console.log("Body:", txt.slice(0, 300));
  } catch (err: any) {
    console.log("Error:", err.message, "Time:", Date.now() - t0, "ms");
  }
}

main();
