"use client";

import { Progress } from "@/components/ui/progress";
import { navigateToEvidence } from "@/lib/agent/evidence-nav";
import type { Evidence, Hypothesis } from "@/types";
import { cn } from "@/lib/utils";

function percent(confidence: number): number {
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}

function statusLabel(status: Hypothesis["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "rejected":
      return "Rejected";
    case "confirmed":
      return "Confirmed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function hypothesisDetail(hypothesis: Hypothesis): string {
  if (hypothesis.status === "rejected") {
    return "";
  }
  if (hypothesis.confidence >= 0.8) {
    return " · Strong evidence";
  }
  if (hypothesis.confidence < 0.15) {
    return " · Insufficient evidence";
  }
  if (hypothesis.confidence < 0.4) {
    return " · Weak correlation";
  }
  return "";
}

export function HypothesisPanel({
  hypotheses,
  evidence,
}: {
  hypotheses: Hypothesis[];
  evidence: Evidence[];
}) {
  const current =
    hypotheses.find((row) => row.status === "confirmed") ??
    hypotheses.find((row) => row.status === "active") ??
    hypotheses[0];

  if (!current) {
    return <p className="text-xs text-muted-foreground">No active hypothesis.</p>;
  }

  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const currentPct = percent(current.confidence);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium leading-tight">{current.title}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Confidence
          </span>
          <span className="font-mono text-[11px] tabular-nums">{currentPct}%</span>
        </div>
        <Progress value={currentPct} aria-label={`Confidence ${currentPct} percent`} />
      </div>

      <ul className="flex flex-col gap-1.5" aria-label="Competing hypotheses">
        {hypotheses.map((hypothesis, index) => (
          <li key={hypothesis.id} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <p
                className={cn(
                  "text-xs leading-tight",
                  hypothesis.status === "rejected" && "text-muted-foreground line-through",
                )}
              >
                <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
                {hypothesis.title}
              </p>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                {percent(hypothesis.confidence)}%
              </span>
            </div>
            <p className="pl-4 text-[10px] text-muted-foreground">
              {statusLabel(hypothesis.status)}
              {hypothesisDetail(hypothesis)}
            </p>
            {hypothesis.evidenceIds.length > 0 ? (
              <ul className="flex flex-col gap-0.5 pl-4">
                {hypothesis.evidenceIds.map((id) => {
                  const item = evidenceById.get(id);
                  if (!item) {
                    return null;
                  }
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="text-left text-[10px] text-status-info underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={() => navigateToEvidence(item)}
                      >
                        {item.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
