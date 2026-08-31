import type { AgentTurnMessage, AgentTurnRequest, AgentTurnResponse } from "./turn-protocol";
import { LlmUnavailableError } from "./llm-unavailable";

export async function probeLlmAvailable(signal?: AbortSignal): Promise<boolean> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 2500);
  const onParentAbort = (): void => timeout.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });
  try {
    const response = await fetch("/api/agent/turn", {
      method: "GET",
      signal: timeout.signal,
    });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { available?: boolean };
    return body.available === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onParentAbort);
  }
}

export async function requestAgentTurn(
  messages: AgentTurnMessage[],
  signal?: AbortSignal,
): Promise<AgentTurnResponse> {
  const body: AgentTurnRequest = { messages };
  const response = await fetch("/api/agent/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 503) {
    throw new LlmUnavailableError();
  }
  if (!response.ok) {
    throw new Error(`Agent turn failed (${response.status})`);
  }
  return (await response.json()) as AgentTurnResponse;
}
