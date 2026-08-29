import {
  BASELINE,
  DB_LATENCY_RISE_ISO,
  ERROR_RISE_ISO,
  HTTP_500_SPIKE_ISO,
  INCIDENT_PEAK,
  LATENCY_RISE_ISO,
  PRIMARY_SERVICE_ID,
  RECOVERY,
  SERVICE_IDS,
} from "@/lib/constants";
import type { MetricName, MetricPoint } from "@/types";
import { clamp, keyedNoise, lerp, roundTo, smoothstep } from "./prng";
import {
  CHECKOUT_PEAK_HOLD_ISO,
  DEMO_NOW_MS,
  METRIC_INTERVAL_MS,
  RECOVERY_WINDOW_MS,
  REQUEST_RAMP_END_ISO,
  REQUEST_RAMP_START_ISO,
  SERIES_START_MS,
} from "./story";

const PEAK_HOLD_MS = Date.parse(CHECKOUT_PEAK_HOLD_ISO);
const LATENCY_RISE_MS = Date.parse(LATENCY_RISE_ISO);
const DB_LATENCY_RISE_MS = Date.parse(DB_LATENCY_RISE_ISO);
const ERROR_RISE_MS = Date.parse(ERROR_RISE_ISO);
const HTTP_500_SPIKE_MS = Date.parse(HTTP_500_SPIKE_ISO);
const REQUEST_RAMP_START_MS = Date.parse(REQUEST_RAMP_START_ISO);
const REQUEST_RAMP_END_MS = Date.parse(REQUEST_RAMP_END_ISO);

interface ServiceMetricProfile {
  errorRate: number;
  requestRate: number;
  p50: number;
  p95: number;
  p99: number;
  dbLatency: number;
}

const HEALTHY: Record<(typeof SERVICE_IDS)[number], ServiceMetricProfile> = {
  frontend: {
    errorRate: 0.2,
    requestRate: 18_400,
    p50: 40,
    p95: 90,
    p99: 180,
    dbLatency: 0,
  },
  "checkout-api": {
    errorRate: BASELINE.errorRate,
    requestRate: BASELINE.requestRatePerMin,
    p50: 180,
    p95: BASELINE.p95LatencyMs,
    p99: 780,
    dbLatency: 45,
  },
  "payment-service": {
    errorRate: 0.4,
    requestRate: 8_200,
    p50: 140,
    p95: 380,
    p99: 620,
    dbLatency: 28,
  },
  "inventory-service": {
    errorRate: 0.35,
    requestRate: 12_400,
    p50: 55,
    p95: 140,
    p99: 260,
    dbLatency: 22,
  },
  "user-service": {
    errorRate: 0.15,
    requestRate: 15_100,
    p50: 28,
    p95: 70,
    p99: 140,
    dbLatency: 18,
  },
};

const CHECKOUT_INCIDENT = {
  errorRate: INCIDENT_PEAK.errorRate,
  requestRate: INCIDENT_PEAK.requestRatePerMin,
  p50: 920,
  p95: INCIDENT_PEAK.p95LatencyMs,
  p99: 4_200,
  dbLatency: 3_490,
} as const;

function ramp(ts: number, start: number, end: number): number {
  if (ts <= start) {
    return 0;
  }
  if (ts >= end) {
    return 1;
  }
  return (ts - start) / (end - start);
}

function checkoutErrorProgress(ts: number): number {
  if (ts < ERROR_RISE_MS) {
    return 0;
  }
  if (ts < HTTP_500_SPIKE_MS) {
    return 0.28 * ramp(ts, ERROR_RISE_MS, HTTP_500_SPIKE_MS);
  }
  if (ts < PEAK_HOLD_MS) {
    return 0.28 + 0.72 * ramp(ts, HTTP_500_SPIKE_MS, PEAK_HOLD_MS);
  }
  return 1;
}

function checkoutLatencyProgress(ts: number): number {
  return smoothstep(ramp(ts, LATENCY_RISE_MS, PEAK_HOLD_MS));
}

function checkoutDbProgress(ts: number): number {
  return smoothstep(ramp(ts, DB_LATENCY_RISE_MS, PEAK_HOLD_MS));
}

function checkoutRequestRate(ts: number, noise: number): number {
  const t = ramp(ts, REQUEST_RAMP_START_MS, REQUEST_RAMP_END_MS);
  const value = lerp(BASELINE.requestRatePerMin, INCIDENT_PEAK.requestRatePerMin, t);
  return clamp(value + noise * 220, 18_000, 26_000);
}

function inventoryErrorRate(ts: number, noise: number): number {
  const noon = Date.parse("2026-08-31T12:00:00.000Z");
  const recovered = Date.parse("2026-08-31T13:10:00.000Z");
  const decaying = lerp(2.4, 0.35, ramp(ts, noon, recovered));
  return clamp(decaying + noise * 0.12, 0.05, 8);
}

function paymentP95(ts: number, noise: number): number {
  const wobble = 18 * Math.sin((ts - SERIES_START_MS) / (18 * 60 * 1000));
  return clamp(380 + wobble + noise * 16, 300, 480);
}

function blend(
  healthy: number,
  incident: number,
  progress: number,
  noise: number,
  noiseScale: number,
): number {
  const value = lerp(healthy, incident, progress);
  return value + noise * noiseScale;
}

export function computeMetricValue(
  service: string,
  metric: MetricName,
  timestampMs: number,
  recoveryTriggered: boolean,
): number {
  const profile = HEALTHY[service as (typeof SERVICE_IDS)[number]];
  if (!profile) {
    throw new Error(`unknown service for metrics: ${service}`);
  }

  const noise = keyedNoise(service, metric, timestampMs);
  let value: number;

  if (service === PRIMARY_SERVICE_ID) {
    value = computeCheckoutMetric(metric, timestampMs, noise, profile);
  } else {
    value = computeHealthyMetric(service, metric, timestampMs, noise, profile);
  }

  if (recoveryTriggered && service === PRIMARY_SERVICE_ID) {
    value = applyRecovery(metric, timestampMs, value);
  }

  return sanitizeMetric(metric, value);
}

function computeCheckoutMetric(
  metric: MetricName,
  ts: number,
  noise: number,
  healthy: ServiceMetricProfile,
): number {
  switch (metric) {
    case "error_rate":
      return clamp(
        blend(
          healthy.errorRate,
          CHECKOUT_INCIDENT.errorRate,
          checkoutErrorProgress(ts),
          noise,
          checkoutErrorProgress(ts) > 0.4 ? 0.35 : 0.1,
        ),
        0,
        100,
      );
    case "request_rate":
      return checkoutRequestRate(ts, noise);
    case "p50_latency":
      return clamp(
        blend(healthy.p50, CHECKOUT_INCIDENT.p50, checkoutLatencyProgress(ts), noise, 18),
        80,
        2_000,
      );
    case "p95_latency":
      return clamp(
        blend(healthy.p95, CHECKOUT_INCIDENT.p95, checkoutLatencyProgress(ts), noise, 28),
        200,
        5_000,
      );
    case "p99_latency":
      return clamp(
        blend(healthy.p99, CHECKOUT_INCIDENT.p99, checkoutLatencyProgress(ts), noise, 40),
        400,
        8_000,
      );
    case "db_latency":
      return clamp(
        blend(healthy.dbLatency, CHECKOUT_INCIDENT.dbLatency, checkoutDbProgress(ts), noise, 22),
        10,
        6_000,
      );
    default: {
      const _exhaustive: never = metric;
      throw new Error(`unhandled metric: ${_exhaustive}`);
    }
  }
}

function computeHealthyMetric(
  service: string,
  metric: MetricName,
  ts: number,
  noise: number,
  healthy: ServiceMetricProfile,
): number {
  switch (metric) {
    case "error_rate":
      if (service === "inventory-service") {
        return inventoryErrorRate(ts, noise);
      }
      return clamp(healthy.errorRate + noise * 0.08, 0.02, 1.5);
    case "request_rate":
      return clamp(healthy.requestRate + noise * 180, healthy.requestRate * 0.9, healthy.requestRate * 1.1);
    case "p50_latency":
      return clamp(healthy.p50 + noise * 8, healthy.p50 * 0.7, healthy.p50 * 1.4);
    case "p95_latency":
      if (service === "payment-service") {
        return paymentP95(ts, noise);
      }
      return clamp(healthy.p95 + noise * 12, healthy.p95 * 0.75, healthy.p95 * 1.35);
    case "p99_latency":
      return clamp(healthy.p99 + noise * 18, healthy.p99 * 0.75, healthy.p99 * 1.4);
    case "db_latency":
      return clamp(healthy.dbLatency + noise * 4, 0, healthy.dbLatency * 2 + 8);
    default: {
      const _exhaustive: never = metric;
      throw new Error(`unhandled metric: ${_exhaustive}`);
    }
  }
}

function recoveryTarget(metric: MetricName): number | null {
  switch (metric) {
    case "error_rate":
      return RECOVERY.errorRate;
    case "p50_latency":
      return 185;
    case "p95_latency":
      return RECOVERY.p95LatencyMs;
    case "p99_latency":
      return 800;
    case "db_latency":
      return 48;
    case "request_rate":
      return null;
    default: {
      const _exhaustive: never = metric;
      throw new Error(`unhandled metric: ${_exhaustive}`);
    }
  }
}

function applyRecovery(metric: MetricName, timestampMs: number, incidentValue: number): number {
  const target = recoveryTarget(metric);
  if (target === null) {
    return incidentValue;
  }
  const start = DEMO_NOW_MS - RECOVERY_WINDOW_MS;
  if (timestampMs < start) {
    return incidentValue;
  }
  const progress = smoothstep((timestampMs - start) / RECOVERY_WINDOW_MS);
  return lerp(incidentValue, target, progress);
}

function sanitizeMetric(metric: MetricName, value: number): number {
  switch (metric) {
    case "error_rate":
      return roundTo(value, 3);
    case "request_rate":
      return roundTo(value, 1);
    case "p50_latency":
    case "p95_latency":
    case "p99_latency":
    case "db_latency":
      return roundTo(value, 1);
    default: {
      const _exhaustive: never = metric;
      throw new Error(`unhandled metric: ${_exhaustive}`);
    }
  }
}

export function metricUnit(metric: MetricName): string {
  switch (metric) {
    case "error_rate":
      return "percent";
    case "request_rate":
      return "per_minute";
    case "p50_latency":
    case "p95_latency":
    case "p99_latency":
    case "db_latency":
      return "milliseconds";
    default: {
      const _exhaustive: never = metric;
      throw new Error(`unhandled metric: ${_exhaustive}`);
    }
  }
}

export function metricTimestamps(): number[] {
  const out: number[] = [];
  for (let t = SERIES_START_MS; t <= DEMO_NOW_MS; t += METRIC_INTERVAL_MS) {
    out.push(t);
  }
  return out;
}

export function buildMetricSeries(
  service: string,
  metric: MetricName,
  startTime: string,
  endTime: string,
  recoveryTriggered: boolean,
): MetricPoint[] {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("invalid metric time range");
  }
  return metricTimestamps()
    .filter((t) => t >= start && t <= end)
    .map((t) => ({
      timestamp: new Date(t).toISOString(),
      value: computeMetricValue(service, metric, t, recoveryTriggered),
    }));
}

export function averageMetric(
  service: string,
  metric: MetricName,
  startTime: string,
  endTime: string,
  recoveryTriggered: boolean,
): number {
  const points = buildMetricSeries(service, metric, startTime, endTime, recoveryTriggered);
  if (points.length === 0) {
    return Number.NaN;
  }
  const sum = points.reduce((acc, point) => acc + point.value, 0);
  return sum / points.length;
}

export const METRIC_NAMES: MetricName[] = [
  "error_rate",
  "request_rate",
  "p50_latency",
  "p95_latency",
  "p99_latency",
  "db_latency",
];
