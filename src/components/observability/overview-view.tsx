"use client";

import Link from "next/link";
import { BASELINE, DEMO_NOW_ISO, PRIMARY_INCIDENT_ID, PRIMARY_SERVICE_ID, PRIMARY_VERSION } from "@/lib/constants";
import { SeverityBadge, ServiceStatusIndicator, StatusDot } from "@/components/layout/status-indicator";
import { WorkspaceSlot } from "@/components/layout/workspace-slot";
import { formatDeployTime, formatErrorRate, formatLatency, formatUtcHm } from "@/components/observability/format";
import { incidentStatusLabel, incidentStatusTone } from "@/components/observability/status";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";

export function OverviewView() {
  const snapshot = useTelemetrySnapshot();
  const storeStatus = useIncidentStore((s) => s.incidentStatus);
  const checkout = snapshot.services.find((service) => service.id === PRIMARY_SERVICE_ID);
  const active = snapshot.incidents.filter((incident) => incident.status !== "resolved");
  const recent = snapshot.deployments
    .slice()
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 6);

  return (
    <>
      <header className="flex flex-col gap-0.5">
        <h1 className="text-sm font-medium tracking-tight">Overview</h1>
        <p className="text-xs text-muted-foreground">
          System health at {formatUtcHm(DEMO_NOW_ISO)} UTC
        </p>
      </header>

      <WorkspaceSlot slot="overview-active-incidents" label="Active incidents">
        <ul className="flex flex-col gap-1">
          {active.map((incident) => {
            const status =
              incident.id === PRIMARY_INCIDENT_ID ? storeStatus : incident.status;
            return (
              <li key={incident.id}>
                <Link
                  href={`/incidents/${incident.id}`}
                  className="flex items-start justify-between gap-3 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={incident.severity} />
                      <span className="truncate text-sm">{incident.title}</span>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">{incident.service}</p>
                  </div>
                  <StatusDot tone={incidentStatusTone(status)} label={incidentStatusLabel(status)} />
                </Link>
              </li>
            );
          })}
        </ul>
      </WorkspaceSlot>

      <WorkspaceSlot slot="overview-service-health" label="Service health">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.services.map((service) => (
            <li key={service.id}>
              <Link
                href={`/services/${service.id}`}
                className={cn(
                  "flex h-full flex-col gap-1.5 rounded-md border border-border px-2.5 py-2 transition-colors hover:bg-muted/40",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  service.status === "critical" && "border-status-critical/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px]">{service.id}</span>
                  <ServiceStatusIndicator status={service.status} />
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Error rate {formatErrorRate(service.errorRate)}
                  {" · "}p95 {formatLatency(service.p95Latency)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </WorkspaceSlot>

      <div className="grid gap-3 md:grid-cols-3">
        <section aria-label="Error-rate summary" className="rounded-md border border-border p-3">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Error rate
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {formatErrorRate(checkout?.errorRate ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            checkout-api versus {BASELINE.errorRate}% baseline. Incident is localized.
          </p>
        </section>
        <section aria-label="Latency summary" className="rounded-md border border-border p-3">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Latency
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {formatLatency(checkout?.p95Latency ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            checkout-api p95 versus {formatLatency(BASELINE.p95LatencyMs)} baseline.
          </p>
        </section>
        <section aria-label="Recent deployments" className="rounded-md border border-border p-3">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Recent deployments
          </p>
          <ul className="mt-2 divide-y divide-border">
            {recent.map((deployment) => {
              const gun =
                deployment.service === PRIMARY_SERVICE_ID &&
                deployment.version === PRIMARY_VERSION;
              return (
                <li key={deployment.id} className="flex items-baseline justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12px]">
                      {deployment.service} {deployment.version}
                      {gun ? (
                        <span className="ml-1.5 font-sans text-[10px] text-status-warning">
                          correlated
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">{deployment.summary}</p>
                  </div>
                  <time
                    dateTime={deployment.timestamp}
                    className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
                  >
                    {formatDeployTime(deployment.timestamp)}
                  </time>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
