import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_NOW_ISO,
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  ROLLBACK_VERSION,
  TOOL_LATENCY_MS,
} from "@/lib/constants";
import { SERIES_START_ISO } from "@/data";
import { telemetryEngine } from "@/lib/observability/engine";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { ComparisonResult, Incident, ToolName, Trace } from "@/types";
import { incidentOsTools } from "./tools";
import type { ToolExecuteResult } from "./tools";

afterEach(() => {
  vi.useRealTimers();
  useIncidentStore.getState().resetInvestigation();
});

beforeEach(() => {
  vi.useFakeTimers();
});

async function execute(name: ToolName, input: unknown): Promise<ToolExecuteResult> {
  const pending = incidentOsTools[name].execute(input);
  await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS[name]);
  return pending;
}

describe("incidentOsTools", () => {
  it("get_incident returns checkout-api-error-rate story numbers", async () => {
    const result = await execute("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    const incident = result.data as Incident;
    expect(incident.id).toBe(PRIMARY_INCIDENT_ID);
    expect(incident.title).toBe("Checkout API — Elevated Error Rate");
    expect(incident.severity).toBe("SEV-1");
    expect(incident.service).toBe(PRIMARY_SERVICE_ID);
    expect(incident.status).toBe("investigating");
    expect(incident.errorRate).toBeCloseTo(18.4, 5);
    expect(incident.p95Latency).toBeCloseTo(2800, 5);
    expect(incident.requestRate).toBe(24_100);
    expect(incident.affectedUsersPercent).toBe(32);
    expect(result.summary).toMatch(/18\.4%/);
    expect(result.summary).toMatch(/2\.8s/);
  });

  it("search_traces error filter returns traces whose db span is error", async () => {
    const result = await execute("search_traces", {
      service: PRIMARY_SERVICE_ID,
      status: "error",
      startTime: "2026-08-31T13:50:00.000Z",
      endTime: DEMO_NOW_ISO,
    });
    expect(result.ok).toBe(true);
    const traces = result.data as Trace[];
    expect(traces.length).toBeGreaterThan(0);
    expect(result.summary).toMatch(/failed trace/i);
    for (const trace of traces) {
      expect(trace.status).toBe("error");
    }
    const withDbError = traces.filter((trace) =>
      trace.spans.some((span) => span.operation === "db.query" && span.status === "error"),
    );
    expect(withDbError.length).toBeGreaterThan(0);
    expect(withDbError.length / traces.length).toBeGreaterThan(0.8);
  });

  it("compare_periods shows large error_rate delta vs small request_rate delta", async () => {
    const window = {
      service: PRIMARY_SERVICE_ID,
      baselineStart: SERIES_START_ISO,
      baselineEnd: "2026-08-31T13:00:00.000Z",
      incidentStart: "2026-08-31T14:00:00.000Z",
      incidentEnd: DEMO_NOW_ISO,
    };
    const errorRate = await execute("compare_periods", { ...window, metric: "error_rate" });
    const requestRate = await execute("compare_periods", { ...window, metric: "request_rate" });
    expect(errorRate.ok).toBe(true);
    expect(requestRate.ok).toBe(true);
    const errorData = errorRate.data as ComparisonResult;
    const trafficData = requestRate.data as ComparisonResult;
    const errorRatio = errorData.incidentAverage / errorData.baselineAverage;
    expect(errorRatio).toBeGreaterThan(20);
    expect(errorRatio).toBeLessThan(28);
    expect(trafficData.percentageChange).toBeGreaterThan(12);
    expect(trafficData.percentageChange).toBeLessThan(25);
    expect(Math.abs(errorData.percentageChange)).toBeGreaterThan(Math.abs(trafficData.percentageChange));
    expect(errorRate.summary).toMatch(/increased/i);
    expect(errorRate.summary).toMatch(/×/);
  });

  it("rollback without approval fails and does not recover", async () => {
    const result = await execute("rollback_deployment", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      code: "APPROVAL_REQUIRED",
      message: `rollback_deployment is not approved for ${PRIMARY_SERVICE_ID} → ${ROLLBACK_VERSION}`,
    });
    expect(useIncidentStore.getState().telemetry.recoveryTriggered).toBe(false);
    expect(useIncidentStore.getState().incidentStatus).toBe("investigating");
    expect(telemetryEngine.isRecoveryTriggered()).toBe(false);
  });

  it("rollback succeeds after pendingAction and approve(), then recoveryTriggered is true", async () => {
    const store = useIncidentStore.getState();
    store.setPendingAction({
      id: "rollback-checkout-v230",
      tool: "rollback_deployment",
      title: "Rollback checkout-api to v2.30",
      reason: "Database query regression in v2.31",
      params: { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION },
    });
    store.approve();

    const result = await execute("rollback_deployment", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(useIncidentStore.getState().telemetry.recoveryTriggered).toBe(true);
    expect(telemetryEngine.isRecoveryTriggered()).toBe(true);
    expect(useIncidentStore.getState().approval.pendingAction).toBeUndefined();
    expect(useIncidentStore.getState().incidentStatus).toBe("remediating");
    expect(result.summary).toMatch(/v2\.31/);
    expect(result.summary).toMatch(/v2\.30/);
  });

  it("reset via store.resetInvestigation restores investigating", async () => {
    const store = useIncidentStore.getState();
    store.setPendingAction({
      id: "rollback-checkout-v230",
      tool: "rollback_deployment",
      title: "Rollback checkout-api to v2.30",
      reason: "Database query regression in v2.31",
      params: { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION },
    });
    store.approve();
    const rolled = await execute("rollback_deployment", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(rolled.ok).toBe(true);
    expect(useIncidentStore.getState().incidentStatus).toBe("remediating");

    useIncidentStore.getState().resetInvestigation();
    const reset = useIncidentStore.getState();
    expect(reset.incidentStatus).toBe("investigating");
    expect(reset.telemetry.recoveryTriggered).toBe(false);
    expect(reset.approval.pendingAction).toBeUndefined();
    expect(telemetryEngine.isRecoveryTriggered()).toBe(false);

    const incident = await execute("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    expect((incident.data as Incident).status).toBe("investigating");
    expect((incident.data as Incident).errorRate).toBeCloseTo(18.4, 5);
  });

  it("does not fabricate rows for unknown incidents", async () => {
    const result = await execute("get_incident", { incidentId: "not-a-real-incident" });
    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("pendingAction for a different version does not approve rollback", async () => {
    useIncidentStore.getState().setPendingAction({
      id: "rollback-other",
      tool: "rollback_deployment",
      title: "Rollback",
      reason: "test",
      params: { service: PRIMARY_SERVICE_ID, targetVersion: "v2.29" },
    });
    useIncidentStore.getState().approve();
    const result = await execute("rollback_deployment", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("APPROVAL_REQUIRED");
    expect(telemetryEngine.isRecoveryTriggered()).toBe(false);
  });

  it("propose_rollback opens approval and still cannot rollback until approved", async () => {
    const proposed = await execute("propose_rollback", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
      reason: "Database query regression in v2.31",
    });
    expect(proposed.ok).toBe(true);
    expect(useIncidentStore.getState().approval.pendingAction?.params.targetVersion).toBe(
      ROLLBACK_VERSION,
    );
    expect(useIncidentStore.getState().approval.approved).toBe(false);
    expect(useIncidentStore.getState().incidentStatus).toBe("action_pending");

    const blocked = await execute("rollback_deployment", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("APPROVAL_REQUIRED");

    useIncidentStore.getState().approve();
    const rolled = await execute("rollback_deployment", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(rolled.ok).toBe(true);
    expect(useIncidentStore.getState().telemetry.recoveryTriggered).toBe(true);
  });

  it("get_incident exposes rollback approval so a host can poll after Approve", async () => {
    await execute("propose_rollback", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
      reason: "Database query regression in v2.31",
    });
    const pending = await execute("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    expect(pending.data).toMatchObject({
      id: PRIMARY_INCIDENT_ID,
      approval: {
        pending: true,
        approved: false,
        service: PRIMARY_SERVICE_ID,
        targetVersion: ROLLBACK_VERSION,
      },
    });

    useIncidentStore.getState().approve();
    const approved = await execute("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    expect(approved.data).toMatchObject({
      approval: {
        pending: true,
        approved: true,
        service: PRIMARY_SERVICE_ID,
        targetVersion: ROLLBACK_VERSION,
      },
    });
    expect(approved.summary).toMatch(/is approved/i);
    expect(approved.summary).not.toMatch(/call rollback_deployment/i);
    expect((approved.data as { approval: Record<string, unknown> }).approval).not.toHaveProperty(
      "next",
    );
  });

  it("tool descriptions do not instruct calling other tools", () => {
    const tools = Object.values(incidentOsTools);
    const names = tools.map((tool) => tool.name);
    for (const tool of tools) {
      for (const other of names) {
        if (other === tool.name) {
          continue;
        }
        expect(tool.description).not.toMatch(new RegExp(`\\b${other}\\b`));
      }
      expect(tool.description).not.toMatch(/\bimmediately\b/i);
    }
    expect(incidentOsTools.get_incident.readOnly).toBe(true);
    expect(incidentOsTools.search_logs.untrustedContent).toBe(true);
    expect(incidentOsTools.rollback_deployment.readOnly).toBe(false);
  });
});
