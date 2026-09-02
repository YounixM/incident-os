import type { Metadata } from "next";
import { PRIMARY_INCIDENT_ID } from "@/lib/constants";
import { INVENTORY_INCIDENT_ID, PAYMENT_INCIDENT_ID } from "@/data/story";
import {
  WorkspacePage,
  WorkspaceSlot,
} from "@/components/layout/workspace-slot";
import { IncidentCharts } from "@/components/observability/incident-charts";
import { IncidentHeader } from "@/components/observability/incident-header";
import { IncidentKpis } from "@/components/observability/incident-kpis";
import { IncidentRecoveryBanner } from "@/components/observability/incident-recovery-banner";
import { IncidentTimeline } from "@/components/observability/incident-timeline";
import { DeploymentsTable } from "@/components/observability/deployments-table";
import { LogsPanel } from "@/components/observability/logs-panel";
import { ServiceGraph } from "@/components/observability/service-graph";
import { TracesPanel } from "@/components/observability/traces-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id === PRIMARY_INCIDENT_ID) {
    return { title: "Checkout API — Elevated Error Rate" };
  }
  return { title: id };
}

export function generateStaticParams() {
  return [
    { id: PRIMARY_INCIDENT_ID },
    { id: PAYMENT_INCIDENT_ID },
    { id: INVENTORY_INCIDENT_ID },
  ];
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage>
      <IncidentHeader incidentId={id} />
      <IncidentRecoveryBanner incidentId={id} />
      <IncidentKpis incidentId={id} />

      <WorkspaceSlot slot="incident-charts" id="metrics" label="Metrics">
        <IncidentCharts incidentId={id} />
      </WorkspaceSlot>

      <WorkspaceSlot slot="incident-timeline" id="timeline" label="Timeline">
        <IncidentTimeline incidentId={id} />
      </WorkspaceSlot>

      <div className="grid gap-3 lg:grid-cols-2">
        <WorkspaceSlot slot="incident-traces" id="traces" label="Traces">
          <TracesPanel incidentId={id} />
        </WorkspaceSlot>
        <WorkspaceSlot slot="incident-logs" id="logs" label="Logs">
          <LogsPanel incidentId={id} />
        </WorkspaceSlot>
      </div>

      <WorkspaceSlot slot="incident-deployments" id="deployments" label="Deployments">
        <DeploymentsTable incidentId={id} />
      </WorkspaceSlot>

      <WorkspaceSlot slot="incident-service-graph" id="service-graph" label="Service graph">
        <ServiceGraph incidentId={id} />
      </WorkspaceSlot>
    </WorkspacePage>
  );
}
