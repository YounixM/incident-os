import { ALERT_TRIGGERED_ISO, HTTP_500_SPIKE_ISO, PRIMARY_SERVICE_ID } from "@/lib/constants";
import type { LogEntry, LogLevel } from "@/types";
import { createPrng, hexId } from "./prng";
import type { SeededTrace } from "./seeded-types";
import { REPRESENTATIVE_DB_SPAN_ID, REPRESENTATIVE_TRACE_ID, SEED } from "./story";
import { dbErrorSpan, rootSpan } from "./traces";

function entry(
  timestamp: string,
  service: string,
  level: LogLevel,
  message: string,
  traceId?: string,
  spanId?: string,
): LogEntry {
  const row: LogEntry = { timestamp, service, level, message };
  if (traceId) {
    row.traceId = traceId;
  }
  if (spanId) {
    row.spanId = spanId;
  }
  return row;
}

function shiftIso(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export function buildLogs(traces: SeededTrace[]): LogEntry[] {
  const rng = createPrng(SEED ^ 0x1095);
  const logs: LogEntry[] = [];

  for (const trace of traces) {
    const root = rootSpan(trace);
    const dbErr = dbErrorSpan(trace);
    const rootId = root?.spanId;
    const t0 = trace.timestamp;

    if (trace.service !== PRIMARY_SERVICE_ID) {
      logs.push(
        entry(
          t0,
          trace.service,
          trace.status === "error" ? "ERROR" : "INFO",
          trace.status === "error"
            ? `${trace.spans[0]?.operation ?? "request"} failed duration=${trace.duration}ms`
            : `${trace.spans[0]?.operation ?? "request"} ok duration=${trace.duration}ms`,
          trace.traceId,
          rootId,
        ),
      );
      if (trace.status === "error") {
        logs.push(
          entry(shiftIso(t0, 4), trace.service, "ERROR", "upstream request failed", trace.traceId, rootId),
        );
      }
      continue;
    }

    if (trace.status === "ok") {
      logs.push(
        entry(
          t0,
          PRIMARY_SERVICE_ID,
          "INFO",
          `POST /checkout 200 in ${trace.duration}ms`,
          trace.traceId,
          rootId,
        ),
      );
      logs.push(
        entry(
          shiftIso(t0, 6),
          PRIMARY_SERVICE_ID,
          "INFO",
          `db.query completed in ${trace.spans.find((s) => s.operation === "db.query")?.duration ?? 0}ms`,
          trace.traceId,
          trace.spans.find((s) => s.operation === "db.query")?.spanId,
        ),
      );
      if (rng() < 0.25) {
        logs.push(
          entry(
            shiftIso(t0, 2),
            PRIMARY_SERVICE_ID,
            "INFO",
            "inventory.check ok",
            trace.traceId,
            trace.spans.find((s) => s.operation === "inventory.check")?.spanId,
          ),
        );
      }
      continue;
    }

    const failedOp = trace.spans.find((s) => s.status === "error");
    logs.push(
      entry(
        t0,
        PRIMARY_SERVICE_ID,
        "ERROR",
        `request failed trace_id=${trace.traceId} span_id=${failedOp?.spanId ?? rootId}`,
        trace.traceId,
        failedOp?.spanId ?? rootId,
      ),
    );

    if (dbErr) {
      logs.push(
        entry(
          shiftIso(t0, 3),
          PRIMARY_SERVICE_ID,
          "ERROR",
          "context deadline exceeded",
          trace.traceId,
          dbErr.spanId,
        ),
      );
      logs.push(
        entry(
          shiftIso(t0, 5),
          PRIMARY_SERVICE_ID,
          "ERROR",
          "database query exceeded 2s timeout",
          trace.traceId,
          dbErr.spanId,
        ),
      );
      logs.push(
        entry(
          shiftIso(t0, 8),
          PRIMARY_SERVICE_ID,
          "ERROR",
          `HTTP 500 POST /checkout duration=${trace.duration}ms`,
          trace.traceId,
          rootId,
        ),
      );
    } else {
      logs.push(
        entry(
          shiftIso(t0, 4),
          PRIMARY_SERVICE_ID,
          "ERROR",
          "payment.authorize declined or timed out",
          trace.traceId,
          failedOp?.spanId,
        ),
      );
      logs.push(
        entry(shiftIso(t0, 7), PRIMARY_SERVICE_ID, "WARN", "falling back to retry budget", trace.traceId, rootId),
      );
    }
  }

  logs.push(
    entry(
      HTTP_500_SPIKE_ISO,
      PRIMARY_SERVICE_ID,
      "ERROR",
      "HTTP 500 rate spike on POST /checkout",
    ),
  );
  logs.push(
    entry(
      ALERT_TRIGGERED_ISO,
      PRIMARY_SERVICE_ID,
      "ERROR",
      "Alert triggered: checkout-api error rate exceeded 5% threshold",
    ),
  );
  logs.push(
    entry(
      "2026-08-31T13:49:12.000Z",
      PRIMARY_SERVICE_ID,
      "WARN",
      "db.query p95 crossed 500ms (checkout_orders lookup)",
    ),
  );
  logs.push(
    entry(
      "2026-08-31T13:47:08.000Z",
      PRIMARY_SERVICE_ID,
      "WARN",
      "p95 latency rising on POST /checkout after v2.31",
    ),
  );

  const extraRng = createPrng(SEED ^ 0x51a7);
  const checkoutOk = traces.filter((t) => t.service === PRIMARY_SERVICE_ID && t.status === "ok");
  for (let i = 0; i < 120; i += 1) {
    const base = checkoutOk[i % checkoutOk.length];
    if (!base) {
      continue;
    }
    logs.push(
      entry(
        shiftIso(base.timestamp, 12 + Math.floor(extraRng() * 40)),
        PRIMARY_SERVICE_ID,
        extraRng() < 0.15 ? "WARN" : "INFO",
        extraRng() < 0.15
          ? "checkout session approaching idle budget"
          : `inventory.check cache ${extraRng() < 0.5 ? "hit" : "miss"} ${hexId(extraRng, 2)}`,
        base.traceId,
        base.spans.find((s) => s.operation === "inventory.check")?.spanId,
      ),
    );
  }

  const representative = traces.find((t) => t.traceId === REPRESENTATIVE_TRACE_ID);
  if (representative) {
    const already = logs.some(
      (l) => l.traceId === REPRESENTATIVE_TRACE_ID && l.message.includes("database query exceeded 2s timeout"),
    );
    if (!already) {
      logs.push(
        entry(
          representative.timestamp,
          PRIMARY_SERVICE_ID,
          "ERROR",
          "database query exceeded 2s timeout",
          REPRESENTATIVE_TRACE_ID,
          REPRESENTATIVE_DB_SPAN_ID,
        ),
      );
    }
  }

  logs.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return logs;
}
