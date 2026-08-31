import { PRIMARY_SERVICE_ID, ROLLBACK_VERSION } from "@/lib/constants";
import type { PendingAction } from "@/types";

export const TRAFFIC_CHALLENGE_QUESTION =
  "Would you like me to check whether traffic caused this?";

export const TRAFFIC_CHALLENGE_CHIP = "Could this just be a traffic spike?";

export const PENDING_ROLLBACK_ID = "rollback-checkout-v230";

export type ApprovalDecision = "approved" | "rejected";

export type DemoRunOptions = {
  signal?: AbortSignal;
  instant?: boolean;
  autoChallenge?: boolean | string;
  autoApprove?: boolean;
  forceDemo?: boolean;
  initialPrompt?: string;
  waitForChallenge?: () => Promise<string>;
  waitForApproval?: () => Promise<ApprovalDecision>;
};

export function buildRollbackAction(): PendingAction {
  return {
    id: PENDING_ROLLBACK_ID,
    tool: "rollback_deployment",
    title: "Rollback checkout-api",
    reason:
      "Deployment correlates with the incident and traces show a database regression.",
    params: {
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    },
  };
}
