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
import { observabilityService } from "@/lib/observability/service";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { ComparisonResult, Incident, ToolName } from "@/types";
import { incidentOsTools } from "./tools";
import type { CompactMetricResult, DeploymentsToolData, ToolExecuteResult } from "./tools";

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
    const payload = result.data as { count: number; traces: { traceId: string; status: string }[] };
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.traces.length).toBeGreaterThan(0);
    expect(payload.traces.length).toBeLessThanOrEqual(12);
    expect(result.summary).toMatch(/failed trace/i);
    for (const trace of payload.traces) {
      expect(trace.status).toBe("error");
    }
    const full = await observabilityService.searchTraces({
      service: PRIMARY_SERVICE_ID,
      status: "error",
      startTime: "2026-08-31T13:50:00.000Z",
      endTime: DEMO_NOW_ISO,
    });
    const withDbError = full.filter((trace) =>
      trace.spans.some((span) => span.operation === "db.query" && span.status === "error"),
    );
    expect(withDbError.length).toBeGreaterThan(0);
    expect(withDbError.length / full.length).toBeGreaterThan(0.8);
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
      retryable: false,
      suggestion: "A matching approved pending action is required before this mutation.",
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
    const incident = await execute("get_incident", { incidentId: PRIMARY_INCIDENT_ID });
    expect(incident.ok).toBe(true);
    expect(incident.summary).toMatch(/is remediating/);
    expect(incident.summary).toMatch(/1\.1%/);
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

  it("get_deployments reports active v2.31 before rollback and v2.30 after", async () => {
    const before = await execute("get_deployments", { service: PRIMARY_SERVICE_ID });
    expect(before.ok).toBe(true);
    expect(before.summary).toMatch(/Active checkout-api version is v2\.31/);
    expect(before.summary).not.toMatch(/Latest checkout-api deploy is v2\.31/);
    const beforeData = before.data as DeploymentsToolData;
    expect(beforeData.activeVersion).toBe("v2.31");
    expect(beforeData.lastTransition.type).toBe("deploy");
    expect(beforeData.deployments[0]?.version).toBe("v2.31");

    useIncidentStore.getState().setPendingAction({
      id: "rollback-checkout-v230",
      tool: "rollback_deployment",
      title: "Rollback checkout-api to v2.30",
      reason: "Database query regression in v2.31",
      params: { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION },
    });
    useIncidentStore.getState().approve();
    await execute("rollback_deployment", {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });

    const after = await execute("get_deployments", { service: PRIMARY_SERVICE_ID });
    expect(after.ok).toBe(true);
    expect(after.summary).toMatch(/Active checkout-api version is v2\.30 after rollback from v2\.31/);
    expect(after.summary).toMatch(/Latest forward deploy remains v2\.31/);
    const afterData = after.data as DeploymentsToolData;
    expect(afterData.activeVersion).toBe("v2.30");
    expect(afterData.lastTransition).toEqual(
      expect.objectContaining({
        type: "rollback",
        fromVersion: "v2.31",
        toVersion: "v2.30",
      }),
    );
    expect(afterData.deployments[0]?.summary).toMatch(/Rollback v2\.31 to v2\.30/);
    expect(afterData.deployments.some((row) => row.version === "v2.31")).toBe(true);
  });

  it("get_investigation_context returns page state without requiring an incident id", async () => {
    const result = await execute("get_investigation_context", {});
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      incidentId: PRIMARY_INCIDENT_ID,
      service: PRIMARY_SERVICE_ID,
      environment: "production",
      clock: DEMO_NOW_ISO,
      timeRange: { start: SERIES_START_ISO, end: DEMO_NOW_ISO },
    });
    const tools = (result.data as { availableTools: string[] }).availableTools;
    expect(tools).toContain("get_investigation_context");
    expect(tools).toContain("query_metrics");
    expect(tools).toContain("propose_rollback");
  });

  it("query_metrics returns compact stats instead of the full series", async () => {
    const result = await execute("query_metrics", {
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      startTime: SERIES_START_ISO,
      endTime: DEMO_NOW_ISO,
    });
    expect(result.ok).toBe(true);
    const data = result.data as CompactMetricResult;
    expect(data.stats.max).toBeGreaterThan(15);
    expect(data.stats.last).toBeGreaterThan(15);
    expect(data.stats.changeFactor).toBeGreaterThan(20);
    expect(data.sample.length).toBeGreaterThan(0);
    expect(data.sample.length).toBeLessThanOrEqual(8);
  });

  it("unknown ids return structured non-retryable errors", async () => {
    const result = await execute("get_incident", { incidentId: "not-a-real-incident" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      retryable: false,
      suggestion: "Confirm the identifier exists on the current page.",
    });
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
