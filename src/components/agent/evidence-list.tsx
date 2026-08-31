"use client";

import { navigateToEvidence } from "@/lib/agent/evidence-nav";
import type { Evidence, EvidenceType } from "@/types";

function actionLabel(type: EvidenceType): string {
  switch (type) {
    case "metric":
      return "View metric";
    case "trace":
      return "View trace";
    case "log":
      return "View logs";
    case "deployment":
      return "View deployment";
    case "comparison":
      return "Compare periods";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Evidence items will navigate into telemetry views.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Evidence">
      {evidence.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            data-evidence-id={item.id}
            data-evidence-type={item.reference.type}
            className="flex w-full flex-col items-start gap-0.5 rounded-md px-1 py-1 text-left hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => navigateToEvidence(item)}
          >
            <span className="text-xs leading-tight">{item.title}</span>
            <span className="text-[10px] text-status-info">{actionLabel(item.reference.type)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
