import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRIMARY_SERVICE_ID,
  ROLLBACK_VERSION,
  TOOL_LATENCY_MS,
} from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { submitAgentPrompt } from "./controller";
import { executeIncidentTool } from "./invoke-tool";
import { cancelRecoveryWatch } from "./recovery-watch";

async function approveAndRollback(): Promise<void> {
  useIncidentStore.getState().setPendingAction({
    id: "rollback-checkout-v230",
    tool: "rollback_deployment",
    title: "Rollback checkout-api",
    reason: "Database query regression in v2.31",
    params: { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION },
  });
  useIncidentStore.getState().approve();
  const work = executeIncidentTool("rollback_deployment", {
    service: PRIMARY_SERVICE_ID,
    targetVersion: ROLLBACK_VERSION,
  });
  await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.rollback_deployment);
  await work;
}

beforeEach(() => {
  vi.useFakeTimers();
  useIncidentStore.getState().resetInvestigation();
});

afterEach(() => {
  cancelRecoveryWatch();
  useIncidentStore.getState().resetInvestigation();
  vi.useRealTimers();
});

describe("recovery watch", () => {
  it("advances remediating to monitoring then resolved after rollback ingest", async () => {
    await approveAndRollback();
    expect(useIncidentStore.getState().incidentStatus).toBe("remediating");

    expect(useIncidentStore.getState().agent.status).toBe("investigating");
    expect(useIncidentStore.getState().workspaceTab).toBe("overview");

    await vi.advanceTimersByTimeAsync(1500);
    expect(useIncidentStore.getState().incidentStatus).toBe("monitoring");
    expect(useIncidentStore.getState().agent.messages.some((row) => row.text === "Monitoring recovery.")).toBe(
      true,
    );

    await vi.advanceTimersByTimeAsync(1500);
    expect(useIncidentStore.getState().incidentStatus).toBe("resolved");
    expect(useIncidentStore.getState().agent.status).toBe("complete");
    expect(useIncidentStore.getState().agent.messages.some((row) => row.text === "Incident resolved.")).toBe(
      true,
    );
  });

  it("does not restart investigation while remediating", async () => {
    await approveAndRollback();
    await submitAgentPrompt("rollback again");
    expect(useIncidentStore.getState().incidentStatus).toBe("remediating");
    expect(
      useIncidentStore.getState().agent.messages.some(
        (row) => row.text === "Rollback already applied. Monitoring recovery.",
      ),
    ).toBe(true);
  });

  it("stops advancing after reset", async () => {
    await approveAndRollback();
    useIncidentStore.getState().resetInvestigation();
    await vi.advanceTimersByTimeAsync(4000);
    expect(useIncidentStore.getState().incidentStatus).toBe("investigating");
    expect(useIncidentStore.getState().agent.status).toBe("idle");
  });
});
