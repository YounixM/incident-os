import type { ReactNode } from "react";
import { AgentColumnSlot } from "@/components/layout/agent-column-slot";
import { AppShell } from "@/components/layout/app-shell";

export default function WorkspaceLayout({
  children,
  agent,
}: {
  children: ReactNode;
  agent: ReactNode;
}) {
  return <AppShell agent={agent ?? <AgentColumnSlot />}>{children}</AppShell>;
}
