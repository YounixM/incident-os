import { generateText, isStepCount } from "ai";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/prompts";
import { llmTools } from "@/lib/agent/llm-tools";
import { toModelMessages, type AgentTurnRequest, type AgentTurnResponse } from "@/lib/agent/turn-protocol";
import { isForceDemo } from "@/lib/fast-telemetry";

function isLlmAvailable(): boolean {
  if (isForceDemo()) {
    return false;
  }
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function GET(): Promise<Response> {
  return Response.json({ available: isLlmAvailable() });
}

export async function POST(request: Request): Promise<Response> {
  if (!isLlmAvailable()) {
    return Response.json({ error: "LLM unavailable" }, { status: 503 });
  }

  let body: AgentTurnRequest;
  try {
    body = (await request.json()) as AgentTurnRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  try {
    const result = await generateText({
      model: process.env.LLM_MODEL ?? "anthropic/claude-sonnet-4.6",
      instructions: AGENT_SYSTEM_PROMPT,
      messages: toModelMessages(body.messages),
      tools: llmTools,
      stopWhen: isStepCount(1),
    });

    const call = result.toolCalls[0];
    if (call) {
      const payload: AgentTurnResponse = {
        toolName: call.toolName,
        input: call.input,
        toolCallId: call.toolCallId,
      };
      return Response.json(payload);
    }

    const payload: AgentTurnResponse = { text: result.text };
    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent turn failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

