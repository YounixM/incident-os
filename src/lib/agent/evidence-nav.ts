import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { Evidence } from "@/types";

export function navigateToEvidence(evidence: Evidence): void {
  const store = useIncidentStore.getState();
  switch (evidence.reference.type) {
    case "metric":
    case "comparison":
      store.setTab("metrics");
      break;
    case "trace":
      store.setTab("traces");
      store.selectTrace(evidence.reference.id);
      break;
    case "log":
      store.setTab("logs");
      store.selectLogTrace(evidence.reference.id);
      break;
    case "deployment":
      store.setTab("deployments");
      break;
    default: {
      const _exhaustive: never = evidence.reference.type;
      return _exhaustive;
    }
  }
}
