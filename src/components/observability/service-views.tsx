"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DEMO_NOW_ISO, SERVICE_IDS } from "@/lib/constants";
import { SERIES_START_ISO } from "@/data/story";
import { buildMetricSeries, metricUnit } from "@/data/metrics";
import { ServiceStatusIndicator } from "@/components/layout/status-indicator";
import { WorkspaceSlot } from "@/components/layout/workspace-slot";
import { DeploymentsTable } from "@/components/observability/deployments-table";
import { formatErrorRate, formatLatency } from "@/components/observability/format";
import { MetricChart } from "@/components/observability/metric-chart";
import { ServiceGraph } from "@/components/observability/service-graph";
import { EmptyState } from "@/components/observability/states";
import { useRecoveryTriggered, useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import type { MetricName, MetricResult } from "@/types";

function serviceMetric(
  serviceId: string,
  metric: MetricName,
  recoveryTriggered: boolean,
): MetricResult {
  return {
    metric,
    unit: metricUnit(metric),
    points: buildMetricSeries(
      serviceId,
      metric,
      SERIES_START_ISO,
      DEMO_NOW_ISO,
      recoveryTriggered,
    ),
  };
}

export function ServiceListView() {
  const snapshot = useTelemetrySnapshot();

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {snapshot.services.map((row) => (
        <li key={row.id}>
          <Link
            href={`/services/${row.id}`}
            className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[13px]">{row.id}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Error rate {formatErrorRate(row.errorRate)}
                {" · "}p95 {formatLatency(row.p95Latency)}
              </span>
            </div>
            <ServiceStatusIndicator status={row.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ServiceDetailView({ serviceId }: { serviceId: string }) {
  const snapshot = useTelemetrySnapshot();
  const recoveryTriggered = useRecoveryTriggered();
  const known = (SERVICE_IDS as readonly string[]).includes(serviceId);
  const service = snapshot.services.find((row) => row.id === serviceId);

  const charts = useMemo(
    () =>
      known
        ? {
            errorRate: serviceMetric(serviceId, "error_rate", recoveryTriggered),
            p95: serviceMetric(serviceId, "p95_latency", recoveryTriggered),
          }
        : null,
    [known, serviceId, recoveryTriggered],
  );

  return (
    <>
      <Link
        href="/services"
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-3" aria-hidden="true" />
        Services
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-lg font-medium tracking-tight">{serviceId}</h1>
          {service ? (
            <p className="font-mono text-[12px] text-muted-foreground">
              Error rate {formatErrorRate(service.errorRate)}
              {" · "}p95 {formatLatency(service.p95Latency)}
            </p>
          ) : null}
        </div>
        {service ? <ServiceStatusIndicator status={service.status} /> : null}
      </header>

      {!known || !service || !charts ? (
        <EmptyState
          title="Unknown service"
          description="Telemetry views will remain empty for this id."
        />
      ) : (
        <>
          <WorkspaceSlot slot="service-metrics" id="metrics" label="Metrics">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Error rate
                </h3>
                <MetricChart
                  points={charts.errorRate.points}
                  color="var(--status-critical)"
                  formatValue={formatErrorRate}
                />
                <p className="text-[11px] text-muted-foreground">
                  Current {formatErrorRate(service.errorRate)} on {serviceId}.
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  p95 latency
                </h3>
                <MetricChart
                  points={charts.p95.points}
                  color="var(--status-warning)"
                  formatValue={formatLatency}
                />
                <p className="text-[11px] text-muted-foreground">
                  Current p95 {formatLatency(service.p95Latency)}.
                </p>
              </div>
            </div>
          </WorkspaceSlot>

          <WorkspaceSlot slot="service-deployments" id="deployments" label="Recent deployments">
            <DeploymentsTable serviceId={serviceId} />
          </WorkspaceSlot>

          <WorkspaceSlot slot="service-graph" id="service-graph" label="Service graph">
            <ServiceGraph focusServiceId={serviceId} />
          </WorkspaceSlot>
        </>
      )}
    </>
  );
}
