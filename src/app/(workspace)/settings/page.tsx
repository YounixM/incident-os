import type { Metadata } from "next";
import { WebMcpStatus } from "@/components/agent/webmcp-status";
import { WorkspacePage } from "@/components/layout/workspace-slot";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <WorkspacePage className="max-w-xl">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-sm font-medium tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Demo workspace. No authentication. Environment is synthetic.
        </p>
      </header>

      <dl className="divide-y divide-border rounded-md border border-border text-sm">
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">Environment</dt>
          <dd className="font-mono text-xs">production (simulated)</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">Clock</dt>
          <dd className="font-mono text-xs tabular-nums">14:32 UTC (frozen)</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">Auth</dt>
          <dd className="text-xs">Disabled</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">WebMCP</dt>
          <dd>
            <WebMcpStatus />
          </dd>
        </div>
      </dl>
    </WorkspacePage>
  );
}
