import type { ToolName } from "@/types";

export const TOOL_NAMES = [
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

export function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}
