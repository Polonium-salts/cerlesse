import { runAgentTeam } from "../server/agentTeam.js";

async function testStream() {
  console.log("=== Testing AgentTeam Pipeline & Widget Forge Step ===");
  const t0 = Date.now();
  
  const result = await runAgentTeam({
    query: "RTX 5090 显卡性能参数与选购建议",
    enableDeepSearch: false,
    onStepProgress: (currentStep, allSteps) => {
      console.log(`[STEP UPDATE] (${currentStep.agentRole}) ${currentStep.id}: ${currentStep.status} - ${currentStep.title}`);
    },
    onTeamProgress: (team) => {
      const forgeTask = team.tasksDelegated.find(t => t.id === "TASK-WIDGET-ARCHITECT");
      console.log(`[TEAM UPDATE] TASK-WIDGET-ARCHITECT status: ${forgeTask?.status}, Summary: "${team.collaborationSummary.slice(0, 40)}..."`);
    }
  });

  const duration = Date.now() - t0;
  console.log(`\n=== PIPELINE FINISHED IN ${duration}ms ===`);
  console.log("Result summary length:", result.summary?.length);
  console.log("Custom cards generated:", result.customCards?.length);
  if (result.customCards) {
    result.customCards.forEach(c => {
      console.log(`  - [${c.title}] (${c.archetype}, hasSchema: ${Boolean(c.schema)})`);
    });
  }

  const finalForgeTask = result.agentTeam?.tasksDelegated.find(t => t.id === "TASK-WIDGET-ARCHITECT");
  console.log("Final TASK-WIDGET-ARCHITECT status:", finalForgeTask?.status);

  if (finalForgeTask?.status !== "completed") {
    throw new Error(`TASK-WIDGET-ARCHITECT was not completed! Status: ${finalForgeTask?.status}`);
  }
  console.log(">>> SUCCESS: Widget Forge completed seamlessly without getting stuck! <<<");
}

testStream().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
