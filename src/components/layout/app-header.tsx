"use client";

import Link from "next/link";
import { Menu, PanelRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppMark } from "@/components/layout/app-mark";
import { StatusDot } from "@/components/layout/status-indicator";
import { PRIMARY_INCIDENT_CHROME } from "@/components/layout/primary-incident";
import { DEMO_NOW_ISO } from "@/lib/constants";

export function AppHeader({
  navOpen,
  agentOpen,
  onToggleNav,
  onToggleAgent,
}: {
  navOpen: boolean;
  agentOpen: boolean;
  onToggleNav: () => void;
  onToggleAgent: () => void;
}) {
  return (
    <header className="relative z-50 flex h-11 shrink-0 items-center gap-3 border-b border-border bg-background px-2 xl:px-3">
      <div className="flex items-center gap-1 xl:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={navOpen}
          aria-controls="app-nav"
          onClick={onToggleNav}
        >
          {navOpen ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <Menu className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {navOpen ? "Close navigation" : "Open navigation"}
          </span>
        </Button>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-sm font-medium tracking-tight text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <AppMark />
        IncidentOS
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <div
          className="flex items-center gap-2"
          aria-label="Production environment healthy"
        >
          <StatusDot tone="healthy" label="Production" />
        </div>
        <time
          dateTime={DEMO_NOW_ISO}
          className="font-mono text-xs tabular-nums text-muted-foreground"
        >
          {PRIMARY_INCIDENT_CHROME.clockLabel}
        </time>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="xl:hidden"
          aria-expanded={agentOpen}
          aria-controls="agent-column"
          onClick={onToggleAgent}
        >
          {agentOpen ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <PanelRight className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {agentOpen ? "Close agent panel" : "Open agent panel"}
          </span>
        </Button>
      </div>
    </header>
  );
}
