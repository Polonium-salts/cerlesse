import { WidgetRegistry } from "../src/widgets/registry.js";
import { createWidget } from "../src/widgets/sdk/index.js";
import { registerAllOfficialWidgets, OFFICIAL_WIDGET_MODULES } from "../src/widgets/official/index.js";
import { buildWidgetSchemaFromCard } from "../server/cardForge.js";
import { CustomCardData } from "../src/types.js";

function runTests() {
  console.log("=== [START] Widget Plugin & Registry System Verification ===");

  // 1. 测试官方标准组件注册
  registerAllOfficialWidgets();
  const allWidgets = WidgetRegistry.getAll();
  console.log(`[PASS] Registered official widgets count: ${allWidgets.length} (Expected >= 16)`);
  if (allWidgets.length < 16) {
    throw new Error(`Expected at least 16 widgets, got ${allWidgets.length}`);
  }

  // 验证关键官方组件 ID
  const testIds = ["quick_answer", "ai_overview", "sources", "mindmap", "comparison", "topic_digest", "agent_workflow"];
  testIds.forEach((id) => {
    const mod = WidgetRegistry.get(id);
    if (!mod) {
      throw new Error(`Official module [${id}] not found in registry`);
    }
    console.log(`  ✓ Module [${id}]: name="${mod.name}", defaultSize="${mod.defaultSize}", category="${mod.category}"`);
  });

  // 2. 测试 SDK 创建自定义动态插件模块
  const customPlugin = createWidget({
    id: "test_dynamic_chart",
    name: "动态对比折线图",
    version: "1.2.0",
    description: "由 Agent 运行时编译注入的自定义数据看板",
    category: "analysis",
    defaultSize: "large",
    supportedSizes: ["medium", "large", "full"],
    schema: {
      type: "widget",
      id: "test_dynamic_chart",
      name: "动态对比折线图",
      size: "large",
      layout: "matrix",
      themeColor: "emerald",
      components: [
        { type: "text", text: "实时基准对比", variant: "title" },
        { type: "metric", label: "吞吐提升", value: "+320%", trend: "up" },
        { type: "badge", label: "已通过沙箱审计", variant: "emerald" },
        { 
          type: "checklist", 
          items: [
            { id: "c1", text: "环境配置完成", done: true },
            { id: "c2", text: "依赖已注入", done: false }
          ] 
        }
      ]
    }
  });

  WidgetRegistry.register(customPlugin);
  const fetched = WidgetRegistry.get("test_dynamic_chart");
  if (!fetched || fetched.name !== "动态对比折线图" || !fetched.schema) {
    throw new Error("Failed to register and fetch dynamic custom widget");
  }
  console.log("[PASS] Dynamic Widget creation and registration verified");

  // 3. 测试 Agent 自主锻造 CustomCardData 自动编译为 WidgetSchema
  const mockCard: CustomCardData = {
    id: "card_mock_123",
    title: "Node.js 22 LTS 升级实操看板",
    subtitle: "针对异步本地存储与内建 WebSocket 的权威升级避坑指南",
    category: "action",
    archetype: "action_checklist",
    themeColor: "emerald",
    iconName: "CheckCircle",
    colSpan: 6,
    createdAt: Date.now(),
    basedOnQuery: "Node.js 22 LTS 新特性与升级指南",
    sourceCount: 5,
    groundedUrls: ["https://nodejs.org/en/blog/release/v22.0.0"],
    metrics: [
      { label: "V8 引擎版本", value: "v12.4", subtext: "基准性能提升 18%", trend: "up" },
      { label: "升级复杂度", value: "低", subtext: "向后兼容性良好", trend: "neutral" }
    ],
    checklistData: {
      tasks: [
        {
          id: "t1",
          stepNumber: 1,
          title: "检查 Node 版本",
          instruction: "确保当前版本 >= 20.11",
          commandOrCode: "node -v",
          checked: true
        },
        {
          id: "t2",
          stepNumber: 2,
          title: "执行环境升级",
          instruction: "使用 nvm 或 fnm 切换至 v22 LTS",
          commandOrCode: "nvm install 22 && nvm use 22",
          checked: false
        }
      ]
    },
    actions: [
      {
        id: "act-1",
        type: "copy",
        tool: "install_command",
        label: "复制安装命令",
        command: "nvm install 22",
        variant: "primary"
      }
    ],
    sections: []
  };

  const compiledSchema = buildWidgetSchemaFromCard(mockCard);
  if (!compiledSchema || compiledSchema.components.length < 3) {
    throw new Error("Failed to compile Card into WidgetSchema");
  }
  console.log(`[PASS] buildWidgetSchemaFromCard compiled ${compiledSchema.components.length} declarative nodes:`);
  compiledSchema.components.forEach((c, idx) => {
    console.log(`  - Node ${idx + 1}: type="${c.type}"`);
  });

  // 4. 测试 WidgetRegistry.registerCustomCard 热注册
  const registeredCardModule = WidgetRegistry.registerCustomCard(mockCard);
  if (!registeredCardModule || WidgetRegistry.get(`custom_card__${mockCard.id}`)?.name !== mockCard.title) {
    throw new Error("registerCustomCard failed to register properly");
  }
  console.log(`[PASS] registerCustomCard hot-registered module: ID="${registeredCardModule.id}", defaultSize="${registeredCardModule.defaultSize}"`);

  // 5. 测试注销机制
  WidgetRegistry.unregister("test_dynamic_chart");
  if (WidgetRegistry.has("test_dynamic_chart")) {
    throw new Error("Failed to unregister test_dynamic_chart");
  }
  console.log("[PASS] unregister widget verified");

  console.log("=== [SUCCESS] All 5 Verification Steps Passed Flawlessly! ===");
}

runTests();
