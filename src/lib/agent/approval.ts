import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { ApprovalDecision } from "./run-options";

type Resolver = (value: ApprovalDecision) => void;

const waiters = new Set<Resolver>();

export function resolveApproval(decision: ApprovalDecision): void {
  const store = useIncidentStore.getState();
  if (decision === "approved") {
    store.approve();
  } else {
    store.reject();
  }
  const pending = [...waiters];
  waiters.clear();
  for (const waiter of pending) {
    waiter(decision);
  }
}

export function hasApprovalWaiters(): boolean {
  return waiters.size > 0;
}

export function clearApprovalWaiters(decision: ApprovalDecision = "rejected"): void {
  const pending = [...waiters];
  waiters.clear();
  for (const waiter of pending) {
    waiter(decision);
  }
}

export function waitForHumanApproval(signal?: AbortSignal): Promise<ApprovalDecision> {
  const approval = useIncidentStore.getState().approval;
  if (approval.pendingAction && approval.approved) {
    return Promise.resolve("approved");
  }

  return new Promise<ApprovalDecision>((resolve, reject) => {
    const waiter: Resolver = (decision) => {
      signal?.removeEventListener("abort", onAbort);
      waiters.delete(waiter);
      resolve(decision);
    };
    const onAbort = (): void => {
      waiters.delete(waiter);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    waiters.add(waiter);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
