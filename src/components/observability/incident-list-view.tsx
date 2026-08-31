"use client";

import Link from "next/link";
import { PRIMARY_INCIDENT_ID } from "@/lib/constants";
import { SeverityBadge, StatusDot } from "@/components/layout/status-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIncidentDuration, formatUtcHm } from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { incidentStatusLabel, incidentStatusTone } from "@/components/observability/status";
import { useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { useIncidentStore } from "@/lib/store/use-incident-store";

export function IncidentListView() {
  const snapshot = useTelemetrySnapshot();
  const storeStatus = useIncidentStore((s) => s.incidentStatus);
  const incidents = snapshot.incidents.slice().sort((a, b) => {
    const rank = (id: string) => (id === PRIMARY_INCIDENT_ID ? 0 : 1);
    const byRank = rank(a.id) - rank(b.id);
    if (byRank !== 0) {
      return byRank;
    }
    return Date.parse(b.startedAt) - Date.parse(a.startedAt);
  });

  if (incidents.length === 0) {
    return (
      <EmptyState
        title="No incidents"
        description="The telemetry snapshot does not contain any incidents."
      />
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-[11px]">Severity</TableHead>
            <TableHead className="h-8 text-[11px]">Incident</TableHead>
            <TableHead className="h-8 text-[11px]">Service</TableHead>
            <TableHead className="h-8 text-[11px]">Status</TableHead>
            <TableHead className="h-8 text-[11px]">Started</TableHead>
            <TableHead className="h-8 text-right text-[11px]">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => {
            const status =
              incident.id === PRIMARY_INCIDENT_ID ? storeStatus : incident.status;
            return (
              <TableRow key={incident.id} className="h-12">
                <TableCell>
                  <SeverityBadge severity={incident.severity} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/incidents/${incident.id}`}
                    data-incident-id={incident.id}
                    className="text-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {incident.title}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-[12px] text-muted-foreground">
                  {incident.service}
                </TableCell>
                <TableCell>
                  <StatusDot
                    tone={incidentStatusTone(status)}
                    label={incidentStatusLabel(status)}
                  />
                </TableCell>
                <TableCell className="font-mono text-[12px] tabular-nums text-muted-foreground">
                  <time dateTime={incident.startedAt}>{formatUtcHm(incident.startedAt)}</time>
                </TableCell>
                <TableCell className="text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                  {formatIncidentDuration(incident.startedAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
