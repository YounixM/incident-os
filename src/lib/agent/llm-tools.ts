import { tool } from "ai";
import { z } from "zod";

const METRIC_NAMES = [
  "error_rate",
  "request_rate",
  "p50_latency",
  "p95_latency",
  "p99_latency",
  "db_latency",
] as const;

const iso = z.string().min(1).describe("ISO-8601 UTC timestamp");

export const llmTools = {
  get_incident: tool({
    description:
      "Retrieve incident context: severity, service, status, current KPIs, and rollback approval. If approval.approved is true, call rollback_deployment immediately.",
    inputSchema: z.object({
      incidentId: z.string().min(1).describe("Incident id, e.g. checkout-api-error-rate"),
    }),
  }),
  get_service: tool({
    description: "Retrieve service metadata, dependency list, and current health.",
    inputSchema: z.object({
      service: z.string().min(1).describe("Service id, e.g. checkout-api"),
    }),
  }),
  query_metrics: tool({
    description: "Query a time series for error_rate, request_rate, latency, or db_latency.",
    inputSchema: z.object({
      service: z.string().min(1),
      metric: z.enum(METRIC_NAMES),
      startTime: iso,
      endTime: iso,
    }),
  }),
  search_logs: tool({
    description: "Search service logs by time range and optional substring.",
    inputSchema: z.object({
      service: z.string().min(1),
      query: z.string().optional(),
      startTime: iso,
      endTime: iso,
      limit: z.number().int().min(0).optional(),
      traceId: z.string().min(1).optional(),
    }),
  }),
  search_traces: tool({
    description: "Search traces for a service, optionally filtered by ok/error status.",
    inputSchema: z.object({
      service: z.string().min(1),
      status: z.enum(["ok", "error"]).optional(),
      startTime: iso,
      endTime: iso,
      limit: z.number().int().min(0).optional(),
    }),
  }),
  get_trace: tool({
    description: "Fetch a full trace and span hierarchy by id.",
    inputSchema: z.object({
      traceId: z.string().min(1),
    }),
  }),
  get_deployments: tool({
    description: "List recent deployments for a service, newest first.",
    inputSchema: z.object({
      service: z.string().min(1),
      limit: z.number().int().min(0).optional(),
    }),
  }),
  compare_periods: tool({
    description: "Compare baseline vs incident-window averages for a metric.",
    inputSchema: z.object({
      service: z.string().min(1),
      metric: z.enum(METRIC_NAMES),
      baselineStart: iso,
      baselineEnd: iso,
      incidentStart: iso,
      incidentEnd: iso,
    }),
  }),
  propose_rollback: tool({
    description:
      "Open a human approval dialog and wait until Approve or Cancel. Does not mutate telemetry. When status is approved, immediately call rollback_deployment with the same service and targetVersion.",
    inputSchema: z.object({
      service: z.string().min(1),
      targetVersion: z.string().min(1),
      reason: z.string().min(1),
    }),
  }),
  rollback_deployment: tool({
    description:
      "Roll a service back to a prior version. Call immediately after propose_rollback returns approved, or when get_incident.approval.approved is true.",
    inputSchema: z.object({
      service: z.string().min(1),
      targetVersion: z.string().min(1),
    }),
  }),
  add_incident_note: tool({
    description: "Append a note to an incident timeline.",
    inputSchema: z.object({
      incidentId: z.string().min(1),
      note: z.string().min(1),
    }),
  }),
};
