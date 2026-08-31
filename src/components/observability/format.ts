import { durationUtc, formatRequestRateK, formatUtcHm } from "@/components/layout/format";
import { DEMO_NOW_ISO } from "@/lib/constants";

export { durationUtc, formatRequestRateK, formatUtcHm };

export function formatUtcHms(iso: string): string {
  const date = new Date(iso);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatUtcHmsMs(iso: string): string {
  const date = new Date(iso);
  const ms = date.getUTCMilliseconds().toString().padStart(3, "0");
  return `${formatUtcHms(iso)}.${ms}`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    const seconds = ms / 1000;
    return `${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatSpanDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatErrorRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatRequestRate(perMin: number): string {
  return `${formatRequestRateK(perMin)}/min`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDeployTime(iso: string): string {
  const ts = Date.parse(iso);
  const todayStart = Date.parse("2026-08-31T00:00:00.000Z");
  if (ts >= todayStart) {
    return formatUtcHm(iso);
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = Math.max(1, Math.round((todayStart - ts) / dayMs));
  if (daysAgo === 1) {
    return `yesterday ${formatUtcHm(iso)}`;
  }
  return `${daysAgo}d ago ${formatUtcHm(iso)}`;
}

export function formatIncidentDuration(startedAt: string): string {
  return durationUtc(startedAt, DEMO_NOW_ISO);
}

export function splitIncidentTitle(title: string): { heading: string; subtitle: string } {
  const separator = " — ";
  const index = title.indexOf(separator);
  if (index === -1) {
    return { heading: title, subtitle: "" };
  }
  return {
    heading: title.slice(0, index),
    subtitle: title.slice(index + separator.length),
  };
}

export function truncateId(id: string, keep = 8): string {
  if (id.length <= keep) {
    return id;
  }
  return `${id.slice(0, keep)}`;
}
