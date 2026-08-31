import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIMARY_INCIDENT_ID } from "@/lib/constants";
import { telemetryEngine } from "@/lib/observability/engine";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { runDemoInvestigation } from "./demo-investigation";
import { resetActiveInvestigation } from "./controller";
import { queueInterrupt, clearInterrupts } from "./interrupts";

async function flushUntil(done: Promise<void>): Promise<void> {
  let settled = false;
  const tracked = done.finally(() => {
    settled = true;
  });
  let spins = 0;
  while (!settled) {
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    spins += 1;
    if (spins > 400) {
      throw new Error("Demo did not settle");
    }
  }
  await tracked;
}

beforeEach(() => {
  vi.useFakeTimers();
  useIncidentStore.getState().resetInvestigation();
});

afterEach(() => {
  resetActiveInvestigation();
  clearInterrupts();
  vi.useRealTimers();
  useIncidentStore.getState().resetInvestigation();
});

describe("runDemoInvestigation", () => {
  it("runs the scripted path with tools and recovers after auto-approve", async () => {
    const run = runDemoInvestigation({
      instant: true,
      autoChallenge: true,
      autoApprove: true,
    });
    await flushUntil(run);

    const state = useIncidentStore.getState();
    const tools = state.agent.activities.map((activity) => activity.tool);
    expect(tools).toContain("get_incident");
    expect(tools).toContain("get_service");
    expect(tools).toContain("query_metrics");
    expect(tools).toContain("get_deployments");
    expect(tools).toContain("search_traces");
    expect(tools).toContain("get_trace");
    expect(tools).toContain("search_logs");
    expect(tools).toContain("compare_periods");
    expect(tools).toContain("propose_rollback");
    expect(tools).toContain("add_incident_note");
    expect(tools).toContain("rollback_deployment");
    expect(
      state.agent.activities.every(
        (activity) => activity.status === "success" || activity.status === "running",
      ),
    ).toBe(true);
    expect(state.agent.activities.some((activity) => activity.tool === "rollback_deployment" && activity.status === "success")).toBe(true);
    expect(state.telemetry.recoveryTriggered).toBe(true);
    expect(telemetryEngine.isRecoveryTriggered()).toBe(true);
    expect(state.agent.hypotheses.map((row) => row.title)).toContain("Database query regression");
    expect(state.agent.hypotheses.find((row) => row.id === "hyp-db-regression")?.status).toBe(
      "confirmed",
    );
    expect(state.agent.hypotheses.find((row) => row.id === "hyp-traffic-spike")?.status).toBe(
      "rejected",
    );
    expect(state.agent.hypotheses.find((row) => row.id === "hyp-payment-latency")?.status).toBe(
      "rejected",
    );
    expect(state.incidentStatus).toBe("resolved");
    expect(state.agent.status).toBe("complete");
  });

  it("does not execute rollback before approve", async () => {
    let sawPending = false;
    const run = runDemoInvestigation({
      instant: true,
      autoChallenge: true,
      waitForApproval: async () => {
        sawPending = true;
        const state = useIncidentStore.getState();
        expect(state.approval.pendingAction?.tool).toBe("rollback_deployment");
        expect(state.approval.approved).toBe(false);
        expect(state.telemetry.recoveryTriggered).toBe(false);
        expect(
          state.agent.activities.some(
            (activity) => activity.tool === "rollback_deployment" && activity.status === "success",
          ),
        ).toBe(false);
        useIncidentStore.getState().approve();
        return "approved";
      },
    });
    await flushUntil(run);
    expect(sawPending).toBe(true);
    expect(useIncidentStore.getState().telemetry.recoveryTriggered).toBe(true);
  });

  it("reset restores idle investigating state", async () => {
    const ac = new AbortController();
    const run = runDemoInvestigation({
      signal: ac.signal,
      instant: true,
      autoChallenge: true,
      autoApprove: true,
    });
    await vi.advanceTimersByTimeAsync(800);
    ac.abort();
    useIncidentStore.getState().resetInvestigation();
    await flushUntil(run);

    const state = useIncidentStore.getState();
    expect(state.agent.status).toBe("idle");
    expect(state.incidentStatus).toBe("investigating");
    expect(state.agent.hypotheses).toEqual([]);
    expect(state.agent.evidence).toEqual([]);
    expect(state.agent.activities).toEqual([]);
    expect(state.telemetry.recoveryTriggered).toBe(false);
    expect(telemetryEngine.isRecoveryTriggered()).toBe(false);
    expect(state.selectedIncidentId).toBe(PRIMARY_INCIDENT_ID);
  });

  it("follows a payment redirect mid-run then still recovers", async () => {
    queueInterrupt("investigate payment-service instead");
    const run = runDemoInvestigation({
      instant: true,
      autoChallenge: true,
      autoApprove: true,
    });
    await flushUntil(run);

    const state = useIncidentStore.getState();
    const paymentActivity = state.agent.activities.some((activity) =>
      /payment-service/i.test(activity.summary),
    );
    const paymentFinding = state.agent.messages.some((message) =>
      /payment-service/i.test(message.text),
    );
    expect(paymentActivity || paymentFinding).toBe(true);
    expect(state.incidentStatus).toBe("resolved");
    expect(state.agent.activities.some((activity) => activity.tool === "rollback_deployment")).toBe(
      true,
    );
  });
});
