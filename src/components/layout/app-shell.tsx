"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AgentInputBar } from "@/components/layout/agent-input-bar";
import { AppHeader } from "@/components/layout/app-header";
import { AppNav } from "@/components/layout/app-nav";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { cn } from "@/lib/utils";

const NAV_COLLAPSED_KEY = "incidentos.nav-collapsed";
const navCollapsedListeners = new Set<() => void>();

function subscribeNavCollapsed(onStoreChange: () => void): () => void {
  navCollapsedListeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    navCollapsedListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readNavCollapsed(): boolean {
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeNavCollapsed(next: boolean): void {
  try {
    window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
  for (const listener of navCollapsedListeners) {
    listener();
  }
}

export function AppShell({
  children,
  agent,
}: {
  children: ReactNode;
  agent: ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const navCollapsed = useSyncExternalStore(
    subscribeNavCollapsed,
    readNavCollapsed,
    () => false,
  );
  const [agentOpen, setAgentOpen] = useState(false);
  const [pathForPanels, setPathForPanels] = useState(pathname);
  const backdropId = useId();

  if (pathForPanels !== pathname) {
    setPathForPanels(pathname);
    setNavOpen(false);
    setAgentOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNavOpen(false);
        setAgentOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleNavCollapsed() {
    writeNavCollapsed(!navCollapsed);
  }

  const overlayOpen = navOpen || agentOpen;

  return (
    <div className="flex h-dvh min-h-[100dvh] flex-col overflow-hidden bg-background">
      <SkipToContent />
      <AppHeader
        navOpen={navOpen}
        agentOpen={agentOpen}
        onToggleNav={() => {
          setNavOpen((open) => !open);
          setAgentOpen(false);
        }}
        onToggleAgent={() => {
          setAgentOpen((open) => !open);
          setNavOpen(false);
        }}
      />

      <div
        className={cn(
          "relative grid min-h-0 flex-1 grid-cols-1 duration-200",
          navCollapsed
            ? "xl:grid-cols-[3.25rem_minmax(0,1fr)_19rem]"
            : "xl:grid-cols-[13rem_minmax(0,1fr)_19rem]",
        )}
      >
        {overlayOpen ? (
          <button
            type="button"
            id={backdropId}
            aria-label="Close panel"
            className="fixed inset-0 z-30 bg-black/50 xl:hidden"
            onClick={() => {
              setNavOpen(false);
              setAgentOpen(false);
            }}
          />
        ) : null}

        <nav
          id="app-nav"
          aria-label="Main"
          data-collapsed={navCollapsed ? "true" : "false"}
          className={cn(
            "min-h-0 flex-col overflow-visible border-border bg-background",
            "xl:relative xl:z-20 xl:flex xl:border-r",
            navOpen
              ? "max-xl:fixed max-xl:inset-y-0 max-xl:left-0 max-xl:z-40 max-xl:flex max-xl:w-[13rem] max-xl:border-r max-xl:shadow-md"
              : "max-xl:hidden",
          )}
        >
          <AppNav
            collapsed={navCollapsed}
            onNavigate={() => setNavOpen(false)}
            onToggleCollapsed={toggleNavCollapsed}
          />
        </nav>

        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 min-w-0 overflow-y-auto bg-background"
        >
          {children}
        </main>

        <aside
          id="agent-column"
          aria-label="AI investigation"
          className={cn(
            "min-h-0 flex-col border-border bg-background",
            "xl:relative xl:z-auto xl:flex xl:border-l",
            agentOpen
              ? "max-xl:fixed max-xl:inset-y-0 max-xl:right-0 max-xl:z-40 max-xl:flex max-xl:w-[min(19rem,100%)] max-xl:border-l max-xl:shadow-md"
              : "max-xl:hidden",
          )}
        >
          {agent}
        </aside>
      </div>

      <AgentInputBar />
    </div>
  );
}
