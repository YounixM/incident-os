"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import {
  INCIDENT_PEAK,
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  PRIMARY_VERSION,
  RECOVERY,
  ROLLBACK_VERSION,
} from "@/lib/constants";
import { incidentStatusLabel } from "@/components/observability/status";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";

export function IncidentRecoveryBanner({ incidentId }: { incidentId: string }) {
  const recoveryTriggered = useIncidentStore((s) => s.telemetry.recoveryTriggered);
  const incidentStatus = useIncidentStore((s) => s.incidentStatus);

  useEffect(() => {
    if (!recoveryTriggered || incidentId !== PRIMARY_INCIDENT_ID) {
      return;
    }
    const main = document.getElementById("main-content");
    if (main) {
      main.scrollTop = 0;
    }
  }, [incidentId, recoveryTriggered]);

  if (incidentId !== PRIMARY_INCIDENT_ID || !recoveryTriggered) {
    return null;
  }

  const resolved = incidentStatus === "resolved";
  const peakError = `${INCIDENT_PEAK.errorRate}%`;
  const recoveredError = `${RECOVERY.errorRate}%`;
  const peakP95 = `${(INCIDENT_PEAK.p95LatencyMs / 1000).toFixed(1)}s`;
  const recoveredP95 = `${RECOVERY.p95LatencyMs}ms`;

  return (
    <aside
      id="recovery-banner"
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-1 rounded-md border px-3 py-2",
        resolved
          ? "border-status-healthy/40 bg-status-healthy/8"
          : "border-status-info/40 bg-status-info/8",
      )}
    >
      <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        {resolved ? "Incident resolved" : "Incident recovering"}
      </p>
      <p className="text-xs text-foreground">Rollback completed</p>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        {PRIMARY_SERVICE_ID} {PRIMARY_VERSION} to {ROLLBACK_VERSION}
      </p>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        Error rate {peakError} to {recoveredError}
        <span className="mx-2 text-border">·</span>
        p95 {peakP95} to {recoveredP95}
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
    </aside>
  );
}
