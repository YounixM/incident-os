import { observabilityService, TelemetryError, withLatency } from "@/lib/observability/service";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type {
  ComparisonResult,
  Deployment,
  Incident,
  LogEntry,
  MetricName,
  MetricResult,
  RollbackParams,
  Service,
  ToolName,
  Trace,
} from "@/types";
import { z } from "zod";

export type IncidentOsTool = {
  name: ToolName;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  zodSchema: z.ZodType;
  readOnly: boolean;
  untrustedContent?: boolean;
  category: "observability" | "operations";
  execute: (input: unknown) => Promise<ToolExecuteResult>;
};

export type ToolExecuteResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: { code: string; message: string };
};

type HandlerOk = { summary: string; data: unknown };
type HandlerErr = { summary: string; error: { code: string; message: string } };
type HandlerResult = HandlerOk | HandlerErr;

const METRIC_NAMES = [
  "error_rate",
  "request_rate",
  "p50_latency",
  "p95_latency",
  "p99_latency",
  "db_latency",
] as const satisfies readonly MetricName[];

const isoDateTime = z.iso.datetime({ offset: true });

const getIncidentSchema = z.object({
  incidentId: z.string().min(1).describe("Incident id, e.g. checkout-api-error-rate"),
});

const getServiceSchema = z.object({
  service: z.string().min(1).describe("Service id, e.g. checkout-api"),
});

const queryMetricsSchema = z.object({
  service: z.string().min(1),
  metric: z.enum(METRIC_NAMES),
  startTime: isoDateTime,
  endTime: isoDateTime,
});

const searchLogsSchema = z.object({
  service: z.string().min(1),
  query: z.string().optional(),
  startTime: isoDateTime,
  endTime: isoDateTime,
  limit: z.number().int().min(0).optional(),
  traceId: z.string().min(1).optional(),
});

const searchTracesSchema = z.object({
  service: z.string().min(1),
  status: z.enum(["ok", "error"]).optional(),
  startTime: isoDateTime,
  endTime: isoDateTime,
  limit: z.number().int().min(0).optional(),
});

const getTraceSchema = z.object({
  traceId: z.string().min(1).describe("Full trace id or unique prefix"),
});

const getDeploymentsSchema = z.object({
  service: z.string().min(1),
  limit: z.number().int().min(0).optional(),
});

const comparePeriodsSchema = z.object({
  service: z.string().min(1),
  metric: z.enum(METRIC_NAMES),
  baselineStart: isoDateTime,
  baselineEnd: isoDateTime,
  incidentStart: isoDateTime,
  incidentEnd: isoDateTime,
});

const rollbackDeploymentSchema = z.object({
  service: z.string().min(1),
  targetVersion: z.string().min(1).describe("Version to roll back to, e.g. v2.30"),
});

const proposeRollbackSchema = z.object({
  service: z.string().min(1),
  targetVersion: z.string().min(1).describe("Version to roll back to, e.g. v2.30"),
  reason: z.string().min(1).describe("Why this rollback should be approved"),
});

const addIncidentNoteSchema = z.object({
  incidentId: z.string().min(1),
  note: z.string().min(1),
});

function isHandlerErr(result: HandlerResult): result is HandlerErr {
  return "error" in result;
}

function defineTool<T>(config: {
  name: ToolName;
  title: string;
  description: string;
  zodSchema: z.ZodType<T>;
  readOnly: boolean;
  untrustedContent?: boolean;
  category: IncidentOsTool["category"];
  handler: (input: T) => Promise<HandlerResult>;
}): IncidentOsTool {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    inputSchema: z.toJSONSchema(config.zodSchema) as Record<string, unknown>,
    zodSchema: config.zodSchema,
    readOnly: config.readOnly,
    untrustedContent: config.untrustedContent,
    category: config.category,
    execute: async (input: unknown): Promise<ToolExecuteResult> => {
      const parsed = config.zodSchema.safeParse(input);
      if (!parsed.success) {
        const message = z.prettifyError(parsed.error);
        return {
          ok: false,
          summary: "Invalid tool input",
          error: { code: "INVALID_ARGUMENT", message },
        };
      }
      try {
        const result = await withLatency(config.name, () => config.handler(parsed.data));
        if (isHandlerErr(result)) {
          return {
            ok: false,
            summary: result.summary,
            error: result.error,
          };
        }
        return {
          ok: true,
          summary: result.summary,
          data: result.data,
        };
      } catch (err) {
        return telemetryFailure(err);
      }
    },
  };
}

function telemetryFailure(err: unknown): ToolExecuteResult {
  if (err instanceof TelemetryError) {
    return {
      ok: false,
      summary: err.message,
      error: { code: err.code, message: err.message },
    };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return {
    ok: false,
    summary: message,
    error: { code: "INTERNAL", message },
  };
}

function isRollbackApproved(params: RollbackParams): boolean {
  const { pendingAction, approved } = useIncidentStore.getState().approval;
  if (!pendingAction || !approved) {
    return false;
  }
  return (
    pendingAction.tool === "rollback_deployment" &&
    pendingAction.params.service === params.service &&
    pendingAction.params.targetVersion === params.targetVersion
  );
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) {
    return "∞";
  }
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 1 : 2;
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function formatLatencyMs(ms: number): string {
  if (ms >= 1000) {
    return `${formatCompact(ms / 1000)}s`;
  }
  return `${formatCompact(ms)}ms`;
}

function metricLabel(metric: MetricName): string {
  switch (metric) {
    case "error_rate":
      return "Error rate";
    case "request_rate":
      return "Request rate";
    case "p50_latency":
      return "p50 latency";
    case "p95_latency":
      return "p95 latency";
    case "p99_latency":
      return "p99 latency";
    case "db_latency":
      return "DB latency";
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

function formatMetricValue(metric: MetricName, value: number): string {
  switch (metric) {
    case "error_rate":
      return `${formatCompact(value)}%`;
    case "request_rate":
      return `${formatCompact(value)}/min`;
    case "p50_latency":
    case "p95_latency":
    case "p99_latency":
    case "db_latency":
      return formatLatencyMs(value);
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

function describeChange(label: string, from: number, to: number): string {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return `${label} could not be compared`;
  }
  if (from === to) {
    return `${label} unchanged at ${formatCompact(to)}`;
  }
  if (from === 0) {
    return `${label} rose from 0`;
  }
  const ratio = to / from;
  const increased = ratio >= 1;
  const verb = increased ? "increased" : "decreased";
  const magnitude = increased ? ratio : from / to;
  if (magnitude >= 1.5) {
    return `${label} ${verb} ${formatCompact(magnitude)}×`;
  }
  const percent = Math.abs((to - from) / from) * 100;
  return `${label} ${verb} ${formatCompact(percent)}%`;
}

function summarizeIncident(
  incident: Incident,
  approval: ReturnType<typeof rollbackApprovalState>,
): string {
  const kpis = `${incident.severity} ${incident.service}: error rate ${formatCompact(incident.errorRate)}%, p95 ${formatLatencyMs(incident.p95Latency)}`;
  if (!approval.pending) {
    return kpis;
  }
  if (approval.approved) {
    return `${kpis}. Rollback to ${approval.targetVersion} is approved.`;
  }
  return `${kpis}. Rollback to ${approval.targetVersion} is waiting for approval.`;
}

function rollbackApprovalState(): {
  pending: boolean;
  approved: boolean;
  service?: string;
  targetVersion?: string;
} {
  const { pendingAction, approved } = useIncidentStore.getState().approval;
  if (!pendingAction) {
    return {
      pending: false,
      approved: false,
    };
  }
  return {
    pending: true,
    approved,
    service: pendingAction.params.service,
    targetVersion: pendingAction.params.targetVersion,
  };
}

function summarizeService(service: Service): string {
  return `${service.id} is ${service.status} (error rate ${formatCompact(service.errorRate)}%)`;
}

function summarizeMetrics(result: MetricResult, service: string): string {
  const points = result.points;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return `No ${result.metric} points for ${service} in range`;
  }
  if (points.length === 1 || first.value === last.value) {
    return `${metricLabel(result.metric)} for ${service} is ${formatMetricValue(result.metric, last.value)}`;
  }
  return describeChange(metricLabel(result.metric), first.value, last.value);
}

function summarizeLogs(logs: LogEntry[], query: string | undefined): string {
  const matching = query?.trim() ? ` matching "${query.trim()}"` : "";
  return `Found ${logs.length} log${logs.length === 1 ? "" : "s"}${matching}`;
}

function summarizeTraces(traces: Trace[], status: "ok" | "error" | undefined): string {
  if (status === "error") {
    return `Found ${traces.length} failed trace${traces.length === 1 ? "" : "s"}`;
  }
  if (status === "ok") {
    return `Found ${traces.length} successful trace${traces.length === 1 ? "" : "s"}`;
  }
  const failed = traces.filter((trace) => trace.status === "error").length;
  return `Found ${traces.length} traces (${failed} failed)`;
}

function summarizeTrace(trace: Trace): string {
  const dominant = trace.spans.reduce<Trace["spans"][number] | undefined>((best, span) => {
    if (!best || span.duration > best.duration) {
      return span;
    }
    return best;
  }, undefined);
  if (!dominant || trace.duration <= 0) {
    return `Trace ${trace.traceId} ${trace.status}, ${formatLatencyMs(trace.duration)}`;
  }
  const share = Math.round((dominant.duration / trace.duration) * 100);
  if (trace.status === "error") {
    return `Trace ${trace.traceId} failed: ${dominant.operation} is ${share}% of duration`;
  }
  return `Trace ${trace.traceId}: ${dominant.operation} is ${share}% of duration`;
}

function summarizeDeployments(deployments: Deployment[], service: string): string {
  const latest = deployments[0];
  if (!latest) {
    return `No deployments for ${service}`;
  }
  return `Latest ${service} deploy is ${latest.version} (${latest.summary})`;
}

function summarizeComparison(result: ComparisonResult): string {
  return describeChange(metricLabel(result.metric), result.baselineAverage, result.incidentAverage);
}

export const incidentOsTools: Record<ToolName, IncidentOsTool> = {
  get_incident: defineTool({
    name: "get_incident",
    title: "Inspect incident",
    description:
      "Returns an incident's severity, status, KPIs, service, and approval state. Read-only: does not modify state, request approval, or trigger a deployment.",
    zodSchema: getIncidentSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const incident = await observabilityService.getIncident(input.incidentId);
      const approval = rollbackApprovalState();
      return {
        summary: summarizeIncident(incident, approval),
        data: { ...incident, approval },
      };
    },
  }),

  get_service: defineTool({
    name: "get_service",
    title: "Inspect services",
    description: "Returns service metadata, dependency list, and current health. Read-only.",
    zodSchema: getServiceSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const data = await observabilityService.getService(input.service);
      return { summary: summarizeService(data), data };
    },
  }),

  query_metrics: defineTool({
    name: "query_metrics",
    title: "Query metrics",
    description:
      "Returns a time series for error_rate, request_rate, p50/p95/p99 latency, or db_latency. Read-only.",
    zodSchema: queryMetricsSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const data = await observabilityService.queryMetrics(input);
      return { summary: summarizeMetrics(data, input.service), data };
    },
  }),

  search_logs: defineTool({
    name: "search_logs",
    title: "Search logs",
    description:
      "Returns service logs for a time range, optional substring, and optional trace id. Read-only. Log lines may include untrusted application text.",
    zodSchema: searchLogsSchema,
    readOnly: true,
    untrustedContent: true,
    category: "observability",
    handler: async (input) => {
      const data = await observabilityService.searchLogs(input);
      return { summary: summarizeLogs(data, input.query), data };
    },
  }),

  search_traces: defineTool({
    name: "search_traces",
    title: "Search traces",
    description: "Returns traces for a service, optionally filtered by ok or error status. Read-only.",
    zodSchema: searchTracesSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const data = await observabilityService.searchTraces(input);
      return { summary: summarizeTraces(data, input.status), data };
    },
  }),

  get_trace: defineTool({
    name: "get_trace",
    title: "Inspect traces",
    description: "Returns a full trace and span hierarchy by id (unique prefix accepted). Read-only.",
    zodSchema: getTraceSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const data = await observabilityService.getTrace(input.traceId);
      return { summary: summarizeTrace(data), data };
    },
  }),

  get_deployments: defineTool({
    name: "get_deployments",
    title: "Inspect deployments",
    description: "Returns recent deployments for a service, newest first. Read-only.",
    zodSchema: getDeploymentsSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const data = await observabilityService.getDeployments(input.service, input.limit);
      return { summary: summarizeDeployments(data, input.service), data };
    },
  }),

  compare_periods: defineTool({
    name: "compare_periods",
    title: "Compare periods",
    description:
      "Returns baseline vs incident-window averages for a metric, including delta and percentage change. Read-only.",
    zodSchema: comparePeriodsSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const data = await observabilityService.comparePeriods(input);
      return { summary: summarizeComparison(data), data };
    },
  }),

  propose_rollback: defineTool({
    name: "propose_rollback",
    title: "Propose rollback",
    description:
      "Opens a human approval dialog for rolling a service to a prior version. Does not mutate telemetry or execute the rollback.",
    zodSchema: proposeRollbackSchema,
    readOnly: false,
    category: "operations",
    handler: async (input) => {
      const store = useIncidentStore.getState();
      store.setPendingAction({
        id: `rollback-${input.service}-${input.targetVersion}`,
        tool: "rollback_deployment",
        title: `Rollback ${input.service}`,
        reason: input.reason,
        params: {
          service: input.service,
          targetVersion: input.targetVersion,
        },
      });
      return {
        summary: `Waiting for human approval to roll ${input.service} to ${input.targetVersion}`,
        data: {
          service: input.service,
          targetVersion: input.targetVersion,
          status: "pending_approval",
        },
      };
    },
  }),

  rollback_deployment: defineTool({
    name: "rollback_deployment",
    title: "Rollback deployment",
    description:
      "Rolls a service to a prior version. Requires a matching approved pending action for the same service and target version. Does not execute otherwise.",
    zodSchema: rollbackDeploymentSchema,
    readOnly: false,
    category: "operations",
    handler: async (input) => {
      if (!isRollbackApproved(input)) {
        return {
          summary: `Rollback of ${input.service} to ${input.targetVersion} requires approval`,
          error: {
            code: "APPROVAL_REQUIRED",
            message: `rollback_deployment is not approved for ${input.service} → ${input.targetVersion}`,
          },
        };
      }
      const data = await observabilityService.rollbackDeployment(input);
      const store = useIncidentStore.getState();
      store.triggerRecovery();
      store.setPendingAction(undefined);
      return {
        summary: `Rolled back ${data.service} from ${data.fromVersion} to ${data.toVersion}`,
        data,
      };
    },
  }),

  add_incident_note: defineTool({
    name: "add_incident_note",
    title: "Add incident note",
    description: "Appends a note to an incident timeline. Does not execute a deployment change.",
    zodSchema: addIncidentNoteSchema,
    readOnly: false,
    category: "operations",
    handler: async (input) => {
      const data = await observabilityService.addIncidentNote(input);
      return {
        summary: `Added note to incident ${input.incidentId}`,
        data,
      };
    },
  }),
};
