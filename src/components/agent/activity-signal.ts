import type { StatusTone } from "@/components/observability/status";
import type { AgentActivity } from "@/types";

export function activitySignal(activity: AgentActivity): StatusTone {
  switch (activity.status) {
    case "running":
      return "info";
    case "error":
      return "critical";
    case "success":
      return signalFromSuccess(activity);
    default: {
      const _exhaustive: never = activity.status;
      return _exhaustive;
    }
  }
}

export function activitySignalLabel(tone: StatusTone, status: AgentActivity["status"]): string {
  if (status === "running") {
    return "In progress";
  }
  if (status === "error") {
    return "Tool failed";
  }
  switch (tone) {
    case "critical":
      return "Incident finding";
    case "warning":
      return "Warning";
    case "healthy":
      return "Recovered";
    case "info":
      return "Observation";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

function signalFromSuccess(activity: AgentActivity): StatusTone {
  const text = activity.summary;
  switch (activity.tool) {
    case "get_investigation_context":
      return "info";
    case "rollback_deployment":
      return "healthy";
    case "propose_rollback":
      return "warning";
    case "add_incident_note":
      return "info";
    case "get_incident":
      if (/resolved|after rollback/i.test(text)) {
        return "healthy";
      }
      if (/SEV-1|18\.4|critical/i.test(text)) {
        return "critical";
      }
      return "warning";
    case "get_service":
      if (/\bis healthy\b/i.test(text)) {
        return "healthy";
      }
      if (/\bis degraded\b/i.test(text)) {
        return "warning";
      }
      if (/\bis critical\b/i.test(text)) {
        return "critical";
      }
      return "info";
    case "query_metrics":
    case "compare_periods":
      return metricChangeTone(text);
    case "search_traces":
    case "get_trace":
      if (/failed|error/i.test(text)) {
        return "critical";
      }
      return "info";
    case "search_logs":
      if (/timeout|deadline|\b500\b|\berror\b/i.test(text)) {
        return "critical";
      }
      return "info";
    case "get_deployments":
      if (/after rollback|active .* v2\.30/i.test(text)) {
        return "healthy";
      }
      if (/v2\.31/i.test(text)) {
        return "warning";
      }
      return "info";
    default: {
      const _exhaustive: never = activity.tool;
      return _exhaustive;
    }
  }
}

function metricChangeTone(text: string): StatusTone {
  const isRequestRate = /request rate/i.test(text);
  const isErrorish = /error rate|p95|p99|p50|db latency/i.test(text);
  if (isErrorish && /decreased/i.test(text)) {
    return /×/.test(text) ? "healthy" : "info";
  }
  if (isRequestRate) {
    return "info";
  }
  if (isErrorish && /increased|rose/i.test(text)) {
    return "critical";
  }
  return "info";
}
