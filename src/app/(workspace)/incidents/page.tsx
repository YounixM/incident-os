import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-slot";
import { IncidentListView } from "@/components/observability/incident-list-view";

export const metadata: Metadata = {
  title: "Incidents",
};

export default function IncidentsPage() {
  return (
    <WorkspacePage>
      <header className="flex flex-col gap-0.5">
        <h1 className="text-sm font-medium tracking-tight">Incidents</h1>
        <p className="text-xs text-muted-foreground">
          Active and recently opened production incidents
        </p>
      </header>
      <IncidentListView />
    </WorkspacePage>
  );
}
