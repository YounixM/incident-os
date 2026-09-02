import { deploymentsFromResult, type ToolExecuteResult } from "@/lib/webmcp/tools";
import {
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  PRIMARY_VERSION,
  ROLLBACK_VERSION,
} from "@/lib/constants";
import { isFastTelemetry } from "@/lib/fast-telemetry";
import { REPRESENTATIVE_TRACE_ID } from "@/data/story";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type {
  ComparisonResult,
  Evidence,
  Hypothesis,
  MetricResult,
  Trace,
} from "@/types";
import { isAbortError, sleep, throwIfAborted } from "./abort";
import { nextAgentId, resetAgentClock } from "./clock";
import { peekInterrupt, takeInterrupt } from "./interrupts";
import { invokeIncidentTool } from "./invoke-tool";
import { addAgentMessage } from "./messages";
import { startRecoveryWatch } from "./recovery-watch";
import { runRedirectInvestigation } from "./redirect";
import { isTrafficPrompt } from "./redirect-kind";
import {
  TRAFFIC_CHALLENGE_CHIP,
  TRAFFIC_CHALLENGE_QUESTION,
  type ApprovalDecision,
  type DemoRunOptions,
} from "./run-options";
import { COMPARE_WINDOW, QUERY_WINDOW } from "./windows";

function requireData<T>(result: ToolExecuteResult): T {
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error?.message ?? result.summary);
  }
  return result.data as T;
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) {
    return "n/a";
  }
  const abs = Math.abs(n);
  return String(Number(n.toFixed(abs >= 100 ? 0 : 1)));
}

function addEvidenceItem(evidence: Omit<Evidence, "id">): string {
  const id = nextAgentId("ev");
  useIncidentStore.getState().addEvidence({ ...evidence, id });
  return id;
}

async function awaitChallenge(options: DemoRunOptions): Promise<string> {
  throwIfAborted(options.signal);
  if (options.autoChallenge) {
    return typeof options.autoChallenge === "string"
      ? options.autoChallenge
      : TRAFFIC_CHALLENGE_CHIP;
  }
  if (options.waitForChallenge) {
    return options.waitForChallenge();
  }
  return TRAFFIC_CHALLENGE_CHIP;
}

async function awaitApproval(options: DemoRunOptions): Promise<ApprovalDecision> {
  throwIfAborted(options.signal);
  if (options.autoApprove) {
    useIncidentStore.getState().approve();
    return "approved";
  }
  if (options.waitForApproval) {
    return options.waitForApproval();
  }
  return "approved";
}

function dbShare(trace: Trace): number | undefined {
  const db = trace.spans.find((span) => span.operation === "db.query");
  if (!db || trace.duration <= 0) {
    return undefined;
  }
  return Math.round((db.duration / trace.duration) * 100);
}

async function maybeHandleInterrupt(options: DemoRunOptions): Promise<void> {
  throwIfAborted(options.signal);
  const pending = peekInterrupt();
  if (!pending) {
    return;
  }
  if (isTrafficPrompt(pending)) {
    return;
  }
  const prompt = takeInterrupt();
  if (!prompt) {
    return;
  }
  await runRedirectInvestigation(prompt, options.signal);
}

async function runTool(
  name: Parameters<typeof invokeIncidentTool>[0],
  input: unknown,
  options: DemoRunOptions,
): Promise<ToolExecuteResult> {
  const result = await invokeIncidentTool(name, input, options.signal);
  await maybeHandleInterrupt(options);
  return result;
}

async function collectTrafficAnswer(options: DemoRunOptions): Promise<string> {
  while (true) {
    const challenge = await awaitChallenge(options);
    throwIfAborted(options.signal);
    if (options.autoChallenge || isTrafficPrompt(challenge)) {
      return challenge;
    }
    useIncidentStore.getState().setAgentStatus("investigating");
    await runRedirectInvestigation(challenge, options.signal);
    useIncidentStore.getState().setAgentStatus("waiting");
    addAgentMessage("question", TRAFFIC_CHALLENGE_QUESTION);
  }
}

async function runScript(options: DemoRunOptions): Promise<void> {
  const { signal } = options;
  const instant = options.instant || isFastTelemetry();
  const store = useIncidentStore.getState();

  store.setIncidentStatus("investigating");
  store.setAgentStatus("investigating");
  store.setProgressStep(0);
  addAgentMessage("status", "Gathering incident context.");

  throwIfAborted(signal);
  await maybeHandleInterrupt(options);

  const incidentResult = await runTool(
    "get_investigation_context",
    {},
    options,
  );
  requireData(incidentResult);

  const incidentLookup = await runTool(
    "get_incident",
    { incidentId: PRIMARY_INCIDENT_ID },
    options,
  );
  requireData(incidentLookup);

  const serviceResult = await runTool(
    "get_service",
    { service: PRIMARY_SERVICE_ID },
    options,
  );
  requireData(serviceResult);
  store.setProgressStep(1);

  addAgentMessage("status", "Checking error rate, latency, and request rate.");

  const errorMetrics = await runTool(
    "query_metrics",
    { service: PRIMARY_SERVICE_ID, metric: "error_rate", ...QUERY_WINDOW },
    options,
  );
  requireData<MetricResult>(errorMetrics);

  const latencyMetrics = await runTool(
    "query_metrics",
    { service: PRIMARY_SERVICE_ID, metric: "p95_latency", ...QUERY_WINDOW },
    options,
  );
  requireData(latencyMetrics);

  const dbLatencyMetrics = await runTool(
    "query_metrics",
    { service: PRIMARY_SERVICE_ID, metric: "db_latency", ...QUERY_WINDOW },
    options,
  );
  requireData(dbLatencyMetrics);

  const requestMetrics = await runTool(
    "query_metrics",
    { service: PRIMARY_SERVICE_ID, metric: "request_rate", ...QUERY_WINDOW },
    options,
  );
  requireData(requestMetrics);
  store.setProgressStep(2);
  addAgentMessage("finding", errorMetrics.summary);
  addAgentMessage("finding", dbLatencyMetrics.summary);

  const deploymentsResult = await runTool(
    "get_deployments",
    { service: PRIMARY_SERVICE_ID },
    options,
  );
  const deployments = deploymentsFromResult(deploymentsResult.data);
  const correlated =
    deployments.find((row) => row.version === PRIMARY_VERSION) ?? deployments[0];
  store.setProgressStep(3);
  addAgentMessage(
    "finding",
    correlated ? `${correlated.version} deployed before the error rise.` : deploymentsResult.summary,
  );

  const tracesResult = await runTool(
    "search_traces",
    {
      service: PRIMARY_SERVICE_ID,
      status: "error",
      ...QUERY_WINDOW,
    },
    options,
  );
  requireData<Trace[]>(tracesResult);
  store.setProgressStep(4);
  addAgentMessage("finding", tracesResult.summary);

  const traceResult = await runTool(
    "get_trace",
    { traceId: REPRESENTATIVE_TRACE_ID },
    options,
  );
  const trace = requireData<Trace>(traceResult);
  const share = dbShare(trace);

  const logsResult = await runTool(
    "search_logs",
    {
      service: PRIMARY_SERVICE_ID,
      query: "timeout",
      ...QUERY_WINDOW,
    },
    options,
  );
  requireData(logsResult);
  store.setProgressStep(5);
  addAgentMessage("finding", traceResult.summary);
  addAgentMessage("finding", logsResult.summary);

  const errorCompareResult = await runTool(
    "compare_periods",
    {
      service: PRIMARY_SERVICE_ID,
      metric: "error_rate",
      ...COMPARE_WINDOW,
    },
    options,
  );
  const errorCompare = requireData<ComparisonResult>(errorCompareResult);
  addAgentMessage("finding", errorCompareResult.summary);

  addAgentMessage("status", "Checking whether payment-service is the source.");
  const paymentServiceResult = await runTool(
    "get_service",
    { service: "payment-service" },
    options,
  );
  requireData(paymentServiceResult);
  const paymentLatencyResult = await runTool(
    "query_metrics",
    { service: "payment-service", metric: "p95_latency", ...QUERY_WINDOW },
    options,
  );
  requireData(paymentLatencyResult);
  addAgentMessage(
    "finding",
    "Payment-service latency is elevated but does not explain checkout-api 500s.",
  );

  const deployEvidenceId = addEvidenceItem({
    type: "deployment",
    title: `${PRIMARY_VERSION} deployed at 13:45`,
    summary: correlated?.summary ?? "Optimize checkout query",
    confidence: 0.9,
    reference: { type: "deployment", id: `deploy-${PRIMARY_SERVICE_ID}-${PRIMARY_VERSION}` },
  });
  const metricEvidenceId = addEvidenceItem({
    type: "metric",
    title: "Error rate increased at 13:50",
    summary: errorMetrics.summary,
    confidence: 0.95,
    reference: { type: "metric", id: "error_rate" },
  });
  const tracesEvidenceId = addEvidenceItem({
    type: "trace",
    title: "Failed traces cluster on db.query",
    summary: tracesResult.summary,
    confidence: 0.88,
    reference: { type: "trace", id: REPRESENTATIVE_TRACE_ID },
  });
  const dbEvidenceId = addEvidenceItem({
    type: "trace",
    title:
      share !== undefined
        ? `DB query consumes ${share}% of representative trace`
        : "Database span dominates the failed trace",
    summary: traceResult.summary,
    confidence: 0.94,
    reference: { type: "trace", id: REPRESENTATIVE_TRACE_ID },
  });
  const compareEvidenceId = addEvidenceItem({
    type: "comparison",
    title: "Error rate is far above the pre-deploy baseline",
    summary: errorCompareResult.summary,
    confidence: 0.93,
    reference: { type: "comparison", id: "error_rate" },
  });
  const logsEvidenceId = addEvidenceItem({
    type: "log",
    title: "Checkout 500s surface as query timeouts",
    summary: logsResult.summary,
    confidence: 0.86,
    reference: { type: "log", id: "timeout" },
  });
  const paymentEvidenceId = addEvidenceItem({
    type: "metric",
    title: "Payment-service p95 is not the checkout failure mode",
    summary: paymentLatencyResult.summary,
    confidence: 0.82,
    reference: { type: "metric", id: "p95_latency" },
  });

  const hypotheses: Hypothesis[] = [
    {
      id: "hyp-db-regression",
      title: "Database query regression",
      confidence: 0.92,
      status: "active",
      evidenceIds: [
        deployEvidenceId,
        metricEvidenceId,
        tracesEvidenceId,
        dbEvidenceId,
        compareEvidenceId,
        logsEvidenceId,
      ],
    },
    {
      id: "hyp-payment-latency",
      title: "Payment-service latency",
      confidence: 0.22,
      status: "rejected",
      evidenceIds: [paymentEvidenceId],
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
  store.setIncidentStatus("identified");
  store.setProgressStep(6);
  addAgentMessage("hypothesis", "The strongest hypothesis is a database query regression.");
  addAgentMessage("question", TRAFFIC_CHALLENGE_QUESTION);

  store.setAgentStatus("waiting");
  await collectTrafficAnswer(options);
  throwIfAborted(signal);

  store.setAgentStatus("investigating");
  addAgentMessage("status", "Checking whether traffic caused this.");

  const trafficMetrics = await runTool(
    "query_metrics",
    { service: PRIMARY_SERVICE_ID, metric: "request_rate", ...QUERY_WINDOW },
    options,
  );
  requireData(trafficMetrics);

  const trafficCompareResult = await runTool(
    "compare_periods",
    {
      service: PRIMARY_SERVICE_ID,
      metric: "request_rate",
      ...COMPARE_WINDOW,
    },
    options,
  );
  const trafficCompare = requireData<ComparisonResult>(trafficCompareResult);

  const errorRatio =
    errorCompare.baselineAverage === 0
      ? Number.POSITIVE_INFINITY
      : errorCompare.incidentAverage / errorCompare.baselineAverage;
  const trafficPct = trafficCompare.percentageChange;
  addAgentMessage(
    "finding",
    `Traffic increased ${formatCompact(trafficPct)}%, while errors rose ${formatCompact(errorRatio)}\u00d7. Traffic alone does not explain the incident.`,
  );

  const trafficEvidenceId = addEvidenceItem({
    type: "comparison",
    title: "Traffic rise is too small to explain errors",
    summary: trafficCompareResult.summary,
    confidence: 0.9,
    reference: { type: "comparison", id: "request_rate" },
  });

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

  addAgentMessage(
    "action_proposal",
    `Rollback ${PRIMARY_SERVICE_ID} ${PRIMARY_VERSION} to ${ROLLBACK_VERSION}.`,
  );

  await runTool(
    "add_incident_note",
    {
      incidentId: PRIMARY_INCIDENT_ID,
      note: "Root cause: checkout-api v2.31 database query regression. Traffic rise does not explain the error jump. Recommending rollback to v2.30.",
    },
    options,
  );

  const proposed = await runTool(
    "propose_rollback",
    {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
      reason:
        "v2.31 correlates with the error rise; representative trace spends most of its duration in db.query. Traffic does not explain the jump.",
    },
    options,
  );
  requireData(proposed);

  const decision = await awaitApproval(options);
  throwIfAborted(signal);

  if (decision !== "approved") {
    store.setAgentStatus("waiting");
    addAgentMessage("status", "Rollback was not approved.");
    return;
  }

  if (!useIncidentStore.getState().approval.approved) {
    useIncidentStore.getState().approve();
  }

  const rollback = await runTool(
    "rollback_deployment",
    { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION },
    options,
  );
  if (!rollback.ok) {
    addAgentMessage("status", rollback.summary);
    store.setAgentStatus("waiting");
    return;
  }

  store.setProgressStep(7);
  addAgentMessage("status", rollback.summary);
  addAgentMessage("finding", "Error rate 18.4% to 1.1%. p95 2.8s to 430ms.");
  await startRecoveryWatch(signal);
}

export async function runDemoInvestigation(options: DemoRunOptions = {}): Promise<void> {
  resetAgentClock();
  try {
    await runScript(options);
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    throw error;
  }
}
