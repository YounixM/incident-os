import Link from "next/link";
import { WorkspacePage } from "@/components/layout/workspace-slot";
import { Button } from "@/components/ui/button";

export default function WorkspaceNotFound() {
  return (
    <WorkspacePage className="max-w-md">
      <h1 className="text-sm font-medium">Page not found</h1>
      <p className="text-xs text-muted-foreground">
        That route does not exist in this workspace.
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/">Back to overview</Link>
      </Button>
    </WorkspacePage>
  );
}
