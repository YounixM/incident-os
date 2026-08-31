"use client";

import { PRIMARY_SERVICE_ID, PRIMARY_VERSION } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDeployTime } from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { cn } from "@/lib/utils";
import type { Deployment } from "@/types";

export function DeploymentsTable({
  incidentId,
  serviceId,
  limit,
}: {
  incidentId?: string;
  serviceId?: string;
  limit?: number;
}) {
  const snapshot = useTelemetrySnapshot();
  const incident = incidentId
    ? snapshot.incidents.find((row) => row.id === incidentId)
    : undefined;
  const service = serviceId ?? incident?.service;

  const rows = snapshot.deployments
    .filter((deployment) => (service ? deployment.service === service : true))
    .slice()
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const visible = limit === undefined ? rows : rows.slice(0, limit);

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No deployments listed"
        description="checkout-api v2.31 at 13:45 is the expected change."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 text-[11px]">Version</TableHead>
          <TableHead className="h-8 text-[11px]">Time</TableHead>
          <TableHead className="h-8 text-[11px]">Commit</TableHead>
          <TableHead className="h-8 text-[11px]">Change</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((deployment) => (
          <DeploymentRow key={deployment.id} deployment={deployment} />
        ))}
      </TableBody>
    </Table>
  );
}

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  const correlated =
    deployment.service === PRIMARY_SERVICE_ID && deployment.version === PRIMARY_VERSION;
  return (
    <TableRow
      className={cn("h-10", correlated && "bg-status-warning/8")}
      data-correlated={correlated ? "true" : undefined}
    >
      <TableCell className="font-mono text-[12px]">
        {deployment.version}
        {correlated ? (
          <span className="ml-2 font-sans text-[10px] font-medium text-status-warning">
            correlated
          </span>
        ) : null}
      </TableCell>
      <TableCell className="font-mono text-[12px] tabular-nums text-muted-foreground">
        <time dateTime={deployment.timestamp}>{formatDeployTime(deployment.timestamp)}</time>
      </TableCell>
      <TableCell className="font-mono text-[12px] text-muted-foreground">
        {deployment.commit}
      </TableCell>
      <TableCell className="text-[12px]">{deployment.summary}</TableCell>
    </TableRow>
  );
}
