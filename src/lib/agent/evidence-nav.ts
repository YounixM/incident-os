import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { Evidence, MetricName } from "@/types";

function asMetricName(id: string): MetricName | null {
  switch (id) {
    case "error_rate":
    case "request_rate":
    case "p50_latency":
    case "p95_latency":
    case "p99_latency":
    case "db_latency":
      return id;
    default:
      return null;
  }
}

export function navigateToEvidence(evidence: Evidence): void {
  const store = useIncidentStore.getState();
  switch (evidence.reference.type) {
    case "metric":
    case "comparison":
      store.focusWorkspace({
        tab: "metrics",
        metric: asMetricName(evidence.reference.id),
      });
      break;
    case "trace":
      store.focusWorkspace({
        tab: "traces",
        traceId: evidence.reference.id,
      });
      break;
    case "log":
      store.focusWorkspace({
        tab: "logs",
        logQuery: evidence.reference.id,
      });
      break;
    case "deployment":
      store.focusWorkspace({
        tab: "deployments",
        deploymentId: evidence.reference.id,
      });
      break;
    default: {
      const _exhaustive: never = evidence.reference.type;
      return _exhaustive;
    }
  }
}
