import { SERVICE_IDS, TOOL_LATENCY_MS } from "@/lib/constants";
import { isFastTelemetry } from "@/lib/fast-telemetry";
import { averageMetric, buildMetricSeries, metricUnit } from "@/data/metrics";
import type { SeededTrace } from "@/data/seeded-types";
import type {
  AddNoteParams,
  CompareQuery,
  ComparisonResult,
  Deployment,
  Incident,
  LogEntry,
  LogQuery,
  MetricQuery,
  MetricResult,
  ObservabilityService,
  RollbackParams,
  RollbackResult,
  Service,
  ToolName,
  Trace,
  TraceQuery,
} from "@/types";
import { telemetryEngine } from "./engine";
import { invalidArgument, notFound } from "./errors";

const SERVICE_ID_SET = new Set<string>(SERVICE_IDS);

function requireService(id: string): void {
  if (!SERVICE_ID_SET.has(id)) {
    throw notFound("service", id);
  }
}

function parseRange(startTime: string, endTime: string, label: string): { start: number; end: number } {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw invalidArgument(`invalid ${label} timestamps`, { startTime, endTime });
  }
  if (end < start) {
    throw invalidArgument(`${label} endTime must be >= startTime`, { startTime, endTime });
  }
  return { start, end };
}

function inRange(iso: string, start: number, end: number): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= start && t <= end;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toPublicTrace(trace: SeededTrace): Trace {
  return clone(trace);
}

class IncidentObservabilityService implements ObservabilityService {
  async getIncident(id: string): Promise<Incident> {
    const incident = telemetryEngine.getSnapshot().incidents.find((row) => row.id === id);
    if (!incident) {
      throw notFound("incident", id);
    }
    return clone(incident);
  }

  async getService(id: string): Promise<Service> {
    requireService(id);
    const service = telemetryEngine.getSnapshot().services.find((row) => row.id === id);
    if (!service) {
      throw notFound("service", id);
    }
    return clone(service);
  }

  async queryMetrics(params: MetricQuery): Promise<MetricResult> {
    requireService(params.service);
    parseRange(params.startTime, params.endTime, "metric");
    const points = buildMetricSeries(
      params.service,
      params.metric,
      params.startTime,
      params.endTime,
      telemetryEngine.isRecoveryTriggered(),
    );
    return {
      metric: params.metric,
      unit: metricUnit(params.metric),
      points,
    };
  }

  async searchLogs(params: LogQuery): Promise<LogEntry[]> {
    requireService(params.service);
    const { start, end } = parseRange(params.startTime, params.endTime, "log");
    const needle = params.query?.trim().toLowerCase() ?? "";
    const matched = telemetryEngine.getSnapshot().logs.filter((log) => {
      if (log.service !== params.service) {
        return false;
      }
      if (!inRange(log.timestamp, start, end)) {
        return false;
      }
      if (params.traceId && log.traceId !== params.traceId) {
        return false;
      }
      if (needle && !log.message.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
    const limited = params.limit === undefined ? matched : matched.slice(0, Math.max(0, params.limit));
    return clone(limited);
  }

  async searchTraces(params: TraceQuery): Promise<Trace[]> {
    requireService(params.service);
    const { start, end } = parseRange(params.startTime, params.endTime, "trace");
    const matched = telemetryEngine.getSnapshot().traces.filter((trace) => {
      if (trace.service !== params.service) {
        return false;
      }
      if (params.status && trace.status !== params.status) {
        return false;
      }
      if (!inRange(trace.timestamp, start, end)) {
        return false;
      }
      return true;
    });
    const limited = params.limit === undefined ? matched : matched.slice(0, Math.max(0, params.limit));
    return limited.map(toPublicTrace);
  }

  async getTrace(id: string): Promise<Trace> {
    if (!id) {
      throw invalidArgument("trace id is required");
    }
    const traces = telemetryEngine.getSnapshot().traces;
    const exact = traces.find((trace) => trace.traceId === id);
    if (exact) {
      return toPublicTrace(exact);
    }
    const prefixHits = traces.filter((trace) => trace.traceId.startsWith(id));
    if (prefixHits.length === 1 && prefixHits[0]) {
      return toPublicTrace(prefixHits[0]);
    }
    throw notFound("trace", id);
  }

  async getDeployments(service: string, limit?: number): Promise<Deployment[]> {
    requireService(service);
    const rows = telemetryEngine
      .getSnapshot()
      .deployments.filter((d) => d.service === service)
      .slice()
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const limited = limit === undefined ? rows : rows.slice(0, Math.max(0, limit));
    return clone(limited);
  }

  async comparePeriods(params: CompareQuery): Promise<ComparisonResult> {
    requireService(params.service);
    parseRange(params.baselineStart, params.baselineEnd, "baseline");
    parseRange(params.incidentStart, params.incidentEnd, "incident");
    const recovery = telemetryEngine.isRecoveryTriggered();
    const baselineAverage = averageMetric(
      params.service,
      params.metric,
      params.baselineStart,
      params.baselineEnd,
      recovery,
    );
    const incidentAverage = averageMetric(
      params.service,
      params.metric,
      params.incidentStart,
      params.incidentEnd,
      recovery,
    );
    if (!Number.isFinite(baselineAverage) || !Number.isFinite(incidentAverage)) {
      throw invalidArgument("comparePeriods windows contain no metric points", {
        service: params.service,
        metric: params.metric,
      });
    }
    const delta = incidentAverage - baselineAverage;
    const percentageChange = baselineAverage === 0 ? (incidentAverage === 0 ? 0 : Number.POSITIVE_INFINITY) : (delta / baselineAverage) * 100;
    return {
      metric: params.metric,
      baselineAverage,
      incidentAverage,
      delta,
      percentageChange,
    };
  }

  async rollbackDeployment(params: RollbackParams): Promise<RollbackResult> {
    requireService(params.service);
    return telemetryEngine.rollback(params);
  }

  async addIncidentNote(params: AddNoteParams): Promise<{ ok: true }> {
    telemetryEngine.addNote(params.incidentId, params.note);
    return { ok: true };
  }

  reset(): void {
    telemetryEngine.reset();
  }
}

export const observabilityService: ObservabilityService = new IncidentObservabilityService();

export async function withLatency<T>(tool: ToolName, fn: () => T | Promise<T>): Promise<T> {
  const delay = isFastTelemetry() ? 0 : TOOL_LATENCY_MS[tool];
  if (delay > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delay);
    });
  }
  return fn();
}

export { TelemetryError } from "./errors";
export { telemetryEngine } from "./engine";
