import { ERROR_RISE_ISO, PRIMARY_SERVICE_ID, SERVICE_IDS } from "@/lib/constants";
import type { Span, TelemetryStatus } from "@/types";
import { createPrng, hexId } from "./prng";
import type { SeededTrace } from "./seeded-types";
import {
  DEMO_NOW_MS,
  NAMED_ERROR_TRACES,
  REPRESENTATIVE_DB_SPAN_ID,
  REPRESENTATIVE_ROOT_SPAN_ID,
  REPRESENTATIVE_TRACE_ID,
  SEED,
  SERIES_START_MS,
} from "./story";

const ERROR_RISE_MS = Date.parse(ERROR_RISE_ISO);

function span(
  spanId: string,
  operation: string,
  service: string,
  duration: number,
  status: TelemetryStatus,
  parentSpanId?: string,
): Span {
  return parentSpanId
    ? { spanId, parentSpanId, service, operation, duration, status }
    : { spanId, service, operation, duration, status };
}

function checkoutOkTrace(
  traceId: string,
  timestamp: string,
  rng: () => number,
): SeededTrace {
  const validate = 8 + Math.floor(rng() * 10);
  const inventory = 40 + Math.floor(rng() * 50);
  const payment = 90 + Math.floor(rng() * 80);
  const db = 28 + Math.floor(rng() * 40);
  const duration = validate + inventory + payment + db + 8 + Math.floor(rng() * 20);
  const rootId = hexId(rng, 6);
  return {
    traceId,
    timestamp,
    service: PRIMARY_SERVICE_ID,
    duration,
    status: "ok",
    spans: [
      span(rootId, "HTTP POST /checkout", PRIMARY_SERVICE_ID, duration, "ok"),
      span(hexId(rng, 6), "validate-cart", PRIMARY_SERVICE_ID, validate, "ok", rootId),
      span(hexId(rng, 6), "inventory.check", "inventory-service", inventory, "ok", rootId),
      span(hexId(rng, 6), "payment.authorize", "payment-service", payment, "ok", rootId),
      span(hexId(rng, 6), "db.query", PRIMARY_SERVICE_ID, db, "ok", rootId),
    ],
  };
}

function checkoutDbErrorTrace(
  traceId: string,
  timestamp: string,
  rng: () => number,
  fixed?: { duration: number; dbDuration: number; dbSpanId?: string; rootSpanId?: string },
): SeededTrace {
  const validate = fixed ? 12 : 8 + Math.floor(rng() * 10);
  const inventory = fixed ? 81 : 50 + Math.floor(rng() * 50);
  const payment = fixed ? 204 : 120 + Math.floor(rng() * 100);
  const db = fixed?.dbDuration ?? 2400 + Math.floor(rng() * 1200);
  const duration = fixed?.duration ?? db + validate + inventory + payment + 20 + Math.floor(rng() * 40);
  const rootId = fixed?.rootSpanId ?? hexId(rng, 6);
  const dbSpanId = fixed?.dbSpanId ?? hexId(rng, 6);
  return {
    traceId,
    timestamp,
    service: PRIMARY_SERVICE_ID,
    duration,
    status: "error",
    spans: [
      span(rootId, "HTTP POST /checkout", PRIMARY_SERVICE_ID, duration, "error"),
      span(hexId(rng, 6), "validate-cart", PRIMARY_SERVICE_ID, validate, "ok", rootId),
      span(hexId(rng, 6), "inventory.check", "inventory-service", inventory, "ok", rootId),
      span(hexId(rng, 6), "payment.authorize", "payment-service", payment, "ok", rootId),
      span(dbSpanId, "db.query", PRIMARY_SERVICE_ID, db, "error", rootId),
    ],
  };
}

function checkoutPaymentErrorTrace(
  traceId: string,
  timestamp: string,
  rng: () => number,
): SeededTrace {
  const validate = 10 + Math.floor(rng() * 8);
  const inventory = 60 + Math.floor(rng() * 30);
  const payment = 900 + Math.floor(rng() * 400);
  const db = 40 + Math.floor(rng() * 20);
  const duration = validate + inventory + payment + db + 15;
  const rootId = hexId(rng, 6);
  return {
    traceId,
    timestamp,
    service: PRIMARY_SERVICE_ID,
    duration,
    status: "error",
    spans: [
      span(rootId, "HTTP POST /checkout", PRIMARY_SERVICE_ID, duration, "error"),
      span(hexId(rng, 6), "validate-cart", PRIMARY_SERVICE_ID, validate, "ok", rootId),
      span(hexId(rng, 6), "inventory.check", "inventory-service", inventory, "ok", rootId),
      span(hexId(rng, 6), "payment.authorize", "payment-service", payment, "error", rootId),
      span(hexId(rng, 6), "db.query", PRIMARY_SERVICE_ID, db, "ok", rootId),
    ],
  };
}

function satelliteTrace(
  service: (typeof SERVICE_IDS)[number],
  traceId: string,
  timestamp: string,
  rng: () => number,
  forceError: boolean,
): SeededTrace {
  const status: TelemetryStatus = forceError ? "error" : "ok";
  const duration =
    service === "payment-service"
      ? 180 + Math.floor(rng() * 220)
      : 40 + Math.floor(rng() * 80);
  const rootId = hexId(rng, 6);
  const operation =
    service === "frontend"
      ? "GET /checkout"
      : service === "payment-service"
        ? "POST /authorize"
        : service === "inventory-service"
          ? "POST /reserve"
          : "GET /profile";

  const spans: Span[] = [
    span(rootId, operation, service, duration, status),
  ];
  if (service !== "frontend") {
    spans.push(
      span(
        hexId(rng, 6),
        "db.query",
        service,
        Math.max(12, Math.floor(duration * 0.35)),
        status === "error" && service === "inventory-service" ? "error" : "ok",
        rootId,
      ),
    );
  }

  return { traceId, timestamp, service, duration, status, spans };
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function buildTraces(): SeededTrace[] {
  const rng = createPrng(SEED ^ 0x7ace);
  const used = new Set<string>([
    REPRESENTATIVE_TRACE_ID,
    NAMED_ERROR_TRACES.secondary.traceId,
    NAMED_ERROR_TRACES.tertiary.traceId,
  ]);

  const uniqueId = (): string => {
    let id = hexId(rng, 8);
    while (used.has(id)) {
      id = hexId(rng, 8);
    }
    used.add(id);
    return id;
  };

  const traces: SeededTrace[] = [];

  const named = NAMED_ERROR_TRACES;
  traces.push(
    checkoutDbErrorTrace(named.representative.traceId, named.representative.timestamp, rng, {
      duration: named.representative.duration,
      dbDuration: named.representative.dbDuration,
      dbSpanId: REPRESENTATIVE_DB_SPAN_ID,
      rootSpanId: REPRESENTATIVE_ROOT_SPAN_ID,
    }),
  );
  traces.push(
    checkoutDbErrorTrace(named.secondary.traceId, named.secondary.timestamp, rng, {
      duration: named.secondary.duration,
      dbDuration: named.secondary.dbDuration,
    }),
  );
  traces.push(
    checkoutDbErrorTrace(named.tertiary.traceId, named.tertiary.timestamp, rng, {
      duration: named.tertiary.duration,
      dbDuration: named.tertiary.dbDuration,
    }),
  );

  const checkoutCount = 150;
  const spanMs = (DEMO_NOW_MS - SERIES_START_MS) / checkoutCount;
  let paymentDistractors = 0;

  for (let i = 0; i < checkoutCount; i += 1) {
    const ts = SERIES_START_MS + Math.floor(i * spanMs) + Math.floor(rng() * 8_000);
    if (ts > DEMO_NOW_MS) {
      continue;
    }
    const inIncident = ts >= ERROR_RISE_MS;
    const roll = rng();
    let trace: SeededTrace;
    if (inIncident && paymentDistractors < 2 && roll > 0.97) {
      paymentDistractors += 1;
      trace = checkoutPaymentErrorTrace(uniqueId(), iso(ts), rng);
    } else if (inIncident ? roll < 0.2 : roll < 0.012) {
      trace = checkoutDbErrorTrace(uniqueId(), iso(ts), rng);
    } else {
      trace = checkoutOkTrace(uniqueId(), iso(ts), rng);
    }
    traces.push(trace);
  }

  const others: Array<(typeof SERVICE_IDS)[number]> = [
    "frontend",
    "payment-service",
    "inventory-service",
    "user-service",
  ];
  for (const service of others) {
    const count = 12;
    for (let i = 0; i < count; i += 1) {
      const ts = SERIES_START_MS + Math.floor(rng() * (DEMO_NOW_MS - SERIES_START_MS));
      const forceError =
        service === "inventory-service" && i === 0
          ? true
          : service === "payment-service" && i === 0
            ? false
            : rng() < 0.04;
      traces.push(satelliteTrace(service, uniqueId(), iso(ts), rng, forceError));
    }
  }

  traces.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return traces;
}

export function dbErrorSpan(trace: SeededTrace): Span | undefined {
  return trace.spans.find((s) => s.operation === "db.query" && s.status === "error");
}

export function rootSpan(trace: SeededTrace): Span | undefined {
  return trace.spans.find((s) => s.parentSpanId === undefined);
}
