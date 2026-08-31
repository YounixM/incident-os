"use client";

import { Check, Circle, CircleDot } from "lucide-react";
import { PROGRESS_STEPS } from "@/lib/agent/progress";
import type { AgentStatus } from "@/types";
import { cn } from "@/lib/utils";

export function ProgressChecklist({
  progressStep,
  agentStatus,
}: {
  progressStep: number;
  agentStatus: AgentStatus;
}) {
  const started = agentStatus !== "idle";
  const allDone = agentStatus === "complete" || progressStep >= PROGRESS_STEPS.length;

  return (
    <ol className="flex flex-col gap-1.5" aria-label="Investigation progress">
      {PROGRESS_STEPS.map((step, index) => {
        const done = allDone || index < progressStep;
        const current = started && !allDone && index === progressStep;
        return (
          <li key={step.id} className="flex items-center gap-2">
            {done ? (
              <Check className="size-3 shrink-0 text-status-healthy" aria-hidden="true" />
            ) : current ? (
              <CircleDot className="size-3 shrink-0 text-status-info" aria-hidden="true" />
            ) : (
              <Circle className="size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
            <span
              className={cn(
                "text-xs",
                done ? "text-foreground" : current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
