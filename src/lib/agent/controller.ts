import { isForceDemo } from "@/lib/fast-telemetry";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { isAbortError } from "./abort";
import { addAgentMessage } from "./messages";
import {
  clearApprovalWaiters,
  hasApprovalWaiters,
  resolveApproval as settleApproval,
  waitForHumanApproval,
} from "./approval";
import { runDemoInvestigation } from "./demo-investigation";
import { runFollowUp } from "./follow-up";
import { clearInterrupts, queueInterrupt, takeInterrupt } from "./interrupts";
import { executeIncidentTool } from "./invoke-tool";
import { runLlmInvestigation } from "./llm-investigation";
import { isTrafficPrompt } from "./redirect-kind";
import {
  buildRollbackAction,
  TRAFFIC_CHALLENGE_CHIP,
  type ApprovalDecision,
  type DemoRunOptions,
} from "./run-options";
import { probeLlmAvailable } from "./turn-client";

type Resolver<T> = (value: T) => void;

let activeAbort: AbortController | null = null;
let challengeResolver: Resolver<string> | null = null;
let runTail: Promise<void> = Promise.resolve();

function abortActiveRun(): void {
  activeAbort?.abort();
  activeAbort = null;
  challengeResolver = null;
  clearApprovalWaiters();
  clearInterrupts();
}

function waitForChallenge(signal: AbortSignal): Promise<string> {
  const queued = takeInterrupt();
  if (queued) {
    return Promise.resolve(queued);
  }
  return new Promise<string>((resolve, reject) => {
    const onAbort = (): void => {
      challengeResolver = null;
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    challengeResolver = (text) => {
      signal.removeEventListener("abort", onAbort);
      challengeResolver = null;
      resolve(text);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForApproval(signal: AbortSignal): Promise<ApprovalDecision> {
  return waitForHumanApproval(signal);
}

async function runInvestigation(options: DemoRunOptions): Promise<void> {
  const forceDemo = options.forceDemo || isForceDemo();
  if (!forceDemo) {
    const available = await probeLlmAvailable(options.signal);
    if (available) {
      try {
        await runLlmInvestigation(options);
        return;
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        useIncidentStore.getState().resetInvestigation();
      }
    }
  }
  await runDemoInvestigation(options);
}

export function startInvestigation(overrides: Partial<DemoRunOptions> = {}): Promise<void> {
  const { initialPrompt, ...runOverrides } = overrides;
  abortActiveRun();
  if (initialPrompt) {
    queueInterrupt(initialPrompt);
  }
  useIncidentStore.getState().resetInvestigation();
  const ac = new AbortController();
  activeAbort = ac;
  const run = runInvestigation({
    signal: ac.signal,
    waitForChallenge: () => waitForChallenge(ac.signal),
    waitForApproval: () => waitForApproval(ac.signal),
    ...runOverrides,
  }).finally(() => {
    if (activeAbort === ac) {
      activeAbort = null;
      challengeResolver = null;
    }
  });
  runTail = run;
  return run;
}

export function resetActiveInvestigation(): void {
  abortActiveRun();
  useIncidentStore.getState().resetInvestigation();
}

export function reproposeRollback(): void {
  const store = useIncidentStore.getState();
  if (store.approval.pendingAction) {
    return;
  }
  store.setPendingAction(buildRollbackAction());
}

export async function submitAgentPrompt(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  const store = useIncidentStore.getState();
  const agentStatus = store.agent.status;
  const incidentStatus = store.incidentStatus;

  if (challengeResolver && agentStatus === "waiting") {
    challengeResolver(trimmed);
    return;
  }

  if (incidentStatus === "remediating" || incidentStatus === "monitoring") {
    addAgentMessage("status", "Rollback already applied. Monitoring recovery.");
    return;
  }

  if (agentStatus === "investigating") {
    queueInterrupt(trimmed);
    return;
  }

  if (agentStatus === "idle") {
    void startInvestigation({ initialPrompt: trimmed });
    return;
  }

  if (incidentStatus === "identified" && !store.approval.pendingAction) {
    if (isTrafficPrompt(trimmed)) {
      queueInterrupt(trimmed);
    }
    return;
  }

  if (agentStatus === "complete" || incidentStatus === "resolved") {
    await runFollowUp(trimmed, activeAbort?.signal);
  }
}

export function trafficChallengeChip(): string {
  return TRAFFIC_CHALLENGE_CHIP;
}

export function waitForIdleRun(): Promise<void> {
  return runTail;
}

export function resolveApproval(decision: ApprovalDecision): void {
  const hadWaiters = hasApprovalWaiters();
  settleApproval(decision);
  if (decision !== "approved" || hadWaiters) {
    return;
  }
  const pending = useIncidentStore.getState().approval.pendingAction;
  if (!pending) {
    return;
  }
  void executeIncidentTool("rollback_deployment", {
    service: pending.params.service,
    targetVersion: pending.params.targetVersion,
  });
}
