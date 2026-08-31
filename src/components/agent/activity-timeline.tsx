"use client";

import { Check, Circle, X } from "lucide-react";
import type { AgentActivity, AgentActivityStatus } from "@/types";
import { cn } from "@/lib/utils";

function formatHms(iso: string): string {
  const date = new Date(iso);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function StatusIcon({ status }: { status: AgentActivityStatus }) {
  switch (status) {
    case "running":
      return (
        <Circle
          className="size-3 shrink-0 animate-pulse text-status-info"
          aria-hidden="true"
        />
      );
    case "success":
      return <Check className="size-3 shrink-0 text-status-healthy" aria-hidden="true" />;
    case "error":
      return <X className="size-3 shrink-0 text-status-critical" aria-hidden="true" />;
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
      {recent.map((activity) => (
        <li key={activity.id} className="flex gap-2">
          <StatusIcon status={activity.status} />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-tight">{activity.summary}</p>
            <p className={cn("font-mono text-[10px] text-muted-foreground")}>
              <time dateTime={activity.timestamp}>{formatHms(activity.timestamp)}</time>
              <span aria-hidden="true"> · </span>
              <span>{activity.tool}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
