"use client";

import { formatErrorRate, formatLatency, formatPercent, formatRequestRate } from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";

export function IncidentKpis({ incidentId }: { incidentId: string }) {
  const snapshot = useTelemetrySnapshot();
  const incident = snapshot.incidents.find((row) => row.id === incidentId);

  if (!incident) {
    return (
      <section
        data-slot="incident-kpis"
        id="overview"
        aria-label="Key metrics"
        className="rounded-md border border-border px-3"
      >
        <EmptyState title="No KPIs" description="Incident is missing from the snapshot." />
      </section>
    );
  }

  return (
    <section
      data-slot="incident-kpis"
      id="overview"
      aria-label="Key metrics"
      aria-live="polite"
      className="grid grid-cols-4 overflow-hidden rounded-md border border-border"
    >
      <KpiCell value={formatErrorRate(incident.errorRate)} label="Errors" />
      <KpiCell value={formatLatency(incident.p95Latency)} label="p95" />
      <KpiCell value={formatRequestRate(incident.requestRate)} label="req/min" />
      <KpiCell value={formatPercent(incident.affectedUsersPercent)} label="Impact" />
    </section>
  );
}

function KpiCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-border px-3 py-2.5 not-first:border-l">
      <span className="font-mono text-lg leading-none font-medium tabular-nums tracking-tight">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
