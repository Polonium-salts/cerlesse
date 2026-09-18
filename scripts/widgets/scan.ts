import { discoverExtensionDirs } from "./utils.js";

async function run() {
  console.log("🔍 Scanning widget extensions in src/widgets/extensions/...\n");
  const list = await discoverExtensionDirs();

  const valid = list.filter(item => item.extension && !item.error);
  const invalid = list.filter(item => item.error);

  console.log(`Found ${list.length} extensions (${valid.length} valid, ${invalid.length} invalid):\n`);

  for (const item of valid) {
    const m = item.manifest!;
    console.log(`  ✓ ${item.directoryName} -> ${m.id} (${m.name} v${m.version})`);
    console.log(`    capabilities: [${m.capabilities.join(", ")}]`);
    console.log(`    intents: [${m.intents.join(", ")}]`);
  }

  for (const item of invalid) {
    console.log(`  ✗ ${item.directoryName}: ${item.error}`);
  }

  if (invalid.length > 0) {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error("Fatal scan error:", err);
  process.exit(1);
});
