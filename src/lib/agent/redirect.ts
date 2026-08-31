import { PRIMARY_INCIDENT_ID, PRIMARY_SERVICE_ID } from "@/lib/constants";
import { invokeIncidentTool } from "./invoke-tool";
import { addAgentMessage } from "./messages";
import { classifyRedirect, type RedirectKind } from "./redirect-kind";
import { COMPARE_WINDOW, QUERY_WINDOW } from "./windows";

async function inspectService(
  service: string,
  metric: "p95_latency" | "error_rate",
  signal?: AbortSignal,
): Promise<void> {
  const serviceResult = await invokeIncidentTool("get_service", { service }, signal);
  if (serviceResult.ok) {
    addAgentMessage("finding", serviceResult.summary);
  }
  const metricsResult = await invokeIncidentTool(
    "query_metrics",
    { service, metric, ...QUERY_WINDOW },
    signal,
  );
  if (metricsResult.ok) {
    addAgentMessage("finding", metricsResult.summary);
  }
}

export async function runRedirectInvestigation(
  prompt: string,
  signal?: AbortSignal,
): Promise<void> {
  addAgentMessage("status", `Following up: ${prompt}`);
  const kind: RedirectKind = classifyRedirect(prompt);
  switch (kind) {
    case "payment":
      await inspectService("payment-service", "p95_latency", signal);
      addAgentMessage(
        "finding",
        "Payment-service latency is elevated but does not explain checkout-api errors.",
      );
      break;
    case "inventory":
      await inspectService("inventory-service", "error_rate", signal);
      addAgentMessage(
        "finding",
        "Inventory errors are not correlated with the checkout-api SEV-1.",
      );
      break;
    case "traffic": {
      const traffic = await invokeIncidentTool(
        "query_metrics",
        { service: PRIMARY_SERVICE_ID, metric: "request_rate", ...QUERY_WINDOW },
        signal,
      );
      if (traffic.ok) {
        addAgentMessage("finding", traffic.summary);
      }
      const compare = await invokeIncidentTool(
        "compare_periods",
        { service: PRIMARY_SERVICE_ID, metric: "request_rate", ...COMPARE_WINDOW },
        signal,
      );
      if (compare.ok) {
        addAgentMessage("finding", compare.summary);
      }
      break;
    }
    case "generic": {
      const incident = await invokeIncidentTool(
        "get_incident",
        { incidentId: PRIMARY_INCIDENT_ID },
        signal,
      );
      if (incident.ok) {
        addAgentMessage("finding", incident.summary);
      }
      break;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
