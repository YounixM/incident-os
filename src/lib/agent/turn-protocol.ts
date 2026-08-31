import type { ModelMessage } from "ai";

export type AgentTurnUserMessage = {
  role: "user";
  content: string;
};

export type AgentTurnAssistantMessage = {
  role: "assistant";
  content: string;
};

export type AgentTurnToolMessage = {
  role: "tool";
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
};

export type AgentTurnMessage =
  | AgentTurnUserMessage
  | AgentTurnAssistantMessage
  | AgentTurnToolMessage;

export type AgentTurnRequest = {
  messages: AgentTurnMessage[];
};

export type AgentTurnResponse =
  | { text: string }
  | { toolName: string; input: unknown; toolCallId: string };

export function toModelMessages(messages: AgentTurnMessage[]): ModelMessage[] {
  const converted: ModelMessage[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "user":
        converted.push({ role: "user", content: message.content });
        break;
      case "assistant":
        converted.push({ role: "assistant", content: message.content });
        break;
      case "tool":
        converted.push({
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: message.toolCallId,
              toolName: message.toolName,
              input: message.input,
            },
          ],
        });
        converted.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: message.toolCallId,
              toolName: message.toolName,
              output: { type: "json", value: message.output as never },
            },
          ],
        });
        break;
      default: {
        const _exhaustive: never = message;
        return _exhaustive;
      }
    }
  }
  return converted;
}
