"use client";

import {
  ALERT_TRIGGERED_ISO,
  DB_LATENCY_RISE_ISO,
  DEPLOY_V231_ISO,
  ERROR_RISE_ISO,
  HTTP_500_SPIKE_ISO,
  INCIDENT_OPENED_ISO,
  LATENCY_RISE_ISO,
  PRIMARY_INCIDENT_ID,
  PRIMARY_VERSION,
} from "@/lib/constants";
import { formatUtcHm } from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types";

interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  detail: string;
  tone: "warning" | "critical" | "info" | "healthy";
}

const PRIMARY_EVENTS: TimelineEvent[] = [
  {
    id: "deploy",
    at: DEPLOY_V231_ISO,
    title: `Deployment ${PRIMARY_VERSION}`,
    detail: "checkout-api shipped Optimize checkout query",
    tone: "warning",
  },
  {
    id: "p95",
    at: LATENCY_RISE_ISO,
    title: "p95 latency begins increasing",
    detail: "Checkout p95 leaves the 420ms baseline",
    tone: "warning",
  },
  {
    id: "db",
    at: DB_LATENCY_RISE_ISO,
    title: "DB latency increases",
    detail: "db.query duration climbs on checkout-api",
    tone: "warning",
  },
  {
    id: "errors",
    at: ERROR_RISE_ISO,
    title: "Error rate increases",
    detail: "Checkout error rate leaves the 0.8% baseline",
    tone: "critical",
  },
  {
    id: "http500",
    at: HTTP_500_SPIKE_ISO,
    title: "HTTP 500 rate spikes",
    detail: "Timeouts surface as 500s on /checkout",
    tone: "critical",
  },
  {
    id: "alert",
    at: ALERT_TRIGGERED_ISO,
    title: "Alert triggered",
    detail: "Error-rate alert fires for checkout-api",
    tone: "critical",
  },
  {
    id: "opened",
    at: INCIDENT_OPENED_ISO,
    title: "Incident created",
    detail: "SEV-1 Checkout API — Elevated Error Rate",
    tone: "info",
  },
];

const TONE_DOT: Record<TimelineEvent["tone"], string> = {
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  info: "bg-status-info",
  healthy: "bg-status-healthy",
};

function agentStartedLabel(status: AgentStatus): string | null {
  switch (status) {
    case "idle":
      return null;
    case "investigating":
    case "waiting":
    case "complete":
      return "AI investigation started";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function IncidentTimeline({ incidentId }: { incidentId: string }) {
  const snapshot = useTelemetrySnapshot();
  const incident = snapshot.incidents.find((row) => row.id === incidentId);
  const agentStatus = useIncidentStore((s) => s.agent.status);
  const recoveryTriggered = useIncidentStore((s) => s.telemetry.recoveryTriggered);
  const messages = useIncidentStore((s) => s.agent.messages);

  if (!incident) {
    return (
      <EmptyState
        title="No timeline events"
        description="Incident is not in the telemetry snapshot."
      />
    );
  }

  const events: TimelineEvent[] =
    incident.id === PRIMARY_INCIDENT_ID
      ? [...PRIMARY_EVENTS]
      : [
          {
            id: "opened",
            at: incident.startedAt,
            title: "Incident created",
            detail: incident.title,
            tone: "info",
          },
        ];

  if (incident.id === PRIMARY_INCIDENT_ID) {
    const started = agentStartedLabel(agentStatus);
    const firstMessage = messages[0];
    if (started) {
      events.push({
        id: "ai",
        at: firstMessage?.timestamp ?? "2026-08-31T14:02:00.000Z",
        title: started,
        detail: "Agent attached to checkout-api-error-rate",
        tone: "info",
      });
    }
    if (recoveryTriggered) {
      events.push({
        id: "rollback",
        at: "2026-08-31T14:32:00.000Z",
        title: "Rollback v2.31 → v2.30",
        detail: "Telemetry recovering toward baseline",
        tone: "healthy",
      });
    }
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, index) => (
        <li key={event.id} className="flex gap-3">
          <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
            <time
              dateTime={event.at}
              className="font-mono text-[11px] tabular-nums text-muted-foreground"
            >
              {formatUtcHm(event.at)}
            </time>
          </div>
          <div className="flex flex-col items-center">
            <span
              className={cn("mt-1 size-2 shrink-0 rounded-full", TONE_DOT[event.tone])}
              aria-hidden="true"
            />
            {index < events.length - 1 ? (
              <span className="w-px flex-1 bg-border" aria-hidden="true" />
            ) : null}
          </div>
          <div className="min-w-0 pb-3">
            <p className="text-[13px] leading-tight">{event.title}</p>
            <p className="text-[11px] text-muted-foreground">{event.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
