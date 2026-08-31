import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { AgentMessageKind } from "@/types";
import { nextAgentId, nextAgentTimestamp } from "./clock";

export function addAgentMessage(kind: AgentMessageKind, text: string): void {
  useIncidentStore.getState().addAgentMessage({
    id: nextAgentId("msg"),
    timestamp: nextAgentTimestamp(),
    kind,
    text,
  });
}
