import type {
  IncidentStatus,
  LogLevel,
  ServiceStatus,
  TelemetryStatus,
  WorkspaceTab,
} from "@/types";

export type StatusTone = "critical" | "warning" | "healthy" | "info";

export function incidentStatusLabel(status: IncidentStatus): string {
  switch (status) {
    case "investigating":
      return "Investigating";
    case "identified":
      return "Identified";
    case "action_pending":
      return "Action pending";
    case "remediating":
      return "Remediating";
    case "monitoring":
      return "Monitoring";
    case "resolved":
      return "Resolved";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function incidentStatusTone(status: IncidentStatus): StatusTone {
  switch (status) {
    case "investigating":
      return "warning";
    case "identified":
      return "info";
    case "action_pending":
      return "warning";
    case "remediating":
      return "info";
    case "monitoring":
      return "info";
    case "resolved":
      return "healthy";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function serviceStatusTone(status: ServiceStatus): StatusTone {
  switch (status) {
    case "critical":
      return "critical";
    case "degraded":
      return "warning";
    case "healthy":
      return "healthy";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function logLevelTone(level: LogLevel): StatusTone {
  switch (level) {
    case "ERROR":
      return "critical";
    case "WARN":
      return "warning";
    case "INFO":
      return "info";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function telemetryTone(status: TelemetryStatus): StatusTone {
  switch (status) {
    case "error":
      return "critical";
    case "ok":
      return "healthy";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function telemetryLabel(status: TelemetryStatus): string {
  switch (status) {
    case "error":
      return "ERROR";
    case "ok":
      return "OK";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function workspaceTabTargetId(tab: WorkspaceTab): string {
  switch (tab) {
    case "overview":
      return "overview";
    case "metrics":
      return "metrics";
    case "timeline":
      return "timeline";
    case "traces":
      return "traces";
    case "logs":
      return "logs";
    case "deployments":
      return "deployments";
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}
