"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Loading telemetry" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-2 py-2" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1 py-3">
      <p className="text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-3">
      <p className="text-sm text-status-critical">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button type="button" size="xs" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
