"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRIMARY_VERSION } from "@/lib/constants";
import { resolveApproval } from "@/lib/agent/controller";
import type { PendingAction } from "@/types";

export function ApprovalDialog({
  pendingAction,
  approved,
}: {
  pendingAction: PendingAction | undefined;
  approved: boolean;
}) {
  const open = Boolean(pendingAction) && !approved;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        id="approval-dialog"
        className="bg-neutral-950 text-neutral-100 ring-white/10"
        overlayClassName="bg-black/50 backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Action requires approval</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2 text-left">
              <p className="text-foreground">{pendingAction?.title ?? "Rollback checkout-api"}</p>
              <p className="font-mono text-sm tabular-nums">
                {PRIMARY_VERSION}
                <span className="mx-2 text-muted-foreground">to</span>
                {pendingAction?.params.targetVersion}
              </p>
              <p>
                <span className="block text-[10px] tracking-wider text-muted-foreground uppercase">
                  Why
                </span>
                {pendingAction?.reason}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-white/10 bg-neutral-950">
          <AlertDialogCancel id="approval-cancel" onClick={() => resolveApproval("rejected")}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction id="approval-approve" onClick={() => resolveApproval("approved")}>
            Approve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
