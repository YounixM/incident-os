export function isFastTelemetry(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FAST_TELEMETRY === "1") {
    return true;
  }
  if (typeof window !== "undefined") {
    if (window.__INCIDENTOS_FAST === true) {
      return true;
    }
    try {
      return new URLSearchParams(window.location.search).get("fast") === "1";
    } catch {
      return false;
    }
  }
  return false;
}

export function isForceDemo(): boolean {
  if (typeof process !== "undefined") {
    if (process.env.NEXT_PUBLIC_FORCE_DEMO === "1") {
      return true;
    }
    if (
      process.env.NEXT_PUBLIC_FORCE_DEMO !== "0" &&
      process.env.VERCEL_ENV === "production"
    ) {
      return true;
    }
  }
  return typeof window !== "undefined" && window.__INCIDENTOS_FORCE_DEMO === true;
}
