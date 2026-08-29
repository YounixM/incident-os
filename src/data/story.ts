import {
  DEMO_NOW_ISO,
  DEPLOY_V231_ISO,
  PRIMARY_SERVICE_ID,
} from "@/lib/constants";

/** Metric series start — ~2.5h of history before DEMO_NOW. */
export const SERIES_START_ISO = "2026-08-31T12:00:00.000Z";
export const METRIC_INTERVAL_MS = 30_000;
export const RECOVERY_WINDOW_MS = 8 * 60 * 1000;

export const V230_DEPLOY_ISO = "2026-08-31T09:21:00.000Z";

export const REPRESENTATIVE_TRACE_ID = "8fd3c21a9b4d12ef";
export const REPRESENTATIVE_ROOT_SPAN_ID = "8fd3c21a0001";
export const REPRESENTATIVE_DB_SPAN_ID = "93ab4e21f006c8";
export const REPRESENTATIVE_TRACE_ISO = "2026-08-31T13:53:42.921Z";

export const NAMED_ERROR_TRACES = {
  representative: {
    traceId: REPRESENTATIVE_TRACE_ID,
    timestamp: REPRESENTATIVE_TRACE_ISO,
    duration: 3820,
    dbDuration: 3490,
    validateCart: 12,
    inventoryCheck: 81,
    paymentAuthorize: 204,
    dbSpanId: REPRESENTATIVE_DB_SPAN_ID,
    rootSpanId: REPRESENTATIVE_ROOT_SPAN_ID,
  },
  secondary: {
    traceId: "9a31d42c18e07b55",
    timestamp: "2026-08-31T13:54:18.440Z",
    duration: 3410,
    dbDuration: 3120,
  },
  tertiary: {
    traceId: "bc73d11e90aa44c2",
    timestamp: "2026-08-31T13:56:07.118Z",
    duration: 2980,
    dbDuration: 2710,
  },
} as const;

export const PAYMENT_INCIDENT_ID = "payment-service-latency";
export const INVENTORY_INCIDENT_ID = "inventory-api-5xx";

export const SEED = 20260831;

export const SERIES_START_MS = Date.parse(SERIES_START_ISO);
export const DEMO_NOW_MS = Date.parse(DEMO_NOW_ISO);
export const DEPLOY_V231_MS = Date.parse(DEPLOY_V231_ISO);

export const CHECKOUT_PEAK_HOLD_ISO = "2026-08-31T13:58:00.000Z";
export const REQUEST_RAMP_START_ISO = "2026-08-31T13:00:00.000Z";
export const REQUEST_RAMP_END_ISO = "2026-08-31T13:40:00.000Z";

export function isPrimaryService(service: string): boolean {
  return service === PRIMARY_SERVICE_ID;
}
