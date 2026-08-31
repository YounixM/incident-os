"use client";

import { useMemo, useState, type ReactNode } from "react";
import { NAMED_ERROR_TRACES, REPRESENTATIVE_TRACE_ID } from "@/data/story";
import { PRIMARY_INCIDENT_ID, PRIMARY_SERVICE_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  formatSpanDuration,
  formatUtcHms,
  truncateId,
} from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { telemetryLabel, telemetryTone } from "@/components/observability/status";
import { TraceWaterfall } from "@/components/observability/trace-waterfall";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { StatusDot } from "@/components/layout/status-indicator";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";
import type { Trace } from "@/types";

const WINDOW = 40;

type StatusFilter = "all" | "error" | "ok";

export function TracesPanel({ incidentId }: { incidentId: string }) {
  const snapshot = useTelemetrySnapshot();
  const incident = snapshot.incidents.find((row) => row.id === incidentId);
  const selectedTraceId = useIncidentStore((s) => s.selectedTraceId);
  const selectTrace = useIncidentStore((s) => s.selectTrace);
  const [filter, setFilter] = useState<StatusFilter>(
    incidentId === PRIMARY_INCIDENT_ID ? "error" : "all",
  );
  const [visible, setVisible] = useState(WINDOW);

  const service = incident?.service ?? PRIMARY_SERVICE_ID;

  const traces = useMemo(() => {
    const pinned = new Set<string>([
      NAMED_ERROR_TRACES.representative.traceId,
      NAMED_ERROR_TRACES.secondary.traceId,
      NAMED_ERROR_TRACES.tertiary.traceId,
    ]);
    const rows = snapshot.traces
      .filter((trace) => trace.service === service)
      .filter((trace) => matchesStatusFilter(trace.status, filter))
      .slice()
      .sort((a, b) => {
        const aPin = pinned.has(a.traceId) ? 0 : 1;
        const bPin = pinned.has(b.traceId) ? 0 : 1;
        if (aPin !== bPin) {
          return aPin - bPin;
        }
        if (a.traceId === REPRESENTATIVE_TRACE_ID) {
          return -1;
        }
        if (b.traceId === REPRESENTATIVE_TRACE_ID) {
          return 1;
        }
        return Date.parse(b.timestamp) - Date.parse(a.timestamp);
      });
    return rows;
  }, [snapshot.traces, service, filter]);

  const selected =
    traces.find((trace) => trace.traceId === selectedTraceId) ??
    snapshot.traces.find((trace) => trace.traceId === selectedTraceId);

  if (!incident) {
    return (
      <EmptyState
        title="No matching traces"
        description="Incident is not in the telemetry snapshot."
      />
    );
  }

  if (traces.length === 0 && !selected) {
    return (
      <EmptyState
        title="No matching traces"
        description="Try expanding the status filter or choosing another service."
      />
    );
  }

  const windowed = traces.slice(0, visible);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Trace status filter">
          <FilterChip current={filter} value="error" onSelect={setFilter}>
            ERROR
          </FilterChip>
          <FilterChip current={filter} value="ok" onSelect={setFilter}>
            OK
          </FilterChip>
          <FilterChip current={filter} value="all" onSelect={setFilter}>
            All
          </FilterChip>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          showing {windowed.length} of {traces.length}
        </p>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-background text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 font-medium">Trace ID</th>
              <th className="px-2 py-1.5 font-medium">Time</th>
              <th className="px-2 py-1.5 font-medium">Duration</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {windowed.map((trace) => (
              <TraceRow
                key={trace.traceId}
                trace={trace}
                selected={trace.traceId === selectedTraceId}
                onSelect={() => selectTrace(trace.traceId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {visible < traces.length ? (
        <Button type="button" size="xs" variant="outline" onClick={() => setVisible((n) => n + WINDOW)}>
          Show more traces
        </Button>
      ) : null}

      {selected ? (
        <div id="trace-detail" className="rounded-md border border-border p-2">
          <p className="mb-2 font-mono text-[11px] text-muted-foreground">
            {selected.traceId}
          </p>
          <TraceWaterfall trace={selected} />
        </div>
      ) : incident.id === PRIMARY_INCIDENT_ID ? (
        <p className="text-[11px] text-muted-foreground">
          Select a trace to open the waterfall. Representative failed trace is{" "}
          <button
            type="button"
            className="font-mono text-foreground underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => {
              setFilter("error");
              selectTrace(REPRESENTATIVE_TRACE_ID);
            }}
          >
            {REPRESENTATIVE_TRACE_ID}
          </button>
          .
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Select a trace to open the waterfall.</p>
      )}
    </div>
  );
}

function TraceRow({
  trace,
  selected,
  onSelect,
}: {
  trace: Trace;
  selected: boolean;
  onSelect: () => void;
}) {
  const representative = trace.traceId === REPRESENTATIVE_TRACE_ID;
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        selected ? "bg-muted/60" : "hover:bg-muted/40",
      )}
    >
      <td className="px-2 py-1.5">
        <button
          type="button"
          data-trace-id={trace.traceId}
          onClick={onSelect}
          aria-current={selected ? "true" : undefined}
          className="font-mono text-[12px] hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {truncateId(trace.traceId, 12)}
          {representative ? (
            <span className="ml-1.5 font-sans text-[10px] text-muted-foreground">
              representative
            </span>
          ) : null}
        </button>
      </td>
      <td className="px-2 py-1.5 font-mono tabular-nums text-muted-foreground">
        {formatUtcHms(trace.timestamp)}
      </td>
      <td className="px-2 py-1.5 font-mono tabular-nums">
        {formatSpanDuration(trace.duration)}
      </td>
      <td className="px-2 py-1.5">
        <StatusDot tone={telemetryTone(trace.status)} label={telemetryLabel(trace.status)} />
      </td>
    </tr>
  );
}

function matchesStatusFilter(status: Trace["status"], filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "error":
      return status === "error";
    case "ok":
      return status === "ok";
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

function FilterChip({
  current,
  value,
  onSelect,
  children,
}: {
  current: StatusFilter;
  value: StatusFilter;
  onSelect: (value: StatusFilter) => void;
  children: ReactNode;
}) {
  const active = current === value;
  return (
    <Button
      type="button"
      size="xs"
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      onClick={() => onSelect(value)}
    >
      {children}
    </Button>
  );
}
