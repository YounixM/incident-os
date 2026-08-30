"use client";

import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitAgentPrompt } from "@/lib/agent/controller";
import { TRAFFIC_CHALLENGE_CHIP } from "@/lib/agent/run-options";
import { useIncidentStore } from "@/lib/store/use-incident-store";

export function AgentInputBar() {
  const [value, setValue] = useState("");
  const agentStatus = useIncidentStore((s) => s.agent.status);
  const placeholder =
    agentStatus === "waiting" ? TRAFFIC_CHALLENGE_CHIP : "Ask the agent...";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = value.trim();
    if (!text) {
      return;
    }
    setValue("");
    void submitAgentPrompt(text);
  }

  return (
    <div className="shrink-0 border-t border-border bg-background">
      <form
        onSubmit={handleSubmit}
        aria-label="Ask the agent"
        className="flex items-center gap-2 px-3 py-2"
      >
        <Label htmlFor="agent-prompt" className="sr-only">
          Ask the agent
        </Label>
        <Input
          id="agent-prompt"
          name="prompt"
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          aria-describedby="agent-input-hint"
          className="h-8"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <p id="agent-input-hint" className="sr-only">
          Press Enter to send a message to the investigation agent.
        </p>
        <Button type="submit" size="sm">
          <Send data-icon="inline-start" className="size-3.5" aria-hidden="true" />
          Send
        </Button>
      </form>
    </div>
  );
}
