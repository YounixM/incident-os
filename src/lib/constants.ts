/** Frozen demo clock. All synthetic timestamps are ISO-8601 UTC. Format displays in UTC. */
export const DEMO_NOW_ISO = "2026-08-31T14:32:00.000Z";

export const DEPLOY_V231_ISO = "2026-08-31T13:45:00.000Z";
export const LATENCY_RISE_ISO = "2026-08-31T13:47:00.000Z";
export const DB_LATENCY_RISE_ISO = "2026-08-31T13:49:00.000Z";
export const ERROR_RISE_ISO = "2026-08-31T13:50:00.000Z";
export const HTTP_500_SPIKE_ISO = "2026-08-31T13:52:00.000Z";
export const ALERT_TRIGGERED_ISO = "2026-08-31T13:53:00.000Z";
export const INCIDENT_OPENED_ISO = "2026-08-31T13:55:00.000Z";

export const PRIMARY_INCIDENT_ID = "checkout-api-error-rate";
export const PRIMARY_SERVICE_ID = "checkout-api";
export const PRIMARY_VERSION = "v2.31";
export const ROLLBACK_VERSION = "v2.30";

export const BASELINE = {
  errorRate: 0.8,
  p95LatencyMs: 420,
  requestRatePerMin: 20_000,
} as const;

export const INCIDENT_PEAK = {
  errorRate: 18.4,
  p95LatencyMs: 2800,
  requestRatePerMin: 24_100,
  affectedUsersPercent: 32,
} as const;

export const RECOVERY = {
  errorRate: 1.1,
  p95LatencyMs: 430,
} as const;

export const TOOL_LATENCY_MS = {
  get_investigation_context: 200,
  get_incident: 300,
  get_service: 350,
  query_metrics: 600,
  search_traces: 900,
  get_trace: 700,
  search_logs: 600,
  get_deployments: 400,
  compare_periods: 800,
  propose_rollback: 250,
  rollback_deployment: 1200,
  add_incident_note: 250,
} as const;

/** Simulated environment label returned by get_investigation_context. */
export const DEMO_ENVIRONMENT = "production";

export const SERVICE_IDS = [
  "frontend",
  "checkout-api",
  "payment-service",
  "inventory-service",
  "user-service",
] as const;
