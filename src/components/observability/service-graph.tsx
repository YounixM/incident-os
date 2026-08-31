"use client";

import { PRIMARY_INCIDENT_ID } from "@/lib/constants";
import { REPRESENTATIVE_DB_SPAN_ID } from "@/data/story";
import { ServiceStatusIndicator } from "@/components/layout/status-indicator";
import { formatErrorRate, formatLatency } from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";
import type { Service, ServiceStatus } from "@/types";

export function ServiceGraph({
  incidentId,
  focusServiceId,
}: {
  incidentId?: string;
  focusServiceId?: string;
}) {
  const snapshot = useTelemetrySnapshot();
  const incidentStatus = useIncidentStore((s) => s.incidentStatus);
  const selectedTraceId = useIncidentStore((s) => s.selectedTraceId);
  const selectedTrace = selectedTraceId
    ? snapshot.traces.find((trace) => trace.traceId === selectedTraceId)
    : undefined;

  const dbError =
    selectedTrace?.spans.some(
      (span) =>
        span.spanId === REPRESENTATIVE_DB_SPAN_ID ||
        (span.operation === "db.query" && span.status === "error"),
    ) ?? false;
  const identified =
    incidentId === PRIMARY_INCIDENT_ID ? incidentStatus !== "investigating" : false;
  const showDbHighlight = dbError || identified;

  const byId = new Map(snapshot.services.map((service) => [service.id, service]));
  const frontend = byId.get("frontend");
  const checkout = byId.get("checkout-api");
  const payment = byId.get("payment-service");
  const inventory = byId.get("inventory-service");
  const user = byId.get("user-service");

  if (!frontend || !checkout || !payment || !inventory || !user) {
    return (
      <EmptyState
        title="Dependency graph unavailable"
        description="frontend, checkout-api, payment-service, inventory-service, and user-service will render here."
      />
    );
  }

  const focus = focusServiceId ?? checkout.id;

  return (
    <div className="flex flex-col items-start gap-3 overflow-x-auto py-1">
      <GraphNode service={frontend} focused={focus === frontend.id} />
      <Edge />
      <GraphNode
        service={checkout}
        focused={focus === checkout.id}
        unhealthy={checkout.status !== "healthy"}
      />
      <div className="ml-6 flex flex-col gap-2 border-l border-border pl-4">
        <GraphNode service={payment} focused={focus === payment.id} />
        <GraphNode service={inventory} focused={focus === inventory.id} />
        <GraphNode service={user} focused={focus === user.id} />
        <DbNode highlighted={showDbHighlight} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        frontend depends on checkout-api, which calls payment-service, inventory-service, and
        user-service.
        {showDbHighlight
          ? " Database dependency is highlighted from the failed db.query span."
          : " Database is shown as a checkout-api dependency."}
      </p>
    </div>
  );
}

function Edge() {
  return (
    <div className="flex h-4 w-full items-center pl-8" aria-hidden="true">
      <span className="h-4 w-px bg-border" />
    </div>
  );
}

function GraphNode({
  service,
  focused,
  unhealthy,
}: {
  service: Service;
  focused: boolean;
  unhealthy?: boolean;
}) {
  const critical = unhealthy ?? service.status === "critical";
  return (
    <div
      className={cn(
        "flex min-w-[16rem] items-center justify-between gap-3 rounded-md border px-2.5 py-2",
        critical ? "border-status-critical/40 bg-status-critical/8" : "border-border",
        focused && "ring-1 ring-foreground/20",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-[12px]">{service.id}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          err {formatErrorRate(service.errorRate)} · p95 {formatLatency(service.p95Latency)}
        </span>
      </div>
      <ServiceStatusIndicator status={service.status} />
    </div>
  );
}

function DbNode({ highlighted }: { highlighted: boolean }) {
  const status: ServiceStatus = highlighted ? "critical" : "healthy";
  return (
    <div
      className={cn(
        "flex min-w-[16rem] items-center justify-between gap-3 rounded-md border px-2.5 py-2",
        highlighted
          ? "border-status-critical/60 bg-status-critical/12"
          : "border-dashed border-border",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-[12px]">checkout-db</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {highlighted ? "db.query ERROR · span 93ab4e21f006c8" : "dependency of checkout-api"}
        </span>
      </div>
      <ServiceStatusIndicator status={status} />
    </div>
  );
}
