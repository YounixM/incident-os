import { afterEach, describe, expect, it } from "vitest";
import { isForceDemo } from "./fast-telemetry";

const originalForceDemo = process.env.NEXT_PUBLIC_FORCE_DEMO;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalForceDemo === undefined) {
    delete process.env.NEXT_PUBLIC_FORCE_DEMO;
  } else {
    process.env.NEXT_PUBLIC_FORCE_DEMO = originalForceDemo;
  }
  if (originalVercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnv;
  }
});

describe("isForceDemo", () => {
  it("is true when NEXT_PUBLIC_FORCE_DEMO is 1", () => {
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_FORCE_DEMO = "1";
    expect(isForceDemo()).toBe(true);
  });

  it("is true on Vercel production unless explicitly disabled", () => {
    delete process.env.NEXT_PUBLIC_FORCE_DEMO;
    process.env.VERCEL_ENV = "production";
    expect(isForceDemo()).toBe(true);
  });

  it("respects NEXT_PUBLIC_FORCE_DEMO=0 on Vercel production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_FORCE_DEMO = "0";
    expect(isForceDemo()).toBe(false);
  });
});
