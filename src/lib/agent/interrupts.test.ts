import { describe, expect, it } from "vitest";
import { classifyRedirect, isTrafficPrompt } from "./redirect-kind";
import {
  clearInterrupts,
  peekInterrupt,
  queueInterrupt,
  takeInterrupt,
} from "./interrupts";

describe("interrupts", () => {
  it("queues, peeks, takes, and clears a prompt", () => {
    clearInterrupts();
    queueInterrupt("  investigate payment-service  ");
    expect(peekInterrupt()).toBe("investigate payment-service");
    expect(takeInterrupt()).toBe("investigate payment-service");
    expect(takeInterrupt()).toBeNull();
    queueInterrupt("again");
    clearInterrupts();
    expect(peekInterrupt()).toBeNull();
  });
});

describe("classifyRedirect", () => {
  it("detects payment, inventory, traffic, and generic prompts", () => {
    expect(classifyRedirect("investigate payment-service instead")).toBe("payment");
    expect(classifyRedirect("look at inventory")).toBe("inventory");
    expect(classifyRedirect("Could this just be a traffic spike?")).toBe("traffic");
    expect(classifyRedirect("what else could it be")).toBe("generic");
  });

  it("treats the traffic chip as a traffic prompt", () => {
    expect(isTrafficPrompt("Could this just be a traffic spike?")).toBe(true);
  });
});
