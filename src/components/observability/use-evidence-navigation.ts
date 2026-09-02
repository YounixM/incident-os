"use client";

import { useEffect, useRef } from "react";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { workspaceTabTargetId } from "@/components/observability/status";

export function useEvidenceNavigation(): void {
  const workspaceTab = useIncidentStore((s) => s.workspaceTab);
  const selectedTraceId = useIncidentStore((s) => s.selectedTraceId);
  const selectedLogTraceId = useIncidentStore((s) => s.selectedLogTraceId);
  const highlightedMetric = useIncidentStore((s) => s.highlightedMetric);
  const highlightedDeploymentId = useIncidentStore((s) => s.highlightedDeploymentId);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const specificId =
      highlightedMetric && workspaceTab === "metrics"
        ? `metric-${highlightedMetric}`
        : highlightedDeploymentId && workspaceTab === "deployments"
          ? highlightedDeploymentId
          : selectedTraceId && workspaceTab === "traces"
            ? "trace-detail"
            : workspaceTabTargetId(workspaceTab);
    const el = document.getElementById(specificId) ?? document.getElementById(workspaceTabTargetId(workspaceTab));
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [
    workspaceTab,
    selectedTraceId,
    selectedLogTraceId,
    highlightedMetric,
    highlightedDeploymentId,
  ]);
}
