import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  ROLLBACK_VERSION,
  TOOL_LATENCY_MS,
} from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { resolveApproval, clearApprovalWaiters } from "./approval";
import { resolveApproval as resolveApprovalFromUi } from "./controller";
import { executeIncidentTool, invokeIncidentTool } from "./invoke-tool";
import { COMPARE_WINDOW, QUERY_WINDOW } from "./windows";

async function flushTool(name: keyof typeof TOOL_LATENCY_MS, work: Promise<unknown>): Promise<void> {
  await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS[name]);
  await work;
}

beforeEach(() => {
  vi.useFakeTimers();
  useIncidentStore.getState().resetInvestigation();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearApprovalWaiters();
  useIncidentStore.getState().resetInvestigation();
});

describe("invokeIncidentTool", () => {
  it("records activity without ingesting when WebMCP is absent", async () => {
    const work = invokeIncidentTool("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    await flushTool("get_incident", work);
    const state = useIncidentStore.getState();
    expect(state.agent.activities.some((row) => row.tool === "get_incident" && row.status === "success")).toBe(
      true,
    );
    expect(state.agent.messages.some((row) => row.kind === "finding")).toBe(false);
  });

  it("goes through the registered WebMCP execute when modelContext exists", async () => {
    const registeredExecute = vi.fn(async (input: Record<string, unknown>, { signal }: { signal: AbortSignal }) => {
      return executeIncidentTool("get_incident", input, signal);
    });
    vi.stubGlobal("document", {
      modelContext: {
        async registerTool() {
          return undefined;
        },
        async getTools() {
          return [
            {
              name: "get_incident",
              description: "Retrieve incident",
              execute: registeredExecute,
            },
          ];
        },
        async executeTool() {
          return "";
        },
      },
    });

    const work = invokeIncidentTool("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    await flushTool("get_incident", work);
    expect(registeredExecute).toHaveBeenCalledOnce();
    expect(
      useIncidentStore.getState().agent.messages.some((row) => row.kind === "finding"),
    ).toBe(false);
  });

  it("falls back locally when the host has registerTool but not getTools", async () => {
    vi.stubGlobal("document", {
      modelContext: {
        async registerTool() {
          return undefined;
        },
      },
    });
    const work = invokeIncidentTool("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    await flushTool("get_incident", work);
    expect(
      useIncidentStore.getState().agent.activities.some(
        (row) => row.tool === "get_incident" && row.status === "success",
      ),
    ).toBe(true);
  });

  it("ingests evidence when ChatGPT calls the registered execute directly", async () => {
    const work = executeIncidentTool("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    await flushTool("get_incident", work);
    expect(useIncidentStore.getState().agent.messages.some((row) => row.kind === "finding")).toBe(
      true,
    );
  });

  it("waits for Approve on external propose_rollback, then returns the human decision", async () => {
    const work = executeIncidentTool("propose_rollback", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
      reason: "Database query regression in v2.31",
    });
    await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.propose_rollback);
    expect(useIncidentStore.getState().agent.activities.some((row) => row.tool === "propose_rollback" && row.status === "running")).toBe(
      true,
    );
    expect(useIncidentStore.getState().approval.approved).toBe(false);

    resolveApproval("approved");
    const result = await work;
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      status: "approved",
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(result.summary).toMatch(/Human approved rollback/i);
    expect(result.summary).not.toMatch(/call rollback_deployment/i);
    expect(result.data).not.toHaveProperty("nextTool");
    expect(useIncidentStore.getState().approval.approved).toBe(true);
  });

  it("does not wait for Approve when the in-app agent proposes a rollback", async () => {
    const work = invokeIncidentTool("propose_rollback", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
      reason: "Database query regression in v2.31",
    });
    await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.propose_rollback);
    const result = await work;
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ status: "pending_approval" });
    expect(useIncidentStore.getState().approval.approved).toBe(false);
    expect(useIncidentStore.getState().approval.pendingAction?.params.targetVersion).toBe(
      ROLLBACK_VERSION,
    );
  });

  it("returns pending_approval if the host aborts while waiting for Approve", async () => {
    const host = new AbortController();
    const work = executeIncidentTool(
      "propose_rollback",
      {
        service: PRIMARY_SERVICE_ID,
        targetVersion: ROLLBACK_VERSION,
        reason: "Database query regression in v2.31",
      },
      host.signal,
    );
    await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.propose_rollback);
    host.abort();
    const result = await work;
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ status: "pending_approval" });
    expect(useIncidentStore.getState().approval.approved).toBe(false);
    expect(useIncidentStore.getState().approval.pendingAction).toBeDefined();
  });

  it("opens rollback approval when ChatGPT ingest identifies the incident", async () => {
    const work = executeIncidentTool("compare_periods", {
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      ...COMPARE_WINDOW,
    });
    await flushTool("compare_periods", work);
    const state = useIncidentStore.getState();
    expect(state.incidentStatus).toBe("action_pending");
    expect(state.approval.pendingAction?.params.targetVersion).toBe(ROLLBACK_VERSION);
    expect(state.approval.approved).toBe(false);
  });

  it("does not auto-open approval during an in-app investigation", async () => {
    useIncidentStore.getState().setAgentStatus("investigating");
    const work = executeIncidentTool("compare_periods", {
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      ...COMPARE_WINDOW,
    });
    await flushTool("compare_periods", work);
    expect(useIncidentStore.getState().incidentStatus).toBe("identified");
    expect(useIncidentStore.getState().approval.pendingAction).toBeUndefined();
  });

  it("executes rollback when Approve has no in-app waiter", async () => {
    useIncidentStore.getState().setPendingAction({
      id: "rollback-checkout-v230",
      tool: "rollback_deployment",
      title: "Rollback checkout-api",
      reason: "Database query regression in v2.31",
      params: { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION },
    });
    resolveApprovalFromUi("approved");
    await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.rollback_deployment);
    expect(useIncidentStore.getState().telemetry.recoveryTriggered).toBe(true);
  });

  it("query_metrics focuses the matching chart in the workspace", async () => {
    const work = executeIncidentTool("query_metrics", {
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      ...QUERY_WINDOW,
    });
    await flushTool("query_metrics", work);
    const state = useIncidentStore.getState();
    expect(state.workspaceTab).toBe("metrics");
    expect(state.highlightedMetric).toBe("error_rate");
  });

  it("get_trace opens the representative trace", async () => {
    const work = executeIncidentTool("get_trace", { traceId: "8fd3c21a9b4d12ef" });
    await flushTool("get_trace", work);
    const state = useIncidentStore.getState();
    expect(state.workspaceTab).toBe("traces");
    expect(state.selectedTraceId).toBe("8fd3c21a9b4d12ef");
  });
});
