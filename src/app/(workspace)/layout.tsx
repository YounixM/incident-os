import { AgentColumnSlot } from "@/components/layout/agent-column-slot";
import { AppShell } from "@/components/layout/app-shell";

export default function WorkspaceLayout({ children, agent }: LayoutProps<"/">) {
  return <AppShell agent={agent ?? <AgentColumnSlot />}>{children}</AppShell>;
}
