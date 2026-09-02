import { describe, expect, it } from "vitest";
import {
  resolveWorkspaceScrollTarget,
  shouldScrollToWorkspaceTarget,
} from "@/components/observability/use-evidence-navigation";

describe("workspace evidence scrolling", () => {
  it("does not scroll on the initial target, including Strict Mode remounts", () => {
    expect(shouldScrollToWorkspaceTarget(null, "overview")).toBe(false);
    expect(shouldScrollToWorkspaceTarget("overview", "overview")).toBe(false);
  });

  it("scrolls only when the resolved target changes after mount", () => {
    expect(shouldScrollToWorkspaceTarget("overview", "metrics")).toBe(true);
    expect(shouldScrollToWorkspaceTarget("metrics", "metric-error_rate")).toBe(true);
  });

  it("keeps overview on the KPI block and traces on the selected row when focused", () => {
    expect(
      resolveWorkspaceScrollTarget({
        workspaceTab: "overview",
        selectedTraceId: null,
        highlightedMetric: null,
        highlightedDeploymentId: null,
      }),
    ).toBe("overview");
    expect(
      resolveWorkspaceScrollTarget({
        workspaceTab: "traces",
        selectedTraceId: "abc",
        highlightedMetric: null,
        highlightedDeploymentId: null,
      }),
    ).toBe("trace-detail");
  });
});
