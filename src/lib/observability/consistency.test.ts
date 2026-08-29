import { afterEach, describe, expect, it } from "vitest";
import {
  ALERT_TRIGGERED_ISO,
  BASELINE,
  DB_LATENCY_RISE_ISO,
  DEMO_NOW_ISO,
  DEPLOY_V231_ISO,
  ERROR_RISE_ISO,
  HTTP_500_SPIKE_ISO,
  INCIDENT_PEAK,
  LATENCY_RISE_ISO,
  PRIMARY_SERVICE_ID,
  SERVICE_IDS,
} from "@/lib/constants";
import {
  REPRESENTATIVE_DB_SPAN_ID,
  REPRESENTATIVE_TRACE_ID,
  SERIES_START_ISO,
  TELEMETRY_SEED,
} from "@/data";
import { observabilityService } from "./service";
import { useIncidentStore } from "@/lib/store/use-incident-store";

afterEach(() => {
  observabilityService.reset();
  useIncidentStore.getState().resetInvestigation();
});

async function avg(
  metric: "error_rate" | "request_rate" | "p50_latency" | "p95_latency" | "p99_latency" | "db_latency",
  start: string,
  end: string,
): Promise<number> {
  const result = await observabilityService.comparePeriods({
    service: PRIMARY_SERVICE_ID,
    metric,
    baselineStart: start,
    baselineEnd: end,
    incidentStart: start,
    incidentEnd: end,
  });
  return result.baselineAverage;
}

describe("dataset volume and topology", () => {
  it("includes five services and the checkout dependency graph", () => {
    const ids = TELEMETRY_SEED.services.map((s) => s.id);
    expect(ids).toEqual([...SERVICE_IDS]);
    const frontend = TELEMETRY_SEED.services.find((s) => s.id === "frontend");
    const checkout = TELEMETRY_SEED.services.find((s) => s.id === PRIMARY_SERVICE_ID);
    expect(frontend?.dependencies).toEqual(["checkout-api"]);
    expect(checkout?.dependencies).toEqual(["payment-service", "inventory-service", "user-service"]);
    expect(checkout?.status).toBe("critical");
    expect(TELEMETRY_SEED.services.find((s) => s.id === "user-service")?.status).toBe("healthy");
  });

  it("meets dataset minimums", () => {
    expect(TELEMETRY_SEED.deployments.length).toBeGreaterThanOrEqual(20);
    expect(TELEMETRY_SEED.traces.length).toBeGreaterThanOrEqual(100);
    expect(TELEMETRY_SEED.logs.length).toBeGreaterThanOrEqual(500);
    expect(TELEMETRY_SEED.incidents).toHaveLength(3);
  });
});

describe("story correlation", () => {
  it("does not degrade metrics before the v2.31 deploy", async () => {
    const preError = await avg("error_rate", SERIES_START_ISO, DEPLOY_V231_ISO);
    const preP95 = await avg("p95_latency", SERIES_START_ISO, DEPLOY_V231_ISO);
    const preDb = await avg("db_latency", SERIES_START_ISO, DEPLOY_V231_ISO);
    expect(preError).toBeGreaterThan(0.4);
    expect(preError).toBeLessThan(1.3);
    expect(preP95).toBeGreaterThan(350);
    expect(preP95).toBeLessThan(500);
    expect(preDb).toBeLessThan(120);
  });

  it("inflects p95 after 13:47, db latency after 13:49, errors after 13:50", async () => {
    const p95BeforeRise = await avg("p95_latency", SERIES_START_ISO, LATENCY_RISE_ISO);
    const p95After = await avg("p95_latency", "2026-08-31T14:00:00.000Z", DEMO_NOW_ISO);
    expect(p95BeforeRise).toBeLessThan(500);
    expect(p95After).toBeGreaterThan(2000);

    const dbBefore = await avg("db_latency", SERIES_START_ISO, DB_LATENCY_RISE_ISO);
    const dbAfter = await avg("db_latency", "2026-08-31T14:00:00.000Z", DEMO_NOW_ISO);
    expect(dbBefore).toBeLessThan(120);
    expect(dbAfter).toBeGreaterThan(2000);

    const errBefore = await avg("error_rate", SERIES_START_ISO, ERROR_RISE_ISO);
    const errAfterSpike = await avg("error_rate", HTTP_500_SPIKE_ISO, DEMO_NOW_ISO);
    expect(errBefore).toBeLessThan(1.5);
    expect(errAfterSpike).toBeGreaterThan(10);
  });

  it("request_rate increase cannot explain the error_rate increase", async () => {
    const comparisonError = await observabilityService.comparePeriods({
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      baselineStart: SERIES_START_ISO,
      baselineEnd: "2026-08-31T13:00:00.000Z",
      incidentStart: "2026-08-31T14:00:00.000Z",
      incidentEnd: DEMO_NOW_ISO,
    });
    const comparisonTraffic = await observabilityService.comparePeriods({
      service: PRIMARY_SERVICE_ID,
      metric: "request_rate",
      baselineStart: SERIES_START_ISO,
      baselineEnd: "2026-08-31T13:00:00.000Z",
      incidentStart: "2026-08-31T14:00:00.000Z",
      incidentEnd: DEMO_NOW_ISO,
    });

    const trafficPct = comparisonTraffic.percentageChange;
    const errorRatio = comparisonError.incidentAverage / comparisonError.baselineAverage;

    expect(trafficPct).toBeGreaterThan(12);
    expect(trafficPct).toBeLessThan(25);
    expect(errorRatio).toBeGreaterThan(20);
    expect(errorRatio).toBeLessThan(28);
    expect(comparisonError.incidentAverage).toBeGreaterThan(15);
    expect(comparisonTraffic.incidentAverage).toBeGreaterThan(23_000);
    expect(comparisonTraffic.baselineAverage).toBeCloseTo(BASELINE.requestRatePerMin, -2);
    expect(comparisonError.baselineAverage).toBeCloseTo(BASELINE.errorRate, 0);
  });

  it("representative error trace encodes the db.query regression", async () => {
    const trace = await observabilityService.getTrace(REPRESENTATIVE_TRACE_ID);
    expect(trace.duration).toBe(3820);
    expect(trace.status).toBe("error");
    const validate = trace.spans.find((s) => s.operation === "validate-cart");
    const inventory = trace.spans.find((s) => s.operation === "inventory.check");
    const payment = trace.spans.find((s) => s.operation === "payment.authorize");
    const db = trace.spans.find((s) => s.operation === "db.query");
    expect(validate?.duration).toBe(12);
    expect(validate?.status).toBe("ok");
    expect(inventory?.duration).toBe(81);
    expect(inventory?.status).toBe("ok");
    expect(payment?.duration).toBe(204);
    expect(payment?.status).toBe("ok");
    expect(db?.duration).toBe(3490);
    expect(db?.status).toBe("error");
    expect(db?.spanId).toBe(REPRESENTATIVE_DB_SPAN_ID);
    expect(db!.duration / trace.duration).toBeGreaterThan(0.9);
    expect(db!.duration / trace.duration).toBeLessThan(0.93);
  });

  it("accepts the PRD truncated trace id prefix when unique", async () => {
    const trace = await observabilityService.getTrace("8fd3c21");
    expect(trace.traceId).toBe(REPRESENTATIVE_TRACE_ID);
  });

  it("timeout logs for the representative trace share its span id", async () => {
    const logs = await observabilityService.searchLogs({
      service: PRIMARY_SERVICE_ID,
      query: "database query exceeded 2s timeout",
      startTime: "2026-08-31T13:53:00.000Z",
      endTime: "2026-08-31T13:54:00.000Z",
      traceId: REPRESENTATIVE_TRACE_ID,
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((l) => l.level === "ERROR")).toBe(true);
    expect(logs.some((l) => l.spanId === REPRESENTATIVE_DB_SPAN_ID)).toBe(true);
  });

  it("other services stay healthy while checkout-api is degraded", async () => {
    const checkoutErrors = await observabilityService.queryMetrics({
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      startTime: "2026-08-31T14:00:00.000Z",
      endTime: DEMO_NOW_ISO,
    });
    const userErrors = await observabilityService.queryMetrics({
      service: "user-service",
      metric: "error_rate",
      startTime: "2026-08-31T14:00:00.000Z",
      endTime: DEMO_NOW_ISO,
    });
    const checkoutPeak = Math.max(...checkoutErrors.points.map((p) => p.value));
    const userPeak = Math.max(...userErrors.points.map((p) => p.value));
    expect(checkoutPeak).toBeGreaterThan(15);
    expect(userPeak).toBeLessThan(1);
  });

  it("request rate stays near 24k during the incident — not a traffic-spike story", async () => {
    const rates = await observabilityService.queryMetrics({
      service: PRIMARY_SERVICE_ID,
      metric: "request_rate",
      startTime: "2026-08-31T13:50:00.000Z",
      endTime: DEMO_NOW_ISO,
    });
    const values = rates.points.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(23_000);
    expect(mean).toBeLessThan(25_000);
    expect(mean).toBeCloseTo(INCIDENT_PEAK.requestRatePerMin, -2);
  });

  it("story timestamps are internally ordered", () => {
    const times = [
      Date.parse(DEPLOY_V231_ISO),
      Date.parse(LATENCY_RISE_ISO),
      Date.parse(DB_LATENCY_RISE_ISO),
      Date.parse(ERROR_RISE_ISO),
      Date.parse(HTTP_500_SPIKE_ISO),
      Date.parse(ALERT_TRIGGERED_ISO),
    ];
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]!);
    }
  });

  it("emits several hundred metric points per series", async () => {
    const series = await observabilityService.queryMetrics({
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      startTime: SERIES_START_ISO,
      endTime: DEMO_NOW_ISO,
    });
    expect(series.points.length).toBeGreaterThanOrEqual(200);
    expect(series.unit).toBe("percent");
  });
});
