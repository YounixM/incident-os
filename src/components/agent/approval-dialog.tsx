"use client";

import { Button } from "@/components/ui/button";
import { PRIMARY_VERSION } from "@/lib/constants";
import { resolveApproval } from "@/lib/agent/controller";
import { cn } from "@/lib/utils";
import type { PendingAction } from "@/types";

export function ApprovalDialog({
  pendingAction,
  approved,
  variant = "column",
}: {
  pendingAction: PendingAction | undefined;
  approved: boolean;
  variant?: "column" | "banner";
}) {
  const open = Boolean(pendingAction) && !approved;
  if (!open) {
    return null;
  }

  const captureIds = variant === "banner";

  return (
    <section
      id={captureIds ? "approval-dialog" : undefined}
      aria-labelledby={captureIds ? "approval-title" : "agent-approval-title"}
      aria-describedby={captureIds ? "approval-reason" : "agent-approval-reason"}
      className={cn(
        variant === "banner"
          ? "rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/10"
          : "shrink-0 border-t border-border bg-muted/40 px-3 py-3",
      )}
    >
      <h3
        id={captureIds ? "approval-title" : "agent-approval-title"}
        className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
      >
        Action requires approval
      </h3>
      <p className="mt-1.5 text-sm text-foreground">{pendingAction?.title ?? "Rollback checkout-api"}</p>
      <p className="mt-1 font-mono text-xs tabular-nums">
        {PRIMARY_VERSION}
        <span className="mx-2 text-muted-foreground">to</span>
        {pendingAction?.params.targetVersion}
      </p>
      <p
        id={captureIds ? "approval-reason" : "agent-approval-reason"}
        className="mt-2 text-xs leading-snug text-muted-foreground"
      >
        <span className="block text-[10px] tracking-wider uppercase">Why</span>
        {pendingAction?.reason}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          id={captureIds ? "approval-cancel" : undefined}
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => resolveApproval("rejected")}
        >
          Cancel
        </Button>
        <Button
          type="button"
          id={captureIds ? "approval-approve" : undefined}
          size="sm"
          className="flex-1"
          onClick={() => resolveApproval("approved")}
        >
          Approve
        </Button>
      </div>
    </section>
  );
}
