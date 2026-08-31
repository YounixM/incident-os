"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { WebMcpRegistrar } from "@/components/agent/webmcp-registrar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <WebMcpRegistrar />
      {children}
    </TooltipProvider>
  );
}
