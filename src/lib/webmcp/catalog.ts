import type { IncidentOsTool } from "./tools";
import { incidentOsTools } from "./tools";
import type { ToolName } from "@/types";

const TOOL_ORDER = [
  "get_incident",
  "get_service",
  "query_metrics",
  "search_logs",
  "search_traces",
  "get_trace",
  "get_deployments",
  "compare_periods",
  "propose_rollback",
  "rollback_deployment",
  "add_incident_note",
] as const satisfies readonly ToolName[];

const CATEGORY_ORDER = ["observability", "operations"] as const;

function categoryLabel(category: IncidentOsTool["category"]): string {
  switch (category) {
    case "observability":
      return "Observability";
    case "operations":
      return "Operations";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export function listTools(): IncidentOsTool[] {
  return TOOL_ORDER.map((name) => incidentOsTools[name]);
}

export const AGENT_CAPABILITIES: {
  category: string;
  items: { name: string; title: string }[];
}[] = CATEGORY_ORDER.map((category) => ({
  category: categoryLabel(category),
  items: listTools()
    .filter((tool) => tool.category === category)
    .map((tool) => ({ name: tool.name, title: tool.title })),
}));
