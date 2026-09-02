import { PRIMARY_SERVICE_ID, PRIMARY_VERSION, ROLLBACK_VERSION } from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { ToolName } from "@/types";
import { isAbortError, throwIfAborted } from "./abort";
import { resetAgentClock } from "./clock";
import {
  hasCoreInvestigationEvidence,
  hasTrafficComparisonEvidence,
  ingestSuccessfulTool,
} from "./ingest-tools";
import { takeInterrupt } from "./interrupts";
import { invokeIncidentTool } from "./invoke-tool";
import { isLlmUnavailableError } from "./llm-unavailable";
import { addAgentMessage } from "./messages";
import { INVESTIGATION_USER_PROMPT } from "./prompts";
import { startRecoveryWatch } from "./recovery-watch";
import { runRedirectInvestigation } from "./redirect";
import { isTrafficPrompt } from "./redirect-kind";
import {
  buildRollbackAction,
  TRAFFIC_CHALLENGE_CHIP,
  TRAFFIC_CHALLENGE_QUESTION,
  type ApprovalDecision,
  type DemoRunOptions,
} from "./run-options";
import { isToolName } from "./tool-names";
import { requestAgentTurn } from "./turn-client";
import type { AgentTurnMessage } from "./turn-protocol";

const MAX_TURNS = 24;

function looksLikeQuestion(text: string): boolean {
  return text.includes("?") || isTrafficPrompt(text);
}

function looksLikeRollbackProposal(text: string): boolean {
  return /rollback/i.test(text);
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

async function waitForTrafficAnswer(options: DemoRunOptions): Promise<string> {
  const store = useIncidentStore.getState();
  addAgentMessage("question", TRAFFIC_CHALLENGE_QUESTION);
  store.setAgentStatus("waiting");
  let answer = await awaitChallenge(options);
  while (!isTrafficPrompt(answer) && !options.autoChallenge) {
    store.setAgentStatus("investigating");
    await runRedirectInvestigation(answer, options.signal);
    store.setAgentStatus("waiting");
    addAgentMessage("question", TRAFFIC_CHALLENGE_QUESTION);
    answer = await awaitChallenge(options);
  }
  store.setAgentStatus("investigating");
  return answer;
}

async function proposeAndExecuteRollback(options: DemoRunOptions): Promise<boolean> {
  const store = useIncidentStore.getState();
  if (!store.approval.pendingAction) {
    addAgentMessage(
      "action_proposal",
      `Rollback ${PRIMARY_SERVICE_ID} ${PRIMARY_VERSION} to ${ROLLBACK_VERSION}.`,
    );
    store.setPendingAction(buildRollbackAction());
  }
  const decision = await awaitApproval(options);
  throwIfAborted(options.signal);
  if (decision !== "approved") {
    store.setAgentStatus("waiting");
    addAgentMessage("status", "Rollback was not approved.");
    return false;
  }
  if (!useIncidentStore.getState().approval.approved) {
    useIncidentStore.getState().approve();
  }
  const input = { service: PRIMARY_SERVICE_ID, targetVersion: ROLLBACK_VERSION };
  const rollback = await invokeIncidentTool("rollback_deployment", input, options.signal);
  ingestSuccessfulTool("rollback_deployment", input, rollback);
  if (!rollback.ok) {
    addAgentMessage("status", rollback.summary);
    store.setAgentStatus("waiting");
    return false;
  }
  await startRecoveryWatch(options.signal);
  return true;
}

async function executeToolCall(
  toolName: ToolName,
  input: unknown,
  options: DemoRunOptions,
): Promise<unknown> {
  if (toolName === "rollback_deployment") {
    const store = useIncidentStore.getState();
    if (!store.approval.approved) {
      const done = await proposeAndExecuteRollback(options);
      return done ? { ok: true } : { error: "Human rejected rollback or rollback failed." };
    }
  }
  if (toolName === "propose_rollback") {
    const result = await invokeIncidentTool(toolName, input, options.signal);
    ingestSuccessfulTool(toolName, input, result);
    if (!result.ok) {
      return { error: result.error };
    }
    const done = await proposeAndExecuteRollback(options);
    return done ? { ok: true } : { error: "Human rejected rollback or rollback failed." };
  }
  const result = await invokeIncidentTool(toolName, input, options.signal);
  ingestSuccessfulTool(toolName, input, result);
  if (toolName === "rollback_deployment" && result.ok) {
    await startRecoveryWatch(options.signal);
  }
  return result.ok ? result.data : { error: result.error };
}

export async function runLlmInvestigation(options: DemoRunOptions = {}): Promise<void> {
  resetAgentClock();
  const store = useIncidentStore.getState();
  store.setIncidentStatus("investigating");
  store.setAgentStatus("investigating");
  store.setProgressStep(0);
  addAgentMessage("status", "Gathering incident context.");

  const history: AgentTurnMessage[] = [{ role: "user", content: INVESTIGATION_USER_PROMPT }];
  let pausedForTraffic = false;
  let proposedRollback = false;

  try {
    for (let step = 0; step < MAX_TURNS; step += 1) {
      throwIfAborted(options.signal);
      if (useIncidentStore.getState().incidentStatus === "resolved") {
        return;
      }

      const queued = takeInterrupt();
      if (queued) {
        history.push({ role: "user", content: queued });
        if (!isTrafficPrompt(queued)) {
          await runRedirectInvestigation(queued, options.signal);
        }
      }

      if (!pausedForTraffic && hasCoreInvestigationEvidence()) {
        pausedForTraffic = true;
        const answer = await waitForTrafficAnswer(options);
        history.push({
          role: "user",
          content: `Human: ${answer}. Query request_rate and compare_periods for request_rate, then conclude whether traffic explains the errors.`,
        });
      }

      if (
        !proposedRollback &&
        pausedForTraffic &&
        hasTrafficComparisonEvidence() &&
        !useIncidentStore.getState().approval.pendingAction
      ) {
        proposedRollback = true;
        const executed = await proposeAndExecuteRollback(options);
        if (executed) {
          return;
        }
        history.push({
          role: "user",
          content: "Rollback was not approved. Continue investigating with tools if needed.",
        });
      }

      const payload = await requestAgentTurn(history, options.signal);
      if ("text" in payload) {
        const text = payload.text.trim();
        if (!text) {
          continue;
        }
        history.push({ role: "assistant", content: text });
        if (looksLikeRollbackProposal(text) && !proposedRollback) {
          proposedRollback = true;
          addAgentMessage("action_proposal", text);
          const executed = await proposeAndExecuteRollback(options);
          if (executed) {
            return;
          }
          continue;
        }
        if (looksLikeQuestion(text) && !pausedForTraffic) {
          pausedForTraffic = true;
          const answer = await waitForTrafficAnswer(options);
          history.push({
            role: "user",
            content: `Human: ${answer}. Check request_rate vs error_rate with tools.`,
          });
          continue;
        }
        addAgentMessage("status", text);
        continue;
      }

      if (!isToolName(payload.toolName)) {
        addAgentMessage("status", "Unknown tool requested.");
        continue;
      }

      const output = await executeToolCall(payload.toolName, payload.input, options);
      history.push({
        role: "tool",
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        input: payload.input,
        output,
      });
    }

    if (useIncidentStore.getState().incidentStatus !== "resolved") {
      if (hasCoreInvestigationEvidence() && !proposedRollback) {
        await proposeAndExecuteRollback(options);
        return;
      }
      useIncidentStore.getState().setAgentStatus("complete");
      addAgentMessage("status", "Stopped after the tool budget.");
    }
  } catch (error) {
    if (isAbortError(error) || isLlmUnavailableError(error)) {
      throw error;
    }
    throw error;
  }
}
