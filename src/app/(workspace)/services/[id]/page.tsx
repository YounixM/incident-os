import type { Metadata } from "next";
import { SERVICE_IDS } from "@/lib/constants";
import { WorkspacePage } from "@/components/layout/workspace-slot";
import { ServiceDetailView } from "@/components/observability/service-views";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export function generateStaticParams() {
  return SERVICE_IDS.map((id) => ({ id }));
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage>
      <ServiceDetailView serviceId={id} />
    </WorkspacePage>
  );
}
