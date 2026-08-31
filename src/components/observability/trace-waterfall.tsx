"use client";

import { REPRESENTATIVE_DB_SPAN_ID } from "@/data/story";
import { formatSpanDuration } from "@/components/observability/format";
import { telemetryLabel } from "@/components/observability/status";
import { cn } from "@/lib/utils";
import type { Span, Trace } from "@/types";

interface LaidOutSpan {
  span: Span;
  start: number;
  depth: number;
}

function layoutSpans(spans: Span[]): LaidOutSpan[] {
  const children = new Map<string, Span[]>();
  const roots: Span[] = [];

  for (const span of spans) {
    if (!span.parentSpanId) {
      roots.push(span);
      continue;
    }
    const siblings = children.get(span.parentSpanId) ?? [];
    siblings.push(span);
    children.set(span.parentSpanId, siblings);
  }

  const laid: LaidOutSpan[] = [];

  function walk(span: Span, start: number, depth: number) {
    laid.push({ span, start, depth });
    const kids = children.get(span.spanId) ?? [];
    let offset = start;
    for (const child of kids) {
      walk(child, offset, depth + 1);
      offset += child.duration;
    }
  }

  let rootStart = 0;
  for (const root of roots) {
    walk(root, rootStart, 0);
    rootStart += root.duration;
  }

  return laid;
}

export function TraceWaterfall({ trace }: { trace: Trace }) {
  const laid = layoutSpans(trace.spans);
  const total = Math.max(trace.duration, 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[12px]">{trace.service}</p>
        <p className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {formatSpanDuration(trace.duration)}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {laid.map(({ span, start, depth }) => {
          const isDbError =
            span.spanId === REPRESENTATIVE_DB_SPAN_ID ||
            (span.operation === "db.query" && span.status === "error");
          const width = Math.max((span.duration / total) * 100, 1.5);
          const left = Math.min((start / total) * 100, 98);
          return (
            <li
              key={span.spanId}
              className={cn(
                "rounded-sm border px-2 py-1.5",
                isDbError
                  ? "border-status-critical/50 bg-status-critical/10"
                  : span.status === "error"
                    ? "border-status-critical/30 bg-status-critical/5"
                    : "border-border bg-muted/20",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p
                  className="truncate font-mono text-[11px]"
                  style={{ paddingLeft: depth * 12 }}
                >
                  {span.operation}
                  {isDbError ? (
                    <span className="ml-2 font-sans text-[10px] font-medium text-status-critical">
                      {" "}
                      ERROR
                    </span>
                  ) : null}
                </p>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatSpanDuration(span.duration)}
                </span>
              </div>
              <div
                className="relative h-1.5 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "absolute inset-y-0 rounded-full",
                    isDbError || span.status === "error"
                      ? "bg-status-critical"
                      : "bg-status-info",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {span.service}
                {" · "}
                {telemetryLabel(span.status)}
                {" · "}
                {span.spanId}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
