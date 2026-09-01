"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { PRIMARY_INCIDENT_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { SeverityBadge, StatusDot } from "@/components/layout/status-indicator";
import { formatUtcHm, splitIncidentTitle } from "@/components/observability/format";
import { incidentStatusLabel, incidentStatusTone } from "@/components/observability/status";
import { useEvidenceNavigation } from "@/components/observability/use-evidence-navigation";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { EmptyState } from "@/components/observability/states";
import { startInvestigation } from "@/lib/agent/controller";
import { useIncidentStore } from "@/lib/store/use-incident-store";

export function IncidentHeader({ incidentId }: { incidentId: string }) {
  useEvidenceNavigation();
  const snapshot = useTelemetrySnapshot();
  const selectIncident = useIncidentStore((s) => s.selectIncident);
  const storeStatus = useIncidentStore((s) => s.incidentStatus);
  const agentStatus = useIncidentStore((s) => s.agent.status);
  const incident = snapshot.incidents.find((row) => row.id === incidentId);

  useEffect(() => {
    selectIncident(incidentId);
  }, [incidentId, selectIncident]);

  if (!incident) {
    return (
      <section data-slot="incident-header" id="incident-header" aria-label="Incident header">
        <Link
          href="/incidents"
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Incidents
        </Link>
        <EmptyState
          title="Incident not found"
          description={`${incidentId} is not in the telemetry snapshot.`}
        />
      </section>
    );
  }

  const { heading, subtitle } = splitIncidentTitle(incident.title);
  const status = incident.id === PRIMARY_INCIDENT_ID ? storeStatus : incident.status;

  return (
    <section
      data-slot="incident-header"
      id="incident-header"
      aria-label="Incident header"
      className="flex flex-col gap-3"
    >
      <Link
        href="/incidents"
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-3" aria-hidden="true" />
        Incidents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <SeverityBadge severity={incident.severity} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-lg leading-tight font-medium tracking-tight">{heading}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <p className="font-mono text-[12px] text-muted-foreground">{incident.service}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusDot tone={incidentStatusTone(status)} label={incidentStatusLabel(status)} />
            <span aria-hidden="true">·</span>
            <span>
              Started{" "}
              <time dateTime={incident.startedAt} className="font-mono tabular-nums">
                {formatUtcHm(incident.startedAt)}
              </time>
            </span>
          </p>
        </div>

        {incident.id === PRIMARY_INCIDENT_ID ? (
          <Button
            type="button"
            id="investigate-with-ai"
            size="sm"
            disabled={agentStatus === "investigating" || agentStatus === "waiting"}
            onClick={() => {
              void startInvestigation();
            }}
          >
            <Bot data-icon="inline-start" className="size-3.5" aria-hidden="true" />
            Investigate with AI
          </Button>
        ) : (
          <p className="max-w-[16rem] text-right text-xs leading-snug text-muted-foreground">
            Scripted investigation is on the{" "}
            <Link
              href={`/incidents/${PRIMARY_INCIDENT_ID}`}
              className="text-foreground underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              checkout-api SEV-1
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
