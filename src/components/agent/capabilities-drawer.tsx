"use client";

import { AGENT_CAPABILITIES } from "@/lib/webmcp/catalog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ToolName } from "@/types";
import { cn } from "@/lib/utils";

export function CapabilitiesDrawer({ lastTool }: { lastTool: ToolName | null }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          id="agent-capabilities"
          variant="ghost"
          size="xs"
          className={cn(lastTool && "text-foreground")}
          aria-live="polite"
        >
          {lastTool ? lastTool : "Capabilities"}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Agent capabilities</SheetTitle>
          <SheetDescription>
            Application tools the agent can invoke. Highlight shows the last call.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {AGENT_CAPABILITIES.map((group) => (
            <section key={group.category} className="flex flex-col gap-1.5">
              <h3 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {group.category}
              </h3>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = lastTool === item.name;
                  return (
                    <li
                      key={item.name}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs",
                        active ? "bg-muted text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="font-mono text-[10px]">{item.name}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
