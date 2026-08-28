export type Severity = "SEV-1" | "SEV-2" | "SEV-3";

export type IncidentStatus =
  | "investigating"
  | "identified"
  | "action_pending"
  | "remediating"
  | "monitoring"
  | "resolved";

export type ServiceStatus = "healthy" | "degraded" | "critical";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export type TelemetryStatus = "ok" | "error";

export type MetricName =
  | "error_rate"
  | "request_rate"
  | "p50_latency"
  | "p95_latency"
  | "p99_latency"
  | "db_latency";

/** Domain tools registered on document.modelContext. `propose_rollback` is the WebMCP-safe write that opens human approval. */
export type ToolName =
  | "get_incident"
  | "get_service"
  | "query_metrics"
  | "search_logs"
  | "search_traces"
  | "get_trace"
  | "get_deployments"
  | "compare_periods"
  | "propose_rollback"
  | "rollback_deployment"
  | "add_incident_note";

export type AgentStatus = "idle" | "investigating" | "waiting" | "complete";

export type AgentActivityStatus = "running" | "success" | "error";

export type AgentMessageKind =
  | "status"
  | "tool"
  | "finding"
  | "hypothesis"
  | "question"
  | "action_proposal";

export type EvidenceType =
  | "metric"
  | "trace"
  | "log"
  | "deployment"
  | "comparison";

export type HypothesisStatus = "active" | "rejected" | "confirmed";

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  service: string;
  status: IncidentStatus;
  startedAt: string;
  description: string;
  errorRate: number;
  p95Latency: number;
  requestRate: number;
  affectedUsersPercent: number;
}

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  dependencies: string[];
  errorRate: number;
  p95Latency: number;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface MetricResult {
  metric: MetricName;
  unit: string;
  points: MetricPoint[];
}

export interface LogEntry {
  timestamp: string;
  service: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  spanId?: string;
}

export interface Span {
  spanId: string;
  parentSpanId?: string;
  service: string;
  operation: string;
  duration: number;
  status: TelemetryStatus;
}

export interface Trace {
  traceId: string;
  service: string;
  duration: number;
  status: TelemetryStatus;
  timestamp: string;
  spans: Span[];
}

export interface Deployment {
  id: string;
  service: string;
  version: string;
  timestamp: string;
  commit: string;
  summary: string;
}

export interface ComparisonResult {
  metric: MetricName;
  baselineAverage: number;
  incidentAverage: number;
  delta: number;
  percentageChange: number;
}

export interface RollbackResult {
  service: string;
  fromVersion: string;
  toVersion: string;
  completedAt: string;
}

export interface MetricQuery {
  service: string;
  metric: MetricName;
  startTime: string;
  endTime: string;
}

export interface LogQuery {
  service: string;
  query?: string;
  startTime: string;
  endTime: string;
  limit?: number;
  traceId?: string;
}

export interface TraceQuery {
  service: string;
  status?: TelemetryStatus;
  startTime: string;
  endTime: string;
  limit?: number;
}

export interface CompareQuery {
  service: string;
  metric: MetricName;
  baselineStart: string;
  baselineEnd: string;
  incidentStart: string;
  incidentEnd: string;
}

export interface RollbackParams {
  service: string;
  targetVersion: string;
}

export interface AddNoteParams {
  incidentId: string;
  note: string;
}

export interface ObservabilityService {
  getIncident(id: string): Promise<Incident>;
  getService(id: string): Promise<Service>;
  queryMetrics(params: MetricQuery): Promise<MetricResult>;
  searchLogs(params: LogQuery): Promise<LogEntry[]>;
  searchTraces(params: TraceQuery): Promise<Trace[]>;
  getTrace(id: string): Promise<Trace>;
  getDeployments(service: string, limit?: number): Promise<Deployment[]>;
  comparePeriods(params: CompareQuery): Promise<ComparisonResult>;
  rollbackDeployment(params: RollbackParams): Promise<RollbackResult>;
  addIncidentNote(params: AddNoteParams): Promise<{ ok: true }>;
  reset(): void;
}

export interface AgentActivity {
  id: string;
  timestamp: string;
  tool: ToolName;
  status: AgentActivityStatus;
  summary: string;
  result?: unknown;
}

export interface AgentMessage {
  id: string;
  timestamp: string;
  kind: AgentMessageKind;
  text: string;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  summary: string;
  confidence: number;
  reference: {
    type: EvidenceType;
    id: string;
  };
}

export interface Hypothesis {
  id: string;
  title: string;
  confidence: number;
  status: HypothesisStatus;
  evidenceIds: string[];
}

export interface PendingAction {
  id: string;
  tool: "rollback_deployment";
  title: string;
  reason: string;
  params: RollbackParams;
}

export interface AppState {
  selectedIncidentId: string;
  incidentStatus: IncidentStatus;
  workspaceTab: WorkspaceTab;
  selectedTraceId: string | null;
  selectedLogTraceId: string | null;
  agent: {
    status: AgentStatus;
    messages: AgentMessage[];
    activities: AgentActivity[];
    hypotheses: Hypothesis[];
    evidence: Evidence[];
    progressStep: number;
  };
  telemetry: {
    recoveryTriggered: boolean;
  };
  approval: {
    pendingAction?: PendingAction;
    approved: boolean;
  };
}

export type WorkspaceTab =
  | "overview"
  | "metrics"
  | "timeline"
  | "traces"
  | "logs"
  | "deployments";
