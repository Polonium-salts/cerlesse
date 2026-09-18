import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRouteForIntent, isWidgetForbidden, isWidgetAllowed, normalizeIntent } from "../../../server/agentRouter.js";
import { retrieveWidgets } from "../../../src/widgets/widgetRetriever.js";
import { deterministicReRankWidgets } from "../../../server/widgetSelector.js";

describe("Agent Intent Differentiation & Non-Forced Defaults", () => {
  it("should correctly isolate weather intent without forced irrelevant widgets", async () => {
    const route = getRouteForIntent("weather");
    assert.equal(route.intent, "weather");
    assert.deepEqual(route.mandatoryWidgets, ["weather"]);
    assert.ok(isWidgetAllowed("weather", "weather"));
    assert.ok(isWidgetForbidden("translation", "weather"));
    assert.ok(isWidgetForbidden("troubleshooting", "weather"));
    assert.ok(isWidgetForbidden("comparison", "weather"));
    assert.ok(isWidgetForbidden("image_gallery", "weather"));

    // Retrieve candidates for weather query
    const candidates = await retrieveWidgets("北京今天气温预报", {
      intent: "weather",
      capabilities: ["weather_current", "weather_forecast"]
    });

    const decision = deterministicReRankWidgets(
      "北京今天气温预报",
      "weather",
      "查看实时天气与预报",
      candidates
    );

    const keys = decision.selectedWidgets.map(w => w.key);
    assert.ok(keys.includes("weather"), "Weather widget must be selected for weather query");
    assert.ok(!keys.includes("translation"), "Translation widget must NOT be selected");
    assert.ok(!keys.includes("troubleshooting"), "Troubleshooting widget must NOT be selected");
    assert.ok(!keys.includes("image_gallery"), "Image gallery widget must NOT be selected");
  });

  it("should correctly isolate translation intent without weather or code widgets", async () => {
    const route = getRouteForIntent("translation");
    assert.equal(route.intent, "translation");
    assert.deepEqual(route.mandatoryWidgets, ["translation"]);
    assert.ok(isWidgetAllowed("translation", "translation"));
    assert.ok(isWidgetForbidden("weather", "translation"));
    assert.ok(isWidgetForbidden("troubleshooting", "translation"));
    assert.ok(isWidgetForbidden("image_gallery", "translation"));

    const candidates = await retrieveWidgets("translate hello world to chinese", {
      intent: "translation",
      capabilities: ["language_translation", "text_translation"]
    });

    const decision = deterministicReRankWidgets(
      "translate hello world to chinese",
      "translation",
      "翻译英文至中文",
      candidates
    );

    const keys = decision.selectedWidgets.map(w => w.key);
    assert.ok(keys.includes("translation"), "Translation widget must be selected");
    assert.ok(!keys.includes("weather"), "Weather widget must NOT be selected");
  });

  it("should prioritize github repository widgets for developer queries", async () => {
    const route = getRouteForIntent("github_project");
    assert.equal(route.intent, "github_project");
    assert.deepEqual(route.mandatoryWidgets, ["repository"]);
    assert.ok(isWidgetForbidden("weather", "github_project"));
    assert.ok(isWidgetForbidden("translation", "github_project"));

    const candidates = await retrieveWidgets("torvalds linux github repository", {
      intent: "github_project",
      capabilities: ["git_clone", "software_info"]
    });

    const decision = deterministicReRankWidgets(
      "torvalds linux github repository",
      "github_project",
      "查看 Linux 开源代码库",
      candidates
    );

    const keys = decision.selectedWidgets.map(w => w.key);
    assert.ok(keys.includes("repository"), "Repository widget must be selected");
    assert.ok(!keys.includes("weather"));
    assert.ok(!keys.includes("translation"));
  });

  it("should prioritize troubleshooting widgets for error diagnosis queries", async () => {
    const route = getRouteForIntent("troubleshooting");
    assert.equal(route.intent, "troubleshooting");
    assert.deepEqual(route.mandatoryWidgets, ["troubleshooting"]);
    assert.ok(isWidgetForbidden("weather", "troubleshooting"));
    assert.ok(isWidgetForbidden("translation", "troubleshooting"));

    const candidates = await retrieveWidgets("npm install code 1 error 报错解决", {
      intent: "troubleshooting",
      capabilities: ["error_diagnosis", "fix_command"]
    });

    const decision = deterministicReRankWidgets(
      "npm install code 1 error 报错解决",
      "troubleshooting",
      "解决 npm install 报错",
      candidates
    );

    const keys = decision.selectedWidgets.map(w => w.key);
    assert.ok(keys.includes("troubleshooting"), "Troubleshooting widget must be selected");
    assert.ok(!keys.includes("weather"));
    assert.ok(!keys.includes("translation"));
  });
});
