"use client";

import { useEffect, useRef } from "react";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { workspaceTabTargetId } from "@/components/observability/status";
import type { MetricName, WorkspaceTab } from "@/types";

export function resolveWorkspaceScrollTarget(input: {
  workspaceTab: WorkspaceTab;
  selectedTraceId: string | null;
  highlightedMetric: MetricName | null;
  highlightedDeploymentId: string | null;
}): string {
  if (input.highlightedMetric && input.workspaceTab === "metrics") {
    return `metric-${input.highlightedMetric}`;
  }
  if (input.highlightedDeploymentId && input.workspaceTab === "deployments") {
    return input.highlightedDeploymentId;
  }
  if (input.selectedTraceId && input.workspaceTab === "traces") {
    return "trace-detail";
  }
  return workspaceTabTargetId(input.workspaceTab);
}

export function shouldScrollToWorkspaceTarget(
  previousTarget: string | null,
  nextTarget: string,
): boolean {
  return previousTarget !== null && previousTarget !== nextTarget;
}

export function useEvidenceNavigation(): void {
  const workspaceTab = useIncidentStore((s) => s.workspaceTab);
  const selectedTraceId = useIncidentStore((s) => s.selectedTraceId);
  const highlightedMetric = useIncidentStore((s) => s.highlightedMetric);
  const highlightedDeploymentId = useIncidentStore((s) => s.highlightedDeploymentId);
  const recoveryTriggered = useIncidentStore((s) => s.telemetry.recoveryTriggered);
  const previousTarget = useRef<string | null>(null);
  const previousRecovery = useRef<boolean | null>(null);

  const targetId = resolveWorkspaceScrollTarget({
    workspaceTab,
    selectedTraceId,
    highlightedMetric,
    highlightedDeploymentId,
  });

  useEffect(() => {
    const main = document.getElementById("main-content");
    const lastTarget = previousTarget.current;
    const lastRecovery = previousRecovery.current;
    previousTarget.current = targetId;
    previousRecovery.current = recoveryTriggered;

    if (recoveryTriggered && lastRecovery === false) {
      if (main) {
        main.scrollTop = 0;
      }
      return;
    }

    if (!shouldScrollToWorkspaceTarget(lastTarget, targetId)) {
      return;
    }
    if (recoveryTriggered) {
      if (main) {
        main.scrollTop = 0;
      }
      return;
    }

    const el =
      document.getElementById(targetId) ??
      document.getElementById(workspaceTabTargetId(workspaceTab));
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [recoveryTriggered, targetId, workspaceTab]);
}
