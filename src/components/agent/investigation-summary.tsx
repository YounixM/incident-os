"use client";

import { Check } from "lucide-react";
import { INCIDENT_PEAK, RECOVERY } from "@/lib/constants";
import { incidentStatusLabel } from "@/components/observability/status";
import type { AgentStatus, Hypothesis, IncidentStatus } from "@/types";

export function InvestigationSummary({
  hypotheses,
  evidenceCount,
  incidentStatus,
  agentStatus,
}: {
  hypotheses: Hypothesis[];
  evidenceCount: number;
  incidentStatus: IncidentStatus;
  agentStatus: AgentStatus;
}) {
  const confirmed = hypotheses.find((row) => row.status === "confirmed");
  const showRootCause =
    Boolean(confirmed) &&
    (incidentStatus === "identified" ||
      incidentStatus === "action_pending" ||
      incidentStatus === "remediating" ||
      incidentStatus === "monitoring" ||
      incidentStatus === "resolved");
  const showRecovery =
    incidentStatus === "remediating" ||
    incidentStatus === "monitoring" ||
    incidentStatus === "resolved";
  const resolved = incidentStatus === "resolved" || agentStatus === "complete";

  if (!showRootCause && !showRecovery) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {showRecovery ? (
        <section aria-labelledby="recovery-heading" className="flex flex-col gap-1.5">
          <h3
            id="recovery-heading"
            className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            {resolved ? "Incident resolved" : "Incident recovering"}
          </h3>
          <p className="text-xs">Rollback completed</p>
          <p className="text-xs text-muted-foreground">Service checkout-api</p>
          <p className="font-mono text-xs tabular-nums">
            Error rate {INCIDENT_PEAK.errorRate}% to {RECOVERY.errorRate}%
          </p>
          <p className="font-mono text-xs tabular-nums">
            p95 {(INCIDENT_PEAK.p95LatencyMs / 1000).toFixed(1)}s to {RECOVERY.p95LatencyMs}ms
          </p>
          {resolved ? (
            <p className="flex items-center gap-1.5 text-xs text-status-healthy">
              <Check className="size-3" aria-hidden="true" />
              Incident resolved
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Status: {incidentStatusLabel(incidentStatus)}
            </p>
          )}
        </section>
      ) : null}

      {showRootCause && confirmed ? (
        <section aria-labelledby="root-cause-heading" className="flex flex-col gap-1.5">
          <h3
            id="root-cause-heading"
            className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Root cause identified
          </h3>
          <p className="text-sm font-medium leading-tight">{confirmed.title}</p>
          <p className="text-xs text-muted-foreground">
            Introduced in checkout-api v2.31
          </p>
          <p className="text-xs text-muted-foreground">
            Confidence {Math.round(confirmed.confidence * 100)}% · {evidenceCount} signals
          </p>
          {showRecovery ? null : <p className="text-xs">Recommended action: rollback to v2.30</p>}
        </section>
      ) : null}
    </div>
  );
}
