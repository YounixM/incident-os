import { PRIMARY_INCIDENT_ID, PRIMARY_SERVICE_ID, ROLLBACK_VERSION } from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { invokeIncidentTool } from "./invoke-tool";
import { buildRollbackAction } from "./run-options";
import { nextAgentId, nextAgentTimestamp } from "./clock";
import { isToolName } from "./tool-names";
import { requestAgentTurn } from "./turn-client";
import type { AgentTurnMessage } from "./turn-protocol";

function addStatus(text: string): void {
  useIncidentStore.getState().addAgentMessage({
    id: nextAgentId("msg"),
    timestamp: nextAgentTimestamp(),
    kind: "status",
    text,
  });
}

function addFinding(text: string): void {
  useIncidentStore.getState().addAgentMessage({
    id: nextAgentId("msg"),
    timestamp: nextAgentTimestamp(),
    kind: "finding",
    text,
  });
}

async function scriptedFollowUp(signal?: AbortSignal): Promise<void> {
  const result = await invokeIncidentTool(
    "get_incident",
    { incidentId: PRIMARY_INCIDENT_ID },
    signal,
  );
  addFinding(result.summary);
}

export async function runFollowUp(prompt: string, signal?: AbortSignal): Promise<void> {
  useIncidentStore.getState().setAgentStatus("investigating");
  const history: AgentTurnMessage[] = [{ role: "user", content: prompt }];

  try {
    for (let step = 0; step < 6; step += 1) {
      const payload = await requestAgentTurn(history, signal);
      if ("text" in payload) {
        if (payload.text.trim()) {
          addStatus(payload.text.trim());
        }
        return;
      }
      if (!isToolName(payload.toolName)) {
        addStatus("Unknown tool requested.");
        return;
      }
      if (payload.toolName === "propose_rollback" || payload.toolName === "rollback_deployment") {
        const store = useIncidentStore.getState();
        if (
          store.telemetry.recoveryTriggered ||
          store.incidentStatus === "remediating" ||
          store.incidentStatus === "monitoring" ||
          store.incidentStatus === "resolved"
        ) {
          addStatus("Rollback already applied. No further remediation is needed.");
          return;
        }
        if (payload.toolName === "propose_rollback") {
          const result = await invokeIncidentTool(payload.toolName, payload.input, signal);
          addStatus(result.summary);
          useIncidentStore.getState().setAgentStatus("waiting");
          return;
        }
        if (!store.approval.approved) {
          store.setPendingAction(buildRollbackAction());
          addStatus(
            `Rollback of ${PRIMARY_SERVICE_ID} to ${ROLLBACK_VERSION} requires approval.`,
          );
          store.setAgentStatus("waiting");
          return;
        }
      }
      const result = await invokeIncidentTool(payload.toolName, payload.input, signal);
      history.push({
        role: "tool",
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        input: payload.input,
        output: result.ok ? result.data : { error: result.error },
      });
    }
    addStatus("Stopped after the tool budget.");
  } catch {
    await scriptedFollowUp(signal);
  } finally {
    const status = useIncidentStore.getState().incidentStatus;
    if (status === "resolved") {
      useIncidentStore.getState().setAgentStatus("complete");
    } else if (useIncidentStore.getState().agent.status === "investigating") {
      useIncidentStore.getState().setAgentStatus("complete");
    }
  }
}
