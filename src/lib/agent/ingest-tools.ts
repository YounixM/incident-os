import { PRIMARY_SERVICE_ID, PRIMARY_VERSION } from "@/lib/constants";
import { REPRESENTATIVE_TRACE_ID } from "@/data/story";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { deploymentsFromResult, type ToolExecuteResult } from "@/lib/webmcp/tools";
import type {
  ComparisonResult,
  Evidence,
  Hypothesis,
  MetricName,
  ToolName,
  Trace,
} from "@/types";
import { nextAgentId } from "./clock";
import { addAgentMessage } from "./messages";
import { startRecoveryWatch } from "./recovery-watch";
import { buildRollbackAction } from "./run-options";

function requireData<T>(result: ToolExecuteResult): T | undefined {
  if (!result.ok || result.data === undefined) {
    return undefined;
  }
  return result.data as T;
}

function bumpProgress(step: number): void {
  const store = useIncidentStore.getState();
  if (store.agent.progressStep < step) {
    store.setProgressStep(step);
  }
}

function openExternalRollbackApproval(): void {
  const store = useIncidentStore.getState();
  if (store.agent.status !== "idle") {
    return;
  }
  if (store.approval.pendingAction || store.telemetry.recoveryTriggered) {
    return;
  }
  if (store.incidentStatus !== "identified" && store.incidentStatus !== "action_pending") {
    return;
  }
  store.setPendingAction(buildRollbackAction());
}

function evidenceKey(evidence: Omit<Evidence, "id">): string {
  return `${evidence.reference.type}:${evidence.reference.id}:${evidence.title}`;
}

function addEvidenceOnce(evidence: Omit<Evidence, "id">): string {
  const store = useIncidentStore.getState();
  const key = evidenceKey(evidence);
  const existing = store.agent.evidence.find((row) => evidenceKey(row) === key);
  if (existing) {
    return existing.id;
  }
  const id = nextAgentId("ev");
  store.addEvidence({ ...evidence, id });
  return id;
}

function dbShare(trace: Trace): number | undefined {
  const db = trace.spans.find((span) => span.operation === "db.query");
  if (!db || trace.duration <= 0) {
    return undefined;
  }
  return Math.round((db.duration / trace.duration) * 100);
}

function readMetric(input: unknown): MetricName | undefined {
  if (!input || typeof input !== "object" || !("metric" in input)) {
    return undefined;
  }
  const metric = (input as { metric?: unknown }).metric;
  return typeof metric === "string" ? (metric as MetricName) : undefined;
}

function readService(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || !("service" in input)) {
    return undefined;
  }
  const service = (input as { service?: unknown }).service;
  return typeof service === "string" ? service : undefined;
}

function ensureBaseHypotheses(): Hypothesis[] {
  const store = useIncidentStore.getState();
  if (store.agent.hypotheses.length > 0) {
    return store.agent.hypotheses;
  }
  const evidenceIds = store.agent.evidence.map((row) => row.id);
  const hypotheses: Hypothesis[] = [
    {
      id: "hyp-db-regression",
      title: "Database query regression",
      confidence: 0.92,
      status: "active",
      evidenceIds,
    },
    {
      id: "hyp-payment-latency",
      title: "Payment-service latency",
      confidence: 0.28,
      status: "active",
      evidenceIds: [],
    },
    {
      id: "hyp-traffic-spike",
      title: "Traffic spike",
      confidence: 0.07,
      status: "active",
      evidenceIds: [],
    },
  ];
  store.setHypotheses(hypotheses);
  return hypotheses;
}

function patchHypothesis(
  id: string,
  patch: Partial<Pick<Hypothesis, "status" | "confidence" | "evidenceIds">>,
): void {
  const store = useIncidentStore.getState();
  const current = store.agent.hypotheses.length > 0 ? store.agent.hypotheses : ensureBaseHypotheses();
  store.setHypotheses(
    current.map((hypothesis) => {
      if (hypothesis.id !== id) {
        return hypothesis;
      }
      return {
        ...hypothesis,
        ...patch,
        evidenceIds: patch.evidenceIds ?? hypothesis.evidenceIds,
      };
    }),
  );
}

export function hasCoreInvestigationEvidence(): boolean {
  const { evidence } = useIncidentStore.getState().agent;
  const hasDeployment = evidence.some((row) => row.type === "deployment");
  const hasTrace = evidence.some((row) => row.type === "trace");
  const hasMetric = evidence.some((row) => row.type === "metric" || row.type === "comparison");
  return hasDeployment && hasTrace && hasMetric;
}

export function hasTrafficComparisonEvidence(): boolean {
  return useIncidentStore.getState().agent.evidence.some(
    (row) => row.type === "comparison" && row.reference.id === "request_rate",
  );
}

export function ingestSuccessfulTool(
  name: ToolName,
  input: unknown,
  result: ToolExecuteResult,
): void {
  if (!result.ok) {
    return;
  }

  switch (name) {
    case "get_investigation_context":
      bumpProgress(1);
      addAgentMessage("finding", result.summary);
      break;
    case "get_incident":
      bumpProgress(1);
      addAgentMessage("finding", result.summary);
      break;
    case "get_service": {
      bumpProgress(1);
      const service = readService(input);
      if (service && service !== PRIMARY_SERVICE_ID) {
        addAgentMessage("finding", result.summary);
        if (service === "payment-service") {
          patchHypothesis("hyp-payment-latency", { confidence: 0.18, status: "rejected" });
        }
      }
      break;
    }
    case "query_metrics": {
      bumpProgress(2);
      const metric = readMetric(input);
      const service = readService(input);
      if (metric === "error_rate" && service === PRIMARY_SERVICE_ID) {
        addAgentMessage("finding", result.summary);
        addEvidenceOnce({
          type: "metric",
          title: "Error rate increased at 13:50",
          summary: result.summary,
          confidence: 0.95,
          reference: { type: "metric", id: "error_rate" },
        });
      }
      break;
    }
    case "get_deployments": {
      bumpProgress(3);
      const deployments = deploymentsFromResult(result.data);
      const correlated =
        deployments.find(
          (row) => row.service === PRIMARY_SERVICE_ID && row.version === PRIMARY_VERSION,
        ) ?? deployments[0];
      addAgentMessage("finding", result.summary);
      addEvidenceOnce({
        type: "deployment",
        title: `${PRIMARY_VERSION} deployed at 13:45`,
        summary: correlated?.summary ?? result.summary,
        confidence: 0.9,
        reference: { type: "deployment", id: `deploy-${PRIMARY_SERVICE_ID}-${PRIMARY_VERSION}` },
      });
      break;
    }
    case "search_traces":
      bumpProgress(4);
      addAgentMessage("finding", result.summary);
      addEvidenceOnce({
        type: "trace",
        title: "Failed traces cluster on db.query",
        summary: result.summary,
        confidence: 0.88,
        reference: { type: "trace", id: REPRESENTATIVE_TRACE_ID },
      });
      break;
    case "get_trace": {
      bumpProgress(5);
      const trace = requireData<Trace>(result);
      const share = trace ? dbShare(trace) : undefined;
      addAgentMessage("finding", result.summary);
      addEvidenceOnce({
        type: "trace",
        title:
          share !== undefined
            ? `DB query consumes ${share}% of representative trace`
            : "Database span dominates the failed trace",
        summary: result.summary,
        confidence: 0.94,
        reference: { type: "trace", id: REPRESENTATIVE_TRACE_ID },
      });
      break;
    }
    case "search_logs":
      bumpProgress(5);
      openExternalRollbackApproval();
      break;
    case "compare_periods": {
      bumpProgress(6);
      const metric = readMetric(input);
      const compare = requireData<ComparisonResult>(result);
      addAgentMessage("finding", result.summary);
      if (metric === "error_rate") {
        addEvidenceOnce({
          type: "comparison",
          title: "Error rate is far above the pre-deploy baseline",
          summary: result.summary,
          confidence: 0.93,
          reference: { type: "comparison", id: "error_rate" },
        });
        ensureBaseHypotheses();
        useIncidentStore.getState().setIncidentStatus("identified");
        openExternalRollbackApproval();
      }
      if (metric === "request_rate" && compare) {
        const trafficEvidenceId = addEvidenceOnce({
          type: "comparison",
          title: "Traffic rise is too small to explain errors",
          summary: result.summary,
          confidence: 0.9,
          reference: { type: "comparison", id: "request_rate" },
        });
        const store = useIncidentStore.getState();
        const hypotheses =
          store.agent.hypotheses.length > 0 ? store.agent.hypotheses : ensureBaseHypotheses();
        store.setHypotheses(
          hypotheses.map((hypothesis) => {
            if (hypothesis.id === "hyp-traffic-spike") {
              return {
                ...hypothesis,
                status: "rejected",
                evidenceIds: [...hypothesis.evidenceIds, trafficEvidenceId],
              };
            }
            if (hypothesis.id === "hyp-db-regression") {
              return { ...hypothesis, status: "confirmed" };
            }
            return hypothesis;
          }),
        );
        openExternalRollbackApproval();
      }
      break;
    }
    case "propose_rollback":
      bumpProgress(7);
      addAgentMessage("action_proposal", result.summary);
      break;
    case "rollback_deployment":
      bumpProgress(7);
      addAgentMessage("status", result.summary);
      addAgentMessage("finding", "Error rate 18.4% to 1.1%. p95 2.8s to 430ms.");
      void startRecoveryWatch();
      break;
    case "add_incident_note":
      openExternalRollbackApproval();
      break;
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}
