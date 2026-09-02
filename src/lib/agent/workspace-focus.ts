import { PRIMARY_SERVICE_ID, PRIMARY_VERSION } from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import {
  deploymentsFromResult,
  tracesFromResult,
  type ToolExecuteResult,
} from "@/lib/webmcp/tools";
import type { MetricName, ToolName } from "@/types";

function readMetric(input: unknown): MetricName | undefined {
  if (!input || typeof input !== "object" || !("metric" in input)) {
    return undefined;
  }
  const metric = (input as { metric?: unknown }).metric;
  return typeof metric === "string" ? (metric as MetricName) : undefined;
}

function readString(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== "object" || !(key in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Every successful tool call should move the shared workspace to the
 * telemetry the agent just inspected. Tab switches scroll; highlight
 * fields emphasize the specific chart, row, or filter.
 */
export function applyWorkspaceFocus(
  name: ToolName,
  input: unknown,
  result: ToolExecuteResult,
): void {
  if (!result.ok) {
    return;
  }
  const store = useIncidentStore.getState();
  switch (name) {
    case "get_investigation_context":
    case "get_incident":
    case "get_service":
      store.focusWorkspace({ tab: "overview", logQuery: null, metric: null, deploymentId: null });
      break;
    case "query_metrics":
    case "compare_periods":
      store.focusWorkspace({
        tab: "metrics",
        metric: readMetric(input) ?? null,
        deploymentId: null,
        logQuery: null,
      });
      break;
    case "search_logs":
      store.focusWorkspace({
        tab: "logs",
        logQuery: readString(input, "query") ?? null,
        metric: null,
        deploymentId: null,
      });
      break;
    case "search_traces": {
      const first = tracesFromResult(result.data)[0];
      store.focusWorkspace({
        tab: "traces",
        traceId: first?.traceId ?? null,
        metric: null,
        deploymentId: null,
        logQuery: null,
      });
      break;
    }
    case "get_trace":
      store.focusWorkspace({
        tab: "traces",
        traceId: readString(input, "traceId") ?? null,
        metric: null,
        deploymentId: null,
        logQuery: null,
      });
      break;
    case "get_deployments": {
      const deployments = deploymentsFromResult(result.data);
      const correlated =
        deployments.find(
          (row) => row.service === PRIMARY_SERVICE_ID && row.version === PRIMARY_VERSION,
        ) ?? deployments[0];
      store.focusWorkspace({
        tab: "deployments",
        deploymentId: correlated?.id ?? null,
        metric: null,
        logQuery: null,
      });
      break;
    }
    case "propose_rollback":
      store.focusWorkspace({ tab: "deployments" });
      break;
    case "rollback_deployment":
      store.focusWorkspace({
        tab: "overview",
        metric: null,
        deploymentId: null,
        logQuery: null,
      });
      break;
    case "add_incident_note":
      store.focusWorkspace({ tab: "timeline" });
      break;
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}
