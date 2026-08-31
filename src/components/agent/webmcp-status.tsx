"use client";

import { useEffect, useState } from "react";
import { listTools } from "@/lib/webmcp/catalog";
import { getModelContext } from "@/lib/webmcp/model-context";

type ProbeState = "checking" | "available" | "unavailable";

const EXPECTED_TOOL_COUNT = listTools().length;

export function WebMcpStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<ProbeState>("checking");
  const [toolCount, setToolCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function probe(): Promise<void> {
      for (let waitAttempt = 0; waitAttempt < 40; waitAttempt += 1) {
        if (cancelled) {
          return;
        }
        const ctx = getModelContext();
        if (!ctx) {
          await new Promise((resolve) => {
            setTimeout(resolve, 250);
          });
          continue;
        }
        setState("available");
        if (typeof ctx.getTools !== "function") {
          return;
        }
        for (let attempt = 0; attempt < 12; attempt += 1) {
          try {
            const tools = await ctx.getTools();
            if (cancelled) {
              return;
            }
            setToolCount(tools.length);
            if (tools.length >= EXPECTED_TOOL_COUNT) {
              return;
            }
          } catch {
            if (cancelled) {
              return;
            }
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 250);
          });
        }
        return;
      }
      if (!cancelled) {
        setState("unavailable");
      }
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

  switch (state) {
    case "checking":
      return (
        <span
          id={compact ? "webmcp-status-compact" : "webmcp-status"}
          className="text-xs text-muted-foreground"
        >
          {compact ? "WebMCP" : "Checking"}
        </span>
      );
    case "unavailable":
      return (
        <span
          id={compact ? "webmcp-status-compact" : "webmcp-status"}
          className="text-xs text-muted-foreground"
        >
          {compact ? "WebMCP unavailable · in-app demo" : "WebMCP unavailable. In-app demo still works."}
        </span>
      );
    case "available":
      return (
        <span
          id={compact ? "webmcp-status-compact" : "webmcp-status"}
          className="text-xs text-muted-foreground"
        >
          {compact
            ? toolCount === null
              ? "Site tools on"
              : `WebMCP · ${toolCount}`
            : toolCount === null
              ? "Site tools available"
              : `${toolCount} tool${toolCount === 1 ? "" : "s"} registered`}
        </span>
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
