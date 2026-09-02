import { describe, expect, it } from "vitest";
import type { AgentActivity, ToolName } from "@/types";
import { activitySignal, activitySignalLabel } from "./activity-signal";

function activity(tool: ToolName, summary: string, status: AgentActivity["status"] = "success"): AgentActivity {
  return {
    id: "act-1",
    timestamp: "2026-08-31T14:32:00.000Z",
    tool,
    status,
    summary,
  };
}

describe("activitySignal", () => {
  it("marks running as info and failed tools as critical", () => {
    expect(activitySignal(activity("query_metrics", "Querying metrics", "running"))).toBe("info");
    expect(activitySignal(activity("search_logs", "Tool failed", "error"))).toBe("critical");
    expect(activitySignalLabel("info", "running")).toBe("In progress");
    expect(activitySignalLabel("critical", "error")).toBe("Tool failed");
  });

  it("treats error and latency spikes as incident findings, not success", () => {
    expect(activitySignal(activity("compare_periods", "DB latency increased 75.2×"))).toBe("critical");
    expect(activitySignal(activity("compare_periods", "p95 latency increased 6.6×"))).toBe("critical");
    expect(activitySignal(activity("query_metrics", "DB latency increased 88.7×"))).toBe("critical");
    expect(activitySignal(activity("query_metrics", "Error rate increased 22.6×"))).toBe("critical");
    expect(activitySignal(activity("search_traces", "Found 10 failed traces"))).toBe("critical");
    expect(
      activitySignal(
        activity("get_trace", "Trace 8fd3c21a9b4d12ef failed: HTTP POST /checkout is 100% of duration"),
      ),
    ).toBe("critical");
    expect(activitySignal(activity("search_logs", 'Found 5 logs matching "timeout"'))).toBe("critical");
    expect(activitySignalLabel("critical", "success")).toBe("Incident finding");
  });

  it("keeps traffic and generic reads as observations", () => {
    expect(activitySignal(activity("search_logs", "Found 100 logs"))).toBe("info");
    expect(activitySignal(activity("search_logs", 'Found 30 logs matching "query"'))).toBe("info");
    expect(activitySignal(activity("compare_periods", "Request rate increased 8.1%"))).toBe("info");
    expect(activitySignal(activity("search_logs", 'Found 1 log matching "checkout_orders"'))).toBe("info");
  });

  it("marks rollback and recovered metrics as healthy", () => {
    expect(activitySignal(activity("rollback_deployment", "Rolled back checkout-api from v2.31 to v2.30"))).toBe(
      "healthy",
    );
    expect(activitySignal(activity("query_metrics", "Error rate decreased 16.7×"))).toBe("healthy");
    expect(activitySignal(activity("query_metrics", "p95 latency decreased 2.3%"))).toBe("info");
    expect(
      activitySignal(
        activity(
          "get_deployments",
          "Active checkout-api version is v2.30 after rollback from v2.31. Latest forward deploy remains v2.31 (Optimize checkout query) at 13:45.",
        ),
      ),
    ).toBe("healthy");
  });

  it("marks the correlated v2.31 deploy as a warning", () => {
    expect(
      activitySignal(
        activity(
          "get_deployments",
          "Active checkout-api version is v2.31 (Optimize checkout query). Latest forward deploy is v2.31 at 13:45.",
        ),
      ),
    ).toBe("warning");
    expect(activitySignal(activity("propose_rollback", "Waiting for human approval"))).toBe("warning");
  });
});
