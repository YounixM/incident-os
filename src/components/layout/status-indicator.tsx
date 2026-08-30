import type { ServiceStatus, Severity } from "@/types";
import { cn } from "@/lib/utils";

type StatusTone = "critical" | "warning" | "healthy" | "info";

const TONE_DOT: Record<StatusTone, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  healthy: "bg-status-healthy",
  info: "bg-status-info",
};

const TONE_TEXT: Record<StatusTone, string> = {
  critical: "text-status-critical",
  warning: "text-status-warning",
  healthy: "text-status-healthy",
  info: "text-status-info",
};

export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        TONE_TEXT[tone],
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  switch (severity) {
    case "SEV-1":
      return (
        <span className="inline-flex items-center gap-1 rounded-sm border border-status-critical/30 bg-status-critical/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-status-critical">
          SEV-1
        </span>
      );
    case "SEV-2":
      return (
        <span className="inline-flex items-center gap-1 rounded-sm border border-status-warning/30 bg-status-warning/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-status-warning">
          SEV-2
        </span>
      );
    case "SEV-3":
      return (
        <span className="inline-flex items-center gap-1 rounded-sm border border-status-info/30 bg-status-info/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-status-info">
          SEV-3
        </span>
      );
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

export function ServiceStatusIndicator({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "critical":
      return <StatusDot tone="critical" label="Critical" />;
    case "degraded":
      return <StatusDot tone="warning" label="Degraded" />;
    case "healthy":
      return <StatusDot tone="healthy" label="Healthy" />;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
