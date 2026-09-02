import { describe, expect, it } from "vitest";
import type { AgentActivity, ToolName } from "@/types";
import { visibleActivities } from "./activity-timeline";

function activity(
  tool: ToolName,
  summary: string,
  status: AgentActivity["status"] = "success",
): AgentActivity {
  return {
    id: `act-${tool}-${summary}`,
    timestamp: "2026-08-31T14:32:00.000Z",
    tool,
    status,
    summary,
  };
}

describe("visibleActivities", () => {
  it("keeps the recent investigation trail before rollback", () => {
    const rows = [
      activity("get_service", "checkout-api is critical (error rate 18.4%)"),
      activity("search_traces", "Found 5 failed traces"),
    ];
    expect(visibleActivities(rows)).toEqual(rows);
  });

  it("after rollback shows only the close, not later verification calls", () => {
    const rollback = activity("rollback_deployment", "Rolled back checkout-api from v2.31 to v2.30");
    const rows = [
      activity("get_service", "checkout-api is critical (error rate 18.4%)"),
      rollback,
      activity("search_traces", "Found 5 failed traces"),
      activity("get_incident", "SEV-1 checkout-api: error rate 1.1%, p95 430ms"),
      activity("get_incident", "Incident resolved"),
    ];
    expect(visibleActivities(rows)).toEqual([
      rollback,
      activity("get_incident", "Incident resolved"),
    ]);
  });
});
