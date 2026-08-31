import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_NOW_ISO, PRIMARY_INCIDENT_ID, PRIMARY_SERVICE_ID } from "@/lib/constants";
import { REPRESENTATIVE_TRACE_ID, SERIES_START_ISO } from "@/data/story";
import { telemetryEngine } from "@/lib/observability/engine";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { startInvestigation, resetActiveInvestigation } from "./controller";
import { COMPARE_WINDOW } from "./windows";
import type { AgentTurnResponse } from "./turn-protocol";

async function flushUntil(done: Promise<void>): Promise<void> {
  let settled = false;
  const tracked = done.finally(() => {
    settled = true;
  });
  let spins = 0;
  while (!settled) {
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    spins += 1;
    if (spins > 400) {
      throw new Error("Investigation did not settle");
    }
  }
  await tracked;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toolCall(
  toolName: string,
  input: unknown,
  toolCallId: string,
): AgentTurnResponse {
  return { toolName, input, toolCallId };
}

beforeEach(() => {
  vi.useFakeTimers();
  useIncidentStore.getState().resetInvestigation();
});

afterEach(() => {
  resetActiveInvestigation();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useIncidentStore.getState().resetInvestigation();
});

describe("startInvestigation LLM path", () => {
  it("falls back to the demo script when the LLM is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ available: false })),
    );

    const run = startInvestigation({
      instant: true,
      autoChallenge: true,
      autoApprove: true,
    });
    await flushUntil(run);

    expect(useIncidentStore.getState().incidentStatus).toBe("resolved");
    expect(
      useIncidentStore.getState().agent.activities.some(
        (activity) => activity.tool === "rollback_deployment",
      ),
    ).toBe(true);
  });

  it("executes model-requested tools on the client and recovers", async () => {
    const calls: AgentTurnResponse[] = [
      toolCall("get_incident", { incidentId: PRIMARY_INCIDENT_ID }, "c1"),
      toolCall("get_service", { service: PRIMARY_SERVICE_ID }, "c2"),
      toolCall(
        "query_metrics",
        {
          service: PRIMARY_SERVICE_ID,
          metric: "error_rate",
          startTime: SERIES_START_ISO,
          endTime: DEMO_NOW_ISO,
        },
        "c3",
      ),
      toolCall("get_deployments", { service: PRIMARY_SERVICE_ID }, "c4"),
      toolCall(
        "search_traces",
        {
          service: PRIMARY_SERVICE_ID,
          status: "error",
          startTime: SERIES_START_ISO,
          endTime: DEMO_NOW_ISO,
        },
        "c5",
      ),
      toolCall("get_trace", { traceId: REPRESENTATIVE_TRACE_ID }, "c6"),
      toolCall(
        "compare_periods",
        { service: PRIMARY_SERVICE_ID, metric: "error_rate", ...COMPARE_WINDOW },
        "c7",
      ),
      toolCall(
        "query_metrics",
        {
          service: PRIMARY_SERVICE_ID,
          metric: "request_rate",
          startTime: SERIES_START_ISO,
          endTime: DEMO_NOW_ISO,
        },
        "c8",
      ),
      toolCall(
        "compare_periods",
        { service: PRIMARY_SERVICE_ID, metric: "request_rate", ...COMPARE_WINDOW },
        "c9",
      ),
    ];
    let postIndex = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return jsonResponse({ available: true });
        }
        const next = calls[postIndex];
        postIndex += 1;
        if (next) {
          return jsonResponse(next);
        }
        return jsonResponse({ text: "Traffic does not explain the errors. Recommend rollback." });
      }),
    );

    const run = startInvestigation({
      instant: true,
      autoChallenge: true,
      autoApprove: true,
    });
    await flushUntil(run);

    const state = useIncidentStore.getState();
    const tools = state.agent.activities.map((activity) => activity.tool);
    expect(tools).toContain("get_incident");
    expect(tools).toContain("get_trace");
    expect(tools).toContain("compare_periods");
    expect(tools).toContain("rollback_deployment");
    expect(state.incidentStatus).toBe("resolved");
    expect(state.agent.hypotheses.find((row) => row.id === "hyp-db-regression")?.status).toBe(
      "confirmed",
    );
    expect(telemetryEngine.isRecoveryTriggered()).toBe(true);
  });
});
