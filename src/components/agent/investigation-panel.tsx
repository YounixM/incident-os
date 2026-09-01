"use client";

import { useEffect, useRef } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/layout/status-indicator";
import { ActivityTimeline } from "@/components/agent/activity-timeline";
import { ApprovalDialog } from "@/components/agent/approval-dialog";
import { CapabilitiesDrawer } from "@/components/agent/capabilities-drawer";
import { WebMcpStatus } from "@/components/agent/webmcp-status";
import { EvidenceList } from "@/components/agent/evidence-list";
import { HypothesisPanel } from "@/components/agent/hypothesis-panel";
import { InvestigationSummary } from "@/components/agent/investigation-summary";
import { ProgressChecklist } from "@/components/agent/progress-checklist";
import {
  resetActiveInvestigation,
  startInvestigation,
  submitAgentPrompt,
} from "@/lib/agent/controller";
import { TRAFFIC_CHALLENGE_CHIP } from "@/lib/agent/run-options";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import type { AgentStatus } from "@/types";

function agentStatusLabel(status: AgentStatus): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "investigating":
      return "Investigating";
    case "waiting":
      return "Waiting";
    case "complete":
      return "Complete";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function agentStatusTone(status: AgentStatus): "critical" | "warning" | "healthy" | "info" {
  switch (status) {
    case "idle":
      return "info";
    case "investigating":
      return "warning";
    case "waiting":
      return "warning";
    case "complete":
      return "healthy";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function InvestigationPanel() {
  const agent = useIncidentStore((s) => s.agent);
  const incidentStatus = useIncidentStore((s) => s.incidentStatus);
  const pendingAction = useIncidentStore((s) => s.approval.pendingAction);
  const approved = useIncidentStore((s) => s.approval.approved);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastActivity = agent.activities.at(-1);

  useEffect(() => {
    if (agent.activities.length === 0) {
      stickToBottomRef.current = true;
    }
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [agent.activities.length, lastActivity?.id, lastActivity?.status, agent.messages.length, agent.progressStep]);

  const lastTool =
    [...agent.activities].reverse().find((activity) => activity.tool)?.tool ?? null;
  const question = [...agent.messages].reverse().find((message) => message.kind === "question");
  const trafficHypothesis = agent.hypotheses.find((row) => row.id === "hyp-traffic-spike");
  const showTrafficChip =
    agent.status === "waiting" &&
    Boolean(question) &&
    !pendingAction &&
    (trafficHypothesis?.status === "active" ||
      (question ? /traffic/i.test(question.text) : false));
  const findings = agent.messages.filter(
    (message) => message.kind === "status" || message.kind === "finding" || message.kind === "hypothesis" || message.kind === "action_proposal",
  );
  const recentFindings = findings.slice(-4);
  const investigationBusy = agent.status === "investigating" || agent.status === "waiting";

  return (
    <div data-slot="agent-workspace" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            AI Investigation
          </p>
          <StatusDot tone={agentStatusTone(agent.status)} label={agentStatusLabel(agent.status)} />
          <p className="truncate text-[11px] text-muted-foreground">checkout-api</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <CapabilitiesDrawer lastTool={lastTool} />
          <WebMcpStatus compact />
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3"
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        <section aria-labelledby="agent-progress-heading">
          <h3
            id="agent-progress-heading"
            className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Progress
          </h3>
          {agent.status === "idle" && agent.progressStep === 0 ? (
            <p className="text-xs text-muted-foreground">
              Waiting to start. Investigation steps will appear here.
            </p>
          ) : (
            <ProgressChecklist progressStep={agent.progressStep} agentStatus={agent.status} />
          )}
        </section>

        <div className="h-px bg-border" role="presentation" />

        <section aria-labelledby="agent-hypothesis-heading">
          <h3
            id="agent-hypothesis-heading"
            className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Current hypothesis
          </h3>
          <HypothesisPanel hypotheses={agent.hypotheses} evidence={agent.evidence} />
        </section>

        <section aria-labelledby="agent-evidence-heading">
          <h3
            id="agent-evidence-heading"
            className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Evidence
          </h3>
          <EvidenceList evidence={agent.evidence} />
        </section>

        {recentFindings.length > 0 ? (
          <section aria-labelledby="agent-findings-heading">
            <h3
              id="agent-findings-heading"
              className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
            >
              Findings
            </h3>
            <ul className="flex flex-col gap-1.5">
              {recentFindings.map((message) => (
                <li key={message.id} className="text-xs leading-snug text-foreground/90">
                  {message.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {showTrafficChip && question ? (
          <section aria-labelledby="agent-question-heading" className="flex flex-col gap-2">
            <h3
              id="agent-question-heading"
              className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
            >
              Human input
            </h3>
            <p className="text-xs leading-snug">{question.text}</p>
            <Button
              type="button"
              id="traffic-challenge-chip"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                void submitAgentPrompt(TRAFFIC_CHALLENGE_CHIP);
              }}
            >
              {TRAFFIC_CHALLENGE_CHIP}
            </Button>
          </section>
        ) : null}

        <InvestigationSummary
          hypotheses={agent.hypotheses}
          evidenceCount={agent.evidence.length}
          incidentStatus={incidentStatus}
          agentStatus={agent.status}
        />

        <section aria-labelledby="agent-activity-heading">
          <h3
            id="agent-activity-heading"
            className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Activity
          </h3>
          <ActivityTimeline activities={agent.activities} />
        </section>
      </div>

      <ApprovalDialog pendingAction={pendingAction} approved={approved} />

      <footer className="flex shrink-0 flex-col gap-1.5 border-t border-border p-2">
        <Button
          type="button"
          id="run-investigation"
          size="sm"
          className="w-full justify-start"
          disabled={investigationBusy}
          onClick={() => {
            void startInvestigation();
          }}
        >
          <Play data-icon="inline-start" className="size-3.5" aria-hidden="true" />
          Investigate with AI
        </Button>
        <Button
          type="button"
          id="reset-investigation"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            resetActiveInvestigation();
          }}
        >
          <RotateCcw data-icon="inline-start" className="size-3.5" aria-hidden="true" />
          Reset Investigation
        </Button>
      </footer>
    </div>
  );
}
