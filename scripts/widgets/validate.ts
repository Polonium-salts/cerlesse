import { discoverExtensionDirs } from "./utils.js";
import { validateManifest } from "../../src/widgets/sdk/manifestValidator.js";

async function run() {
  console.log("🛡️ Validating widget extensions...\n");
  const list = await discoverExtensionDirs();
  const errors: Array<{ name: string; error: string }> = [];
  const seenIds = new Set<string>();

  for (const item of list) {
    if (item.error) {
      errors.push({ name: item.directoryName, error: item.error });
      continue;
    }

    const manifest = item.manifest;
    if (!manifest) {
      errors.push({ name: item.directoryName, error: "Missing manifest in extension" });
      continue;
    }

    // 重复 ID 检查
    if (seenIds.has(manifest.id)) {
      errors.push({
        name: item.directoryName,
        error: `Duplicate widget id: ${manifest.id}`
      });
      continue;
    }
    seenIds.add(manifest.id);

    // 结构/能力/意图/布局/目录ID 校验
    try {
      validateManifest(manifest, item.directoryName);
      console.log(`  ✓ ${item.directoryName} (${manifest.id}) validated`);
    } catch (err: any) {
      errors.push({ name: item.directoryName, error: err.message });
      console.log(`  ✗ ${item.directoryName}: ${err.message}`);
    }
  }

  console.log("");
  if (errors.length > 0) {
    console.error(`❌ Validation failed with ${errors.length} error(s):`);
    for (const e of errors) {
      console.error(`   - [${e.name}]: ${e.error}`);
    }
    process.exit(1);
  } else {
    console.log(`✓ ${list.length} extensions validated successfully.`);
  }
}

run().catch(err => {
  console.error("Fatal validation error:", err);
  process.exit(1);
});
