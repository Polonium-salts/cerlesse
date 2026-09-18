import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WidgetBoundary } from "../../../src/widgets/core/WidgetBoundary.js";

describe("WidgetBoundary Error Isolation", () => {
  it("should derive error state from thrown error", () => {
    const error = new Error("Simulated widget failure");
    const derivedState = WidgetBoundary.getDerivedStateFromError(error);
    assert.equal(derivedState.hasError, true);
    assert.equal(derivedState.error?.message, "Simulated widget failure");
  });
});
