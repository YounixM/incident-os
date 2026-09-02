import { useIncidentStore } from "@/lib/store/use-incident-store";
import { isAbortError, sleep } from "./abort";
import { addAgentMessage } from "./messages";

const RECOVERY_STEP_MS = 1500;

let inFlight: Promise<void> | undefined;
let watchController: AbortController | undefined;
let resetAttached = false;

function attachResetListener(): void {
  if (resetAttached) {
    return;
  }
  resetAttached = true;
  useIncidentStore.subscribe((state, previous) => {
    if (!state.telemetry.recoveryTriggered && previous.telemetry.recoveryTriggered) {
      cancelRecoveryWatch();
    }
  });
}

attachResetListener();

export function cancelRecoveryWatch(): void {
  watchController?.abort();
  watchController = undefined;
  inFlight = undefined;
}

export function startRecoveryWatch(signal?: AbortSignal): Promise<void> {
  const status = useIncidentStore.getState().incidentStatus;
  if (status === "resolved") {
    return Promise.resolve();
  }
  if (!inFlight) {
    const controller = new AbortController();
    watchController = controller;
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }
    inFlight = runRecovery(controller.signal).finally(() => {
      if (watchController === controller) {
        watchController = undefined;
        inFlight = undefined;
      }
    });
  }
  return inFlight;
}

async function runRecovery(signal: AbortSignal): Promise<void> {
  try {
    const start = useIncidentStore.getState();
    if (start.incidentStatus === "remediating") {
      if (start.agent.status === "waiting" || start.agent.status === "idle") {
        start.setAgentStatus("investigating");
      }
      start.setTab("overview");
    }

    await sleep(RECOVERY_STEP_MS, signal);
    const afterFirst = useIncidentStore.getState();
    if (afterFirst.incidentStatus === "remediating") {
      afterFirst.setIncidentStatus("monitoring");
      addAgentMessage("status", "Monitoring recovery.");
    }

    await sleep(RECOVERY_STEP_MS, signal);
    const afterSecond = useIncidentStore.getState();
    if (afterSecond.incidentStatus === "monitoring" || afterSecond.incidentStatus === "remediating") {
      afterSecond.setIncidentStatus("resolved");
      afterSecond.setAgentStatus("complete");
      addAgentMessage("status", "Incident resolved.");
    }
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    throw error;
  }
}
