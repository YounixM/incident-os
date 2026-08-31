"use client";

import { useEffect, useRef } from "react";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { workspaceTabTargetId } from "@/components/observability/status";

export function useEvidenceNavigation(): void {
  const workspaceTab = useIncidentStore((s) => s.workspaceTab);
  const selectedTraceId = useIncidentStore((s) => s.selectedTraceId);
  const selectedLogTraceId = useIncidentStore((s) => s.selectedLogTraceId);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const id = workspaceTabTargetId(workspaceTab);
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [workspaceTab, selectedTraceId, selectedLogTraceId]);
}
