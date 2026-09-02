import { tool } from "ai";
import { z } from "zod";
import { incidentOsTools } from "@/lib/webmcp/tools";

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
    description: incidentOsTools.get_incident.description,
    inputSchema: z.object({
      incidentId: z.string().min(1).describe("Incident id, e.g. checkout-api-error-rate"),
    }),
  }),
  get_service: tool({
    description: incidentOsTools.get_service.description,
    inputSchema: z.object({
      service: z.string().min(1).describe("Service id, e.g. checkout-api"),
    }),
  }),
  query_metrics: tool({
    description: incidentOsTools.query_metrics.description,
    inputSchema: z.object({
      service: z.string().min(1),
      metric: z.enum(METRIC_NAMES),
      startTime: iso,
      endTime: iso,
    }),
  }),
  search_logs: tool({
    description: incidentOsTools.search_logs.description,
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
    description: incidentOsTools.search_traces.description,
    inputSchema: z.object({
      service: z.string().min(1),
      status: z.enum(["ok", "error"]).optional(),
      startTime: iso,
      endTime: iso,
      limit: z.number().int().min(0).optional(),
    }),
  }),
  get_trace: tool({
    description: incidentOsTools.get_trace.description,
    inputSchema: z.object({
      traceId: z.string().min(1),
    }),
  }),
  get_deployments: tool({
    description: incidentOsTools.get_deployments.description,
    inputSchema: z.object({
      service: z.string().min(1),
      limit: z.number().int().min(0).optional(),
    }),
  }),
  compare_periods: tool({
    description: incidentOsTools.compare_periods.description,
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
    description: incidentOsTools.propose_rollback.description,
    inputSchema: z.object({
      service: z.string().min(1),
      targetVersion: z.string().min(1),
      reason: z.string().min(1),
    }),
  }),
  rollback_deployment: tool({
    description: incidentOsTools.rollback_deployment.description,
    inputSchema: z.object({
      service: z.string().min(1),
      targetVersion: z.string().min(1),
    }),
  }),
  add_incident_note: tool({
    description: incidentOsTools.add_incident_note.description,
    inputSchema: z.object({
      incidentId: z.string().min(1),
      note: z.string().min(1),
    }),
  }),
};
