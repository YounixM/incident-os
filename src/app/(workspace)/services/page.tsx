import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-slot";
import { ServiceListView } from "@/components/observability/service-views";

export const metadata: Metadata = {
  title: "Services",
};

export default function ServicesPage() {
  return (
    <WorkspacePage>
      <header className="flex flex-col gap-0.5">
        <h1 className="text-sm font-medium tracking-tight">Services</h1>
        <p className="text-xs text-muted-foreground">
          Production service health. Incident is localized to checkout-api.
        </p>
      </header>
      <ServiceListView />
    </WorkspacePage>
  );
}
