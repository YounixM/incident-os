import {
  DEMO_NOW_ISO,
  INCIDENT_PEAK,
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  PRIMARY_VERSION,
  RECOVERY,
  ROLLBACK_VERSION,
} from "@/lib/constants";
import type { Deployment, Incident, RollbackParams, RollbackResult, Service } from "@/types";
import { CHECKOUT_ROLLBACK_DEPLOY_ID } from "@/data/deployments";
import { TELEMETRY_SEED } from "@/data/snapshot";
import type { TelemetrySnapshot } from "@/data/snapshot";
import { healthForErrorRate } from "@/data/services";
import { invalidRollback, notFound } from "./errors";

export interface TelemetryWorld {
  recoveryTriggered: boolean;
  snapshot: TelemetrySnapshot;
  notes: Record<string, string[]>;
}

function cloneSnapshot(): TelemetrySnapshot {
  return structuredClone(TELEMETRY_SEED);
}

function createWorld(): TelemetryWorld {
  return {
    recoveryTriggered: false,
    snapshot: cloneSnapshot(),
    notes: {},
  };
}

class TelemetryEngine {
  private world: TelemetryWorld = createWorld();

  getWorld(): TelemetryWorld {
    return this.world;
  }

  isRecoveryTriggered(): boolean {
    return this.world.recoveryTriggered;
  }

  getSnapshot(): TelemetrySnapshot {
    return this.world.snapshot;
  }

  reset(): void {
    this.world = createWorld();
  }

  addNote(incidentId: string, note: string): void {
    const incident = this.world.snapshot.incidents.find((row) => row.id === incidentId);
    if (!incident) {
      throw notFound("incident", incidentId);
    }
    const existing = this.world.notes[incidentId] ?? [];
    this.world.notes[incidentId] = [...existing, note];
  }

  getNotes(incidentId: string): string[] {
    return this.world.notes[incidentId] ?? [];
  }

  rollback(params: RollbackParams): RollbackResult {
    if (params.service !== PRIMARY_SERVICE_ID) {
      throw invalidRollback("rollback is only supported for checkout-api in this dataset", {
        service: params.service,
      });
    }
    if (params.targetVersion !== ROLLBACK_VERSION) {
      throw invalidRollback(`target version must be ${ROLLBACK_VERSION}`, {
        targetVersion: params.targetVersion,
      });
    }

    const known = this.world.snapshot.deployments.some(
      (d) => d.service === params.service && d.version === params.targetVersion,
    );
    if (!known) {
      throw notFound("deployment", `${params.service}@${params.targetVersion}`);
    }

    if (!this.world.recoveryTriggered) {
      this.world.snapshot.deployments = [
        rollbackDeploymentEvent(this.world.snapshot.deployments, params.targetVersion),
        ...this.world.snapshot.deployments,
      ];
      this.world.snapshot.incidents = this.world.snapshot.incidents.map((incident) =>
        incident.id === PRIMARY_INCIDENT_ID ? applyIncidentRecovery(incident) : incident,
      );
      this.world.snapshot.services = this.world.snapshot.services.map((service) =>
        service.id === PRIMARY_SERVICE_ID ? applyServiceRecovery(service) : service,
      );
    }
    this.world.recoveryTriggered = true;

    return {
      service: params.service,
      fromVersion: PRIMARY_VERSION,
      toVersion: params.targetVersion,
      completedAt: DEMO_NOW_ISO,
    };
  }
}

function rollbackDeploymentEvent(deployments: Deployment[], targetVersion: string): Deployment {
  const prior = deployments.find(
    (row) => row.service === PRIMARY_SERVICE_ID && row.version === targetVersion,
  );
  return {
    id: CHECKOUT_ROLLBACK_DEPLOY_ID,
    service: PRIMARY_SERVICE_ID,
    version: targetVersion,
    timestamp: DEMO_NOW_ISO,
    commit: prior?.commit ?? "83af31",
    summary: `Rollback ${PRIMARY_VERSION} to ${targetVersion}`,
  };
}

function applyIncidentRecovery(incident: Incident): Incident {
  return {
    ...incident,
    status: "remediating",
    errorRate: RECOVERY.errorRate,
    p95Latency: RECOVERY.p95LatencyMs,
    requestRate: INCIDENT_PEAK.requestRatePerMin,
  };
}

function applyServiceRecovery(service: Service): Service {
  const errorRate = RECOVERY.errorRate;
  const p95Latency = RECOVERY.p95LatencyMs;
  return {
    ...service,
    errorRate,
    p95Latency,
    status: healthForErrorRate(errorRate),
  };
}

export const telemetryEngine = new TelemetryEngine();
