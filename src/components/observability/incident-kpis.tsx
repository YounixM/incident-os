"use client";

import { formatErrorRate, formatLatency, formatPercent, formatRequestRate } from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { PRIMARY_INCIDENT_ID } from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";

export function IncidentKpis({ incidentId }: { incidentId: string }) {
  const snapshot = useTelemetrySnapshot();
  const recoveryTriggered = useIncidentStore((s) => s.telemetry.recoveryTriggered);
  const incident = snapshot.incidents.find((row) => row.id === incidentId);
  const recovered = incidentId === PRIMARY_INCIDENT_ID && recoveryTriggered;

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
      className={cn(
        "grid grid-cols-4 overflow-hidden rounded-md border",
        recovered ? "border-status-healthy/40" : "border-border",
      )}
    >
      <KpiCell value={formatErrorRate(incident.errorRate)} label="Errors" recovered={recovered} />
      <KpiCell value={formatLatency(incident.p95Latency)} label="p95" recovered={recovered} />
      <KpiCell value={formatRequestRate(incident.requestRate)} label="req/min" />
      <KpiCell value={formatPercent(incident.affectedUsersPercent)} label="Impact" />
    </section>
  );
}

function KpiCell({
  value,
  label,
  recovered = false,
}: {
  value: string;
  label: string;
  recovered?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-border px-3 py-2.5 not-first:border-l">
      <span
        className={cn(
          "font-mono text-lg leading-none font-medium tabular-nums tracking-tight",
          recovered && "text-status-healthy",
        )}
      >
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
