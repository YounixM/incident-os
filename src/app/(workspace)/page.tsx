import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-slot";
import { OverviewView } from "@/components/observability/overview-view";

export const metadata: Metadata = {
  title: "Overview",
};

export default function OverviewPage() {
  return (
    <WorkspacePage>
      <OverviewView />
    </WorkspacePage>
  );
}
