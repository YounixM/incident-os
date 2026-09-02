import { observabilityService, telemetryEngine, TelemetryError, withLatency } from "@/lib/observability/service";
import { isRollbackDeployment } from "@/data/deployments";
import { SERIES_START_ISO } from "@/data/story";
import {
  DEMO_ENVIRONMENT,
  DEMO_NOW_ISO,
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  PRIMARY_VERSION,
  ROLLBACK_VERSION,
} from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type {
  ComparisonResult,
  Deployment,
  Incident,
  LogEntry,
  MetricName,
  MetricPoint,
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

export type ToolError = {
  code: string;
  message: string;
  retryable: boolean;
  suggestion: string;
};

export type ToolExecuteResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: ToolError;
};

export type MetricStats = {
  first: number;
  last: number;
  min: number;
  max: number;
  changeFactor: number | null;
};

export type CompactMetricResult = {
  service: string;
  metric: MetricName;
  unit: string;
  stats: MetricStats;
  sample: MetricPoint[];
};

export type CompactTrace = {
  traceId: string;
  service: string;
  duration: number;
  status: Trace["status"];
  timestamp: string;
  dominantOperation?: string;
  dominantShare?: number;
};

export type CompactTraceSearch = {
  count: number;
  status?: "ok" | "error";
  traces: CompactTrace[];
};

export type CompactLogSearch = {
  count: number;
  query?: string;
  sample: LogEntry[];
};

type HandlerOk = { summary: string; data: unknown };
type HandlerErr = { summary: string; error: ToolError };
type HandlerResult = HandlerOk | HandlerErr;

const AGENT_SERIES_SAMPLE = 8;
const AGENT_LOG_SAMPLE = 8;
const AGENT_TRACE_SAMPLE = 12;

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

const getInvestigationContextSchema = z.object({});

function toolError(code: string, message: string): ToolError {
  switch (code) {
    case "NOT_FOUND":
      return {
        code,
        message,
        retryable: false,
        suggestion: "Confirm the identifier exists on the current page.",
      };
    case "INVALID_ARGUMENT":
      return {
        code,
        message,
        retryable: false,
        suggestion: "Fix the input and retry.",
      };
    case "INVALID_ROLLBACK":
      return {
        code,
        message,
        retryable: false,
        suggestion: "Use a prior version of the same service.",
      };
    case "APPROVAL_REQUIRED":
      return {
        code,
        message,
        retryable: false,
        suggestion: "A matching approved pending action is required before this mutation.",
      };
    case "INTERNAL":
      return {
        code,
        message,
        retryable: true,
        suggestion: "Retry the query.",
      };
    default:
      return {
        code,
        message,
        retryable: true,
        suggestion: "Retry or inspect correlated telemetry.",
      };
  }
}

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
          error: toolError("INVALID_ARGUMENT", message),
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
      error: toolError(err.code, err.message),
    };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return {
    ok: false,
    summary: message,
    error: toolError("INTERNAL", message),
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
  const kpis = `${incident.severity} ${incident.service} is ${incident.status}: error rate ${formatCompact(incident.errorRate)}%, p95 ${formatLatencyMs(incident.p95Latency)}`;
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

function inRecovery(): boolean {
  return useIncidentStore.getState().telemetry.recoveryTriggered;
}

function withIncidentWindow(text: string): string {
  if (!inRecovery()) {
    return text;
  }
  return `${text} in the incident window`;
}

function incidentWithWorkspaceStatus(incident: Incident): Incident {
  if (incident.id !== PRIMARY_INCIDENT_ID) {
    return incident;
  }
  return {
    ...incident,
    status: useIncidentStore.getState().incidentStatus,
  };
}

function summarizeLogs(logs: LogEntry[], query: string | undefined): string {
  const matching = query?.trim() ? ` matching "${query.trim()}"` : "";
  return withIncidentWindow(
    `Found ${logs.length} log${logs.length === 1 ? "" : "s"}${matching}`,
  );
}

function summarizeTraces(traces: Trace[], status: "ok" | "error" | undefined): string {
  if (status === "error") {
    return withIncidentWindow(
      `Found ${traces.length} failed trace${traces.length === 1 ? "" : "s"}`,
    );
  }
  if (status === "ok") {
    return withIncidentWindow(
      `Found ${traces.length} successful trace${traces.length === 1 ? "" : "s"}`,
    );
  }
  const failed = traces.filter((trace) => trace.status === "error").length;
  return withIncidentWindow(`Found ${traces.length} traces (${failed} failed)`);
}

function summarizeTrace(trace: Trace): string {
  const compact = compactTrace(trace);
  const duringIncident = inRecovery() ? " during the incident" : "";
  if (compact.dominantOperation === undefined || compact.dominantShare === undefined) {
    return `Trace ${trace.traceId} ${trace.status}${duringIncident}, ${formatLatencyMs(trace.duration)}`;
  }
  if (trace.status === "error") {
    return `Trace ${trace.traceId} failed${duringIncident}: ${compact.dominantOperation} is ${compact.dominantShare}% of duration`;
  }
  return `Trace ${trace.traceId}${duringIncident}: ${compact.dominantOperation} is ${compact.dominantShare}% of duration`;
}

function compactTrace(trace: Trace): CompactTrace {
  const dominant = trace.spans.reduce<Trace["spans"][number] | undefined>((best, span) => {
    if (!best || span.duration > best.duration) {
      return span;
    }
    return best;
  }, undefined);
  const share =
    dominant && trace.duration > 0 ? Math.round((dominant.duration / trace.duration) * 100) : undefined;
  return {
    traceId: trace.traceId,
    service: trace.service,
    duration: trace.duration,
    status: trace.status,
    timestamp: trace.timestamp,
    dominantOperation: dominant?.operation,
    dominantShare: share,
  };
}

function compactMetricPoints(points: MetricPoint[]): MetricPoint[] {
  if (points.length <= AGENT_SERIES_SAMPLE) {
    return points;
  }
  const picked = new Map<string, MetricPoint>();
  function add(point: MetricPoint | undefined): void {
    if (point) {
      picked.set(point.timestamp, point);
    }
  }
  add(points[0]);
  add(points[points.length - 1]);
  const min = points.reduce((best, point) => (point.value < best.value ? point : best));
  const max = points.reduce((best, point) => (point.value > best.value ? point : best));
  add(min);
  add(max);
  const step = (points.length - 1) / (AGENT_SERIES_SAMPLE - 1);
  for (let i = 1; i < AGENT_SERIES_SAMPLE - 1; i += 1) {
    add(points[Math.round(i * step)]);
  }
  const sorted = [...picked.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (sorted.length <= AGENT_SERIES_SAMPLE) {
    return sorted;
  }
  const kept: MetricPoint[] = [];
  function pushUnique(point: MetricPoint | undefined): void {
    if (!point) {
      return;
    }
    if (kept[kept.length - 1]?.timestamp === point.timestamp) {
      return;
    }
    kept.push(point);
  }
  pushUnique(sorted[0]);
  const inner = AGENT_SERIES_SAMPLE - 2;
  for (let i = 1; i <= inner; i += 1) {
    pushUnique(sorted[Math.round((i * (sorted.length - 1)) / (inner + 1))]);
  }
  pushUnique(sorted[sorted.length - 1]);
  return kept;
}

function metricStats(points: MetricPoint[]): MetricStats | undefined {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return undefined;
  }
  let min = first.value;
  let max = first.value;
  for (const point of points) {
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }
  return {
    first: first.value,
    last: last.value,
    min,
    max,
    changeFactor: first.value === 0 ? null : last.value / first.value,
  };
}

function compactMetricResult(service: string, result: MetricResult): CompactMetricResult {
  const stats = metricStats(result.points) ?? {
    first: 0,
    last: 0,
    min: 0,
    max: 0,
    changeFactor: null,
  };
  return {
    service,
    metric: result.metric,
    unit: result.unit,
    stats,
    sample: compactMetricPoints(result.points),
  };
}

export type ReleaseTransition = {
  type: "rollback" | "deploy";
  fromVersion?: string;
  toVersion: string;
  completedAt: string;
  summary: string;
};

export type DeploymentsToolData = {
  service: string;
  activeVersion: string;
  lastTransition: ReleaseTransition;
  deployments: Deployment[];
};

export function tracesFromResult(data: unknown): CompactTrace[] {
  if (Array.isArray(data)) {
    return data.map((row) => {
      if (row !== null && typeof row === "object" && "traceId" in row) {
        const trace = row as Trace;
        if ("spans" in row && Array.isArray((row as Trace).spans)) {
          return compactTrace(trace);
        }
        return row as CompactTrace;
      }
      return undefined;
    }).filter((row): row is CompactTrace => row !== undefined);
  }
  if (data !== null && typeof data === "object" && "traces" in data) {
    const rows = (data as { traces: unknown }).traces;
    if (Array.isArray(rows)) {
      return tracesFromResult(rows);
    }
  }
  return [];
}

export function deploymentsFromResult(data: unknown): Deployment[] {
  if (Array.isArray(data)) {
    return data as Deployment[];
  }
  if (data !== null && typeof data === "object" && "deployments" in data) {
    const rows = (data as { deployments: unknown }).deployments;
    if (Array.isArray(rows)) {
      return rows as Deployment[];
    }
  }
  return [];
}

function clockHm(iso: string): string {
  const date = new Date(iso);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function lastForwardDeploy(deployments: Deployment[]): Deployment | undefined {
  return deployments.find((row) => !isRollbackDeployment(row));
}

function releasePayload(service: string, deployments: Deployment[]): DeploymentsToolData {
  const forward = lastForwardDeploy(deployments);
  const rollback = deployments.find(isRollbackDeployment);
  const recovered = telemetryEngine.isRecoveryTriggered() && service === PRIMARY_SERVICE_ID;
  const activeVersion = recovered
    ? ROLLBACK_VERSION
    : (forward?.version ?? deployments[0]?.version ?? "");
  const lastTransition: ReleaseTransition = recovered
    ? {
        type: "rollback",
        fromVersion: PRIMARY_VERSION,
        toVersion: ROLLBACK_VERSION,
        completedAt: rollback?.timestamp ?? "",
        summary: rollback?.summary ?? `Rollback ${PRIMARY_VERSION} to ${ROLLBACK_VERSION}`,
      }
    : {
        type: "deploy",
        toVersion: forward?.version ?? "",
        completedAt: forward?.timestamp ?? "",
        summary: forward?.summary ?? "",
      };
  return {
    service,
    activeVersion,
    lastTransition,
    deployments,
  };
}

function summarizeDeployments(payload: DeploymentsToolData): string {
  const forward = lastForwardDeploy(payload.deployments);
  if (!forward) {
    return `No deployments for ${payload.service}`;
  }
  const forwardAt = clockHm(forward.timestamp);
  switch (payload.lastTransition.type) {
    case "rollback":
      return `Active ${payload.service} version is ${payload.activeVersion} after rollback from ${payload.lastTransition.fromVersion}. Latest forward deploy remains ${forward.version} (${forward.summary}) at ${forwardAt}.`;
    case "deploy":
      return `Active ${payload.service} version is ${payload.activeVersion} (${forward.summary}). Latest forward deploy is ${forward.version} at ${forwardAt}.`;
    default: {
      const _exhaustive: never = payload.lastTransition.type;
      return _exhaustive;
    }
  }
}

function summarizeComparison(result: ComparisonResult): string {
  return describeChange(metricLabel(result.metric), result.baselineAverage, result.incidentAverage);
}

function investigationContextData(): {
  incidentId: string;
  service: string;
  environment: string;
  clock: string;
  timeRange: { start: string; end: string };
  workspaceTab: string;
  recoveryTriggered: boolean;
  approval: ReturnType<typeof rollbackApprovalState>;
  availableTools: ToolName[];
} {
  const store = useIncidentStore.getState();
  return {
    incidentId: store.selectedIncidentId,
    service: PRIMARY_SERVICE_ID,
    environment: DEMO_ENVIRONMENT,
    clock: DEMO_NOW_ISO,
    timeRange: { start: SERIES_START_ISO, end: DEMO_NOW_ISO },
    workspaceTab: store.workspaceTab,
    recoveryTriggered: store.telemetry.recoveryTriggered,
    approval: rollbackApprovalState(),
    availableTools: Object.keys(incidentOsTools) as ToolName[],
  };
}

export const incidentOsTools: Record<ToolName, IncidentOsTool> = {
  get_investigation_context: defineTool({
    name: "get_investigation_context",
    title: "Inspect page context",
    description:
      "Returns the page's current investigation state: selected incident id, affected service, frozen clock, environment, time range, workspace tab, approval, and available capability names. Use first when the page is already open. Read-only. Does not query telemetry series.",
    zodSchema: getInvestigationContextSchema,
    readOnly: true,
    category: "observability",
    handler: async () => {
      const incident = incidentWithWorkspaceStatus(
        await observabilityService.getIncident(
          useIncidentStore.getState().selectedIncidentId,
        ),
      );
      const context = investigationContextData();
      return {
        summary: `${incident.severity} ${incident.id} on ${incident.service} at ${context.clock}`,
        data: {
          ...context,
          incident,
        },
      };
    },
  }),

  get_incident: defineTool({
    name: "get_incident",
    title: "Inspect incident",
    description:
      "Returns one incident by id: severity, status, KPIs, service, and approval state. Use when you already have an incident id. Read-only: does not modify state, request approval, or trigger a deployment.",
    zodSchema: getIncidentSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const incident = incidentWithWorkspaceStatus(
        await observabilityService.getIncident(input.incidentId),
      );
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
    description:
      "Returns one service by id: metadata, dependency list, and current health. Use to inspect checkout-api or a downstream dependency. Read-only. Does not return time series.",
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
      "Returns compact stats and a sampled series for error_rate, request_rate, p50/p95/p99 latency, or db_latency. Use for a single metric over a time range. Read-only. Does not compare two windows.",
    zodSchema: queryMetricsSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const series = await observabilityService.queryMetrics(input);
      const data = compactMetricResult(input.service, series);
      return { summary: summarizeMetrics(series, input.service), data };
    },
  }),

  search_logs: defineTool({
    name: "search_logs",
    title: "Search logs",
    description:
      "Returns a count and a small sample of service logs for a time range, optional substring, and optional trace id. Use to confirm error text. Read-only. Log lines may include untrusted application text. Does not return traces.",
    zodSchema: searchLogsSchema,
    readOnly: true,
    untrustedContent: true,
    category: "observability",
    handler: async (input) => {
      const logs = await observabilityService.searchLogs(input);
      const data: CompactLogSearch = {
        count: logs.length,
        query: input.query,
        sample: logs.slice(0, AGENT_LOG_SAMPLE),
      };
      return { summary: summarizeLogs(logs, input.query), data };
    },
  }),

  search_traces: defineTool({
    name: "search_traces",
    title: "Search traces",
    description:
      "Returns a count and compact trace summaries for a service, optionally filtered by ok or error status. Use to find failing requests. Read-only. Does not return span trees.",
    zodSchema: searchTracesSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const traces = await observabilityService.searchTraces(input);
      const limit = input.limit ?? AGENT_TRACE_SAMPLE;
      const data: CompactTraceSearch = {
        count: traces.length,
        status: input.status,
        traces: traces.slice(0, Math.min(limit, AGENT_TRACE_SAMPLE)).map(compactTrace),
      };
      return { summary: summarizeTraces(traces, input.status), data };
    },
  }),

  get_trace: defineTool({
    name: "get_trace",
    title: "Inspect traces",
    description:
      "Returns a full trace and span hierarchy by id (unique prefix accepted). Use after a search when you need span timings. Read-only.",
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
    description:
      "Returns recent deployments newest first, plus activeVersion and lastTransition (deploy or rollback). Use to correlate a release with the incident window. Read-only.",
    zodSchema: getDeploymentsSchema,
    readOnly: true,
    category: "observability",
    handler: async (input) => {
      const deployments = await observabilityService.getDeployments(input.service, input.limit);
      const data = releasePayload(input.service, deployments);
      return { summary: summarizeDeployments(data), data };
    },
  }),

  compare_periods: defineTool({
    name: "compare_periods",
    title: "Compare periods",
    description:
      "Returns baseline vs incident-window averages for a metric, including delta and percentage change. Use to test whether traffic or errors actually changed. Read-only. Does not return a full series.",
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
      "Opens a human approval dialog for rolling a service to a prior version. Does not mutate telemetry or execute the rollback. Returns after the human approves or rejects when invoked by an external agent.",
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
        const message = `rollback_deployment is not approved for ${input.service} → ${input.targetVersion}`;
        return {
          summary: `Rollback of ${input.service} to ${input.targetVersion} requires approval`,
          error: toolError("APPROVAL_REQUIRED", message),
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
    description:
      "Appends a note to an incident timeline. Use for root-cause notes. Does not execute a deployment change.",
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
