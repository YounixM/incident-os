"use client";

import { Button } from "@/components/ui/button";
import { WorkspacePage } from "@/components/layout/workspace-slot";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspacePage className="max-w-md">
      <h1 className="text-sm font-medium">Unable to load workspace</h1>
      <p className="text-xs text-muted-foreground">
        {error.message || "The workspace view failed to render."}
      </p>
      <Button type="button" size="sm" onClick={reset}>
        Retry
      </Button>
    </WorkspacePage>
  );
}
