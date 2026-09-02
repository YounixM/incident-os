"use client";

import { Check, Circle, TriangleAlert, X } from "lucide-react";
import type { AgentActivity, AgentActivityStatus } from "@/types";
import type { StatusTone } from "@/components/observability/status";
import { cn } from "@/lib/utils";
import { activitySignal, activitySignalLabel } from "./activity-signal";

const TONE_ICON: Record<StatusTone, string> = {
  critical: "text-status-critical",
  warning: "text-status-warning",
  healthy: "text-status-healthy",
  info: "text-muted-foreground",
};

function formatHms(iso: string): string {
  const date = new Date(iso);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function StatusIcon({
  status,
  tone,
}: {
  status: AgentActivityStatus;
  tone: StatusTone;
}) {
  const className = cn("size-3 shrink-0", TONE_ICON[tone]);
  switch (status) {
    case "running":
      return <Circle className={cn(className, "animate-pulse text-status-info")} aria-hidden="true" />;
    case "error":
      return <X className={cn(className, "text-status-critical")} aria-hidden="true" />;
    case "success":
      switch (tone) {
        case "critical":
        case "warning":
          return <TriangleAlert className={className} aria-hidden="true" />;
        case "healthy":
          return <Check className={className} aria-hidden="true" />;
        case "info":
          return <Circle className={className} aria-hidden="true" />;
        default: {
          const _exhaustive: never = tone;
          return _exhaustive;
        }
      }
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function ActivityTimeline({ activities }: { activities: AgentActivity[] }) {
  if (activities.length === 0) {
    return null;
  }

  const recent = activities.slice(-12);

  return (
    <ol className="flex flex-col gap-2" aria-live="polite" aria-label="Tool activity">
      {recent.map((activity) => {
        const tone = activitySignal(activity);
        const label = activitySignalLabel(tone, activity.status);
        return (
          <li key={activity.id} className="flex gap-2">
            <span className="mt-0.5" aria-label={label} title={label}>
              <StatusIcon status={activity.status} tone={tone} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-tight">{activity.summary}</p>
              <p className={cn("font-mono text-[10px] text-muted-foreground")}>
                <time dateTime={activity.timestamp}>{formatHms(activity.timestamp)}</time>
                <span aria-hidden="true"> · </span>
                <span>{activity.tool}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
