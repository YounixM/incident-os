"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleAlert,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  isNavItemActive,
  NAV_ITEMS,
  type NavHref,
} from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<NavHref, LucideIcon> = {
  "/": LayoutDashboard,
  "/incidents": CircleAlert,
  "/services": Network,
  "/settings": Settings,
};

export function AppNav({
  collapsed = false,
  onNavigate,
  onToggleCollapsed,
  className,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const collapseLabel = collapsed ? "Expand navigation" : "Collapse navigation";
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <ul className={cn("flex flex-col gap-0.5 px-2 pt-5", collapsed && "xl:px-1")}>
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href, item.match);
          const Icon = NAV_ICONS[item.href];
          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                collapsed && "xl:justify-center xl:px-0 xl:py-2",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className={cn(collapsed && "xl:sr-only")}>{item.label}</span>
            </Link>
          );

          return (
            <li key={item.href}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="max-xl:hidden">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
      <div className="pointer-events-none absolute right-0 bottom-3 z-20 hidden translate-x-1/2 xl:block">
        <div className="pointer-events-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="border border-border bg-background text-muted-foreground shadow-sm hover:bg-muted"
                aria-label={collapseLabel}
                aria-expanded={!collapsed}
                aria-controls="app-nav"
                onClick={onToggleCollapsed}
              >
                <CollapseIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="max-xl:hidden">
              {collapseLabel}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
