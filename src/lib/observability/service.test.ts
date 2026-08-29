import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_NOW_ISO,
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  PRIMARY_VERSION,
  ROLLBACK_VERSION,
  TOOL_LATENCY_MS,
} from "@/lib/constants";
import { REPRESENTATIVE_TRACE_ID, SERIES_START_ISO } from "@/data";
import { observabilityService, withLatency } from "./service";
import { telemetryEngine } from "./engine";
import { TelemetryError } from "./errors";
import { useIncidentStore } from "@/lib/store/use-incident-store";

afterEach(() => {
  observabilityService.reset();
  useIncidentStore.getState().resetInvestigation();
});

describe("ObservabilityService queries", () => {
  it("returns the primary SEV-1 incident", async () => {
    const incident = await observabilityService.getIncident(PRIMARY_INCIDENT_ID);
    expect(incident.severity).toBe("SEV-1");
    expect(incident.service).toBe(PRIMARY_SERVICE_ID);
    expect(incident.status).toBe("investigating");
    expect(incident.errorRate).toBeCloseTo(18.4, 5);
  });

  it("throws structured NOT_FOUND for unknown incident, service, and trace ids", async () => {
    await expect(observabilityService.getIncident("nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
      name: "TelemetryError",
    });
    await expect(observabilityService.getService("auth-api")).rejects.toBeInstanceOf(TelemetryError);
    await expect(observabilityService.getTrace("deadbeef")).rejects.toMatchObject({
      details: { entity: "trace", id: "deadbeef" },
    });
  });

  it("filters traces by service, status, time range, and limit", async () => {
    const errors = await observabilityService.searchTraces({
      service: PRIMARY_SERVICE_ID,
      status: "error",
      startTime: "2026-08-31T13:50:00.000Z",
      endTime: DEMO_NOW_ISO,
      limit: 8,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.length).toBeLessThanOrEqual(8);
    for (const trace of errors) {
      expect(trace.service).toBe(PRIMARY_SERVICE_ID);
      expect(trace.status).toBe("error");
      const db = trace.spans.find((s) => s.operation === "db.query" && s.status === "error");
      const payment = trace.spans.find((s) => s.operation === "payment.authorize" && s.status === "error");
      expect(Boolean(db) || Boolean(payment)).toBe(true);
    }
  });

  it("error traces in the incident window are dominated by db.query failures", async () => {
    const errors = await observabilityService.searchTraces({
      service: PRIMARY_SERVICE_ID,
      status: "error",
      startTime: "2026-08-31T13:50:00.000Z",
      endTime: DEMO_NOW_ISO,
    });
    expect(errors.length).toBeGreaterThan(5);
    const dbErrors = errors.filter((t) =>
      t.spans.some((s) => s.operation === "db.query" && s.status === "error"),
    );
    expect(dbErrors.length / errors.length).toBeGreaterThan(0.8);
  });

  it("filters logs by query string and returns ERROR rows with trace ids", async () => {
    const logs = await observabilityService.searchLogs({
      service: PRIMARY_SERVICE_ID,
      query: "timeout",
      startTime: "2026-08-31T13:45:00.000Z",
      endTime: DEMO_NOW_ISO,
      limit: 40,
    });
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(log.level).toBe("ERROR");
      expect(log.message.toLowerCase()).toContain("timeout");
      expect(log.traceId).toBeTruthy();
      expect(log.spanId).toBeTruthy();
    }
  });

  it("deadline query correlates logs to traces", async () => {
    const logs = await observabilityService.searchLogs({
      service: PRIMARY_SERVICE_ID,
      query: "deadline",
      startTime: SERIES_START_ISO,
      endTime: DEMO_NOW_ISO,
    });
    expect(logs.length).toBeGreaterThan(0);
    const sample = logs[0];
    expect(sample).toBeDefined();
    if (!sample?.traceId) {
      throw new Error("expected correlated trace id");
    }
    const trace = await observabilityService.getTrace(sample.traceId);
    expect(trace.status).toBe("error");
    expect(trace.spans.some((s) => s.spanId === sample.spanId)).toBe(true);
  });

  it("filters deployments and places v2.31 at 13:45", async () => {
    const deploys = await observabilityService.getDeployments(PRIMARY_SERVICE_ID);
    expect(deploys[0]?.version).toBe(PRIMARY_VERSION);
    expect(deploys[0]?.timestamp).toBe("2026-08-31T13:45:00.000Z");
    expect(deploys[0]?.commit).toBe("a91f2c");
    expect(deploys[0]?.summary).toBe("Optimize checkout query");
    const v230 = deploys.find((d) => d.version === ROLLBACK_VERSION);
    expect(v230?.timestamp).toBe("2026-08-31T09:21:00.000Z");
    expect(v230?.commit).toBe("83af31");
    const limited = await observabilityService.getDeployments(PRIMARY_SERVICE_ID, 2);
    expect(limited).toHaveLength(2);
  });

  it("comparePeriods reports percentage change", async () => {
    const result = await observabilityService.comparePeriods({
      service: PRIMARY_SERVICE_ID,
      metric: "p95_latency",
      baselineStart: SERIES_START_ISO,
      baselineEnd: "2026-08-31T13:40:00.000Z",
      incidentStart: "2026-08-31T14:00:00.000Z",
      incidentEnd: DEMO_NOW_ISO,
    });
    expect(result.baselineAverage).toBeGreaterThan(350);
    expect(result.baselineAverage).toBeLessThan(500);
    expect(result.incidentAverage).toBeGreaterThan(2000);
    expect(result.percentageChange).toBeGreaterThan(400);
    expect(result.delta).toBeCloseTo(result.incidentAverage - result.baselineAverage, 8);
  });

  it("does not fabricate rows for empty windows — throws instead of NaN", async () => {
    await expect(
      observabilityService.comparePeriods({
        service: PRIMARY_SERVICE_ID,
        metric: "error_rate",
        baselineStart: "2026-08-30T00:00:00.000Z",
        baselineEnd: "2026-08-30T00:01:00.000Z",
        incidentStart: "2026-08-31T14:00:00.000Z",
        incidentEnd: DEMO_NOW_ISO,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("queryMetrics is not delayed internally", async () => {
    const started = Date.now();
    await observabilityService.queryMetrics({
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      startTime: SERIES_START_ISO,
      endTime: DEMO_NOW_ISO,
    });
    expect(Date.now() - started).toBeLessThan(50);
  });
});

describe("rollback and reset", () => {
  it("rollbackDeployment moves checkout-api toward healthy and incident toward remediating", async () => {
    const result = await observabilityService.rollbackDeployment({
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    expect(result.fromVersion).toBe(PRIMARY_VERSION);
    expect(result.toVersion).toBe(ROLLBACK_VERSION);
    expect(telemetryEngine.isRecoveryTriggered()).toBe(true);

    const incident = await observabilityService.getIncident(PRIMARY_INCIDENT_ID);
    expect(incident.status).toBe("remediating");
    expect(incident.errorRate).toBeCloseTo(1.1, 5);
    expect(incident.p95Latency).toBeCloseTo(430, 5);

    const service = await observabilityService.getService(PRIMARY_SERVICE_ID);
    expect(service.status).not.toBe("critical");
    expect(service.errorRate).toBeCloseTo(1.1, 5);

    const series = await observabilityService.queryMetrics({
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      startTime: "2026-08-31T14:28:00.000Z",
      endTime: DEMO_NOW_ISO,
    });
    const last = series.points.at(-1);
    expect(last?.value).toBeLessThan(4);
    expect(last?.value).toBeCloseTo(1.1, 0);
  });

  it("reset restores investigating state and incident telemetry", async () => {
    await observabilityService.rollbackDeployment({
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    observabilityService.reset();
    expect(telemetryEngine.isRecoveryTriggered()).toBe(false);
    const incident = await observabilityService.getIncident(PRIMARY_INCIDENT_ID);
    expect(incident.status).toBe("investigating");
    expect(incident.errorRate).toBeCloseTo(18.4, 5);
    const last = (
      await observabilityService.queryMetrics({
        service: PRIMARY_SERVICE_ID,
        metric: "p95_latency",
        startTime: "2026-08-31T14:20:00.000Z",
        endTime: DEMO_NOW_ISO,
      })
    ).points.at(-1);
    expect(last?.value).toBeGreaterThan(2000);
  });

  it("rejects rollback of unknown services or versions", async () => {
    await expect(
      observabilityService.rollbackDeployment({
        service: "user-service",
        targetVersion: ROLLBACK_VERSION,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ROLLBACK" });
    await expect(
      observabilityService.rollbackDeployment({
        service: PRIMARY_SERVICE_ID,
        targetVersion: "v9.99",
      }),
    ).rejects.toMatchObject({ code: "INVALID_ROLLBACK" });
  });
});

describe("store / engine coupling", () => {
  it("starts idle with PRIMARY_INCIDENT_ID and empty agent fields", () => {
    const state = useIncidentStore.getState();
    expect(state.selectedIncidentId).toBe(PRIMARY_INCIDENT_ID);
    expect(state.incidentStatus).toBe("investigating");
    expect(state.agent.status).toBe("idle");
    expect(state.agent.messages).toEqual([]);
    expect(state.agent.activities).toEqual([]);
    expect(state.agent.hypotheses).toEqual([]);
    expect(state.agent.evidence).toEqual([]);
    expect(state.agent.progressStep).toBe(0);
    expect(state.telemetry.recoveryTriggered).toBe(false);
  });

  it("triggerRecovery updates engine and store together", async () => {
    useIncidentStore.getState().triggerRecovery();
    expect(useIncidentStore.getState().telemetry.recoveryTriggered).toBe(true);
    expect(telemetryEngine.isRecoveryTriggered()).toBe(true);
    expect(useIncidentStore.getState().incidentStatus).toBe("remediating");
    const incident = await observabilityService.getIncident(PRIMARY_INCIDENT_ID);
    expect(incident.status).toBe("remediating");
  });

  it("resetInvestigation clears agent state and restores telemetry", async () => {
    const store = useIncidentStore.getState();
    store.addEvidence({
      id: "e1",
      type: "trace",
      title: "db span",
      summary: "db.query 91%",
      confidence: 0.92,
      reference: { type: "trace", id: REPRESENTATIVE_TRACE_ID },
    });
    store.setHypotheses([
      {
        id: "h1",
        title: "DB regression",
        confidence: 0.92,
        status: "active",
        evidenceIds: ["e1"],
      },
    ]);
    store.triggerRecovery();
    store.resetInvestigation();
    const reset = useIncidentStore.getState();
    expect(reset.agent.evidence).toEqual([]);
    expect(reset.agent.hypotheses).toEqual([]);
    expect(reset.telemetry.recoveryTriggered).toBe(false);
    expect(reset.incidentStatus).toBe("investigating");
    expect(telemetryEngine.isRecoveryTriggered()).toBe(false);
    const incident = await observabilityService.getIncident(PRIMARY_INCIDENT_ID);
    expect(incident.status).toBe("investigating");
  });

  it("approve/reject require a pending action", () => {
    const store = useIncidentStore.getState();
    store.approve();
    expect(store.incidentStatus).toBe("investigating");
    store.setPendingAction({
      id: "a1",
      tool: "rollback_deployment",
      title: "Rollback v2.31",
      reason: "DB query regression",
      params: { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION },
    });
    useIncidentStore.getState().approve();
    expect(useIncidentStore.getState().incidentStatus).toBe("action_pending");
    expect(useIncidentStore.getState().approval.approved).toBe(true);
    expect(useIncidentStore.getState().approval.pendingAction).toBeDefined();
    useIncidentStore.getState().reject();
    expect(useIncidentStore.getState().approval.pendingAction).toBeUndefined();
    expect(useIncidentStore.getState().incidentStatus).toBe("identified");
  });
});

describe("withLatency", () => {
  it("waits TOOL_LATENCY_MS then invokes the function", async () => {
    vi.useFakeTimers();
    const spy = vi.fn(() => 7);
    const pending = withLatency("get_incident", spy);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.get_incident);
    await expect(pending).resolves.toBe(7);
    vi.useRealTimers();
  });

  it("skips delay when fast telemetry is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_FAST_TELEMETRY", "1");
    const spy = vi.fn(() => 7);
    await expect(withLatency("get_incident", spy)).resolves.toBe(7);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});
