"use client";

import { useMemo, useState } from "react";
import { PRIMARY_INCIDENT_ID, PRIMARY_SERVICE_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUtcHmsMs } from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { logLevelTone } from "@/components/observability/status";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { StatusDot } from "@/components/layout/status-indicator";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";
import type { LogEntry, LogLevel } from "@/types";

const WINDOW = 80;
const ROW_H = 28;

type LevelFilter = "all" | LogLevel;

export function LogsPanel({ incidentId }: { incidentId: string }) {
  const snapshot = useTelemetrySnapshot();
  const incident = snapshot.incidents.find((row) => row.id === incidentId);
  const selectedLogTraceId = useIncidentStore((s) => s.selectedLogTraceId);
  const selectTrace = useIncidentStore((s) => s.selectTrace);
  const selectLogTrace = useIncidentStore((s) => s.selectLogTrace);
  const setTab = useIncidentStore((s) => s.setTab);
  const [level, setLevel] = useState<LevelFilter>(
    incidentId === PRIMARY_INCIDENT_ID ? "ERROR" : "all",
  );
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);

  const service = incident?.service ?? PRIMARY_SERVICE_ID;

  const logs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.logs
      .filter((log) => {
        if (log.service !== service) {
          return false;
        }
        if (level !== "all" && log.level !== level) {
          return false;
        }
        if (selectedLogTraceId && log.traceId !== selectedLogTraceId) {
          return false;
        }
        if (needle && !log.message.toLowerCase().includes(needle) && !(log.traceId ?? "").includes(needle)) {
          return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [snapshot.logs, service, level, query, selectedLogTraceId]);

  if (!incident) {
    return (
      <EmptyState
        title="No matching logs"
        description="Incident is not in the telemetry snapshot."
      />
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <LogFilters
          level={level}
          query={query}
          selectedLogTraceId={selectedLogTraceId}
          onLevel={setLevel}
          onQuery={setQuery}
          onClearTrace={() => selectLogTrace(null)}
        />
        <EmptyState
          title="No matching logs"
          description="Timeout and deadline-exceeded lines will appear when the filter matches."
        />
      </div>
    );
  }

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const visibleCount = WINDOW;
  const slice = logs.slice(start, start + visibleCount);
  const topPad = start * ROW_H;
  const bottomPad = Math.max(0, (logs.length - start - slice.length) * ROW_H);

  function openTrace(traceId: string) {
    selectTrace(traceId);
    selectLogTrace(traceId);
    setTab("traces");
  }

  return (
    <div className="flex flex-col gap-2">
      <LogFilters
        level={level}
        query={query}
        selectedLogTraceId={selectedLogTraceId}
        onLevel={setLevel}
        onQuery={setQuery}
        onClearTrace={() => selectLogTrace(null)}
      />
      <p className="font-mono text-[10px] text-muted-foreground">
        showing {Math.min(slice.length, logs.length)} of {logs.length}
        {logs.length >= 500 ? " (windowed)" : ""}
      </p>
      <div
        className="max-h-72 overflow-y-auto rounded-md border border-border font-mono text-[11px]"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: topPad }} />
        <ul>
          {slice.map((log, index) => (
            <LogRow
              key={`${log.timestamp}-${log.traceId ?? ""}-${start + index}`}
              log={log}
              onOpenTrace={openTrace}
            />
          ))}
        </ul>
        <div style={{ height: bottomPad }} />
      </div>
    </div>
  );
}

function LogFilters({
  level,
  query,
  selectedLogTraceId,
  onLevel,
  onQuery,
  onClearTrace,
}: {
  level: LevelFilter;
  query: string;
  selectedLogTraceId: string | null;
  onLevel: (level: LevelFilter) => void;
  onQuery: (query: string) => void;
  onClearTrace: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Log level filter">
        {(["ERROR", "WARN", "INFO", "all"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="xs"
            variant={level === value ? "secondary" : "ghost"}
            aria-pressed={level === value}
            onClick={() => onLevel(value)}
          >
            {value === "all" ? "All" : value}
          </Button>
        ))}
      </div>
      <Input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Filter message or trace id"
        aria-label="Filter logs"
        className="h-7 font-mono text-[12px]"
      />
      {selectedLogTraceId ? (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Filtered to trace{" "}
          <span className="font-mono text-foreground">{selectedLogTraceId}</span>
          <Button type="button" size="xs" variant="ghost" onClick={onClearTrace}>
            Clear
          </Button>
        </p>
      ) : null}
    </div>
  );
}

function LogRow({
  log,
  onOpenTrace,
}: {
  log: LogEntry;
  onOpenTrace: (traceId: string) => void;
}) {
  const traceId = log.traceId;
  return (
    <li
      className="grid grid-cols-[7.5rem_3.2rem_minmax(0,1fr)] items-start gap-2 border-b border-border px-2 py-1 last:border-0"
      style={{ minHeight: ROW_H }}
    >
      <time dateTime={log.timestamp} className="tabular-nums text-muted-foreground">
        {formatUtcHmsMs(log.timestamp)}
      </time>
      <StatusDot tone={logLevelTone(log.level)} label={log.level} />
      <div className="min-w-0">
        <p className="truncate text-foreground">{log.message}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {log.service}
          {traceId ? (
            <>
              {" · "}
              <button
                type="button"
                className={cn(
                  "font-mono text-foreground underline-offset-2 hover:underline",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                )}
                onClick={() => onOpenTrace(traceId)}
              >
                {traceId}
              </button>
            </>
          ) : null}
          {log.spanId ? (
            <>
              {" · "}
              <span>{log.spanId}</span>
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}
