"use client";

import { useMemo } from "react";
import { telemetryEngine } from "@/lib/observability";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { TelemetrySnapshot } from "@/data";

export function useTelemetrySnapshot(): TelemetrySnapshot {
  const recoveryTriggered = useIncidentStore((s) => s.telemetry.recoveryTriggered);
  const incidentStatus = useIncidentStore((s) => s.incidentStatus);

  return useMemo(() => {
    void recoveryTriggered;
    void incidentStatus;
    return telemetryEngine.getSnapshot();
  }, [recoveryTriggered, incidentStatus]);
}

export function useRecoveryTriggered(): boolean {
  return useIncidentStore((s) => s.telemetry.recoveryTriggered);
}
