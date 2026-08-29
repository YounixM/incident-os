import type { Deployment, Incident, LogEntry, Service } from "@/types";
import { buildDeployments } from "./deployments";
import { buildIncidents } from "./incidents";
import { buildLogs } from "./logs";
import { buildServices } from "./services";
import type { SeededTrace } from "./seeded-types";
import { buildTraces } from "./traces";

export interface TelemetrySnapshot {
  services: Service[];
  incidents: Incident[];
  deployments: Deployment[];
  traces: SeededTrace[];
  logs: LogEntry[];
}

export function buildSnapshot(): TelemetrySnapshot {
  const traces = buildTraces();
  return {
    services: buildServices(),
    incidents: buildIncidents(),
    deployments: buildDeployments(),
    traces,
    logs: buildLogs(traces),
  };
}

export const TELEMETRY_SEED: TelemetrySnapshot = buildSnapshot();
