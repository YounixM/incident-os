import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function WorkspaceSlot({
  slot,
  label,
  id,
  children,
  className,
}: {
  slot: string;
  label: string;
  id?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-slot={slot}
      id={id}
      aria-label={label}
      className={cn(
        "min-w-0 rounded-md border border-border bg-background",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </h2>
      </header>
      <div className="p-3">
        {children ?? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <p className="text-xs text-muted-foreground">
              Awaiting telemetry view.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function WorkspacePage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1600px] flex-col gap-3 p-3 xl:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyHint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1 py-4">
      <p className="text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
