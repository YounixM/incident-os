"use client";

import { useEffect } from "react";
import { registerIncidentOsTools } from "@/lib/webmcp/register";

export function WebMcpRegistrar() {
  useEffect(() => {
    const controller = new AbortController();
    void registerIncidentOsTools(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);
  return null;
}
