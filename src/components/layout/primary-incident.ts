import {
  DEMO_NOW_ISO,
  HTTP_500_SPIKE_ISO,
  INCIDENT_PEAK,
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
} from "@/lib/constants";
import { durationUtc, formatRequestRateK, formatUtcHm } from "@/components/layout/format";

export const PRIMARY_INCIDENT_CHROME = {
  id: PRIMARY_INCIDENT_ID,
  service: PRIMARY_SERVICE_ID,
  title: "Checkout API — Elevated Error Rate",
  heading: "Checkout API",
  subtitle: "Elevated Error Rate",
  severity: "SEV-1" as const,
  statusLabel: "Investigating",
  startedLabel: formatUtcHm(HTTP_500_SPIKE_ISO),
  durationLabel: durationUtc(HTTP_500_SPIKE_ISO, DEMO_NOW_ISO),
  clockLabel: formatUtcHm(DEMO_NOW_ISO),
  kpis: {
    errorRate: `${INCIDENT_PEAK.errorRate}%`,
    p95: `${(INCIDENT_PEAK.p95LatencyMs / 1000).toFixed(1)}s`,
    requestRate: `${formatRequestRateK(INCIDENT_PEAK.requestRatePerMin)}/min`,
    impact: `${INCIDENT_PEAK.affectedUsersPercent}%`,
  },
} as const;

export const INCIDENT_LIST_CHROME = [
  {
    id: PRIMARY_INCIDENT_ID,
    severity: "SEV-1" as const,
    title: PRIMARY_INCIDENT_CHROME.title,
    service: PRIMARY_SERVICE_ID,
    statusLabel: "Investigating",
    startedLabel: PRIMARY_INCIDENT_CHROME.startedLabel,
    durationLabel: PRIMARY_INCIDENT_CHROME.durationLabel,
  },
  {
    id: "payment-service-latency",
    severity: "SEV-2" as const,
    title: "Payment Service — Elevated Latency",
    service: "payment-service",
    statusLabel: "Investigating",
    startedLabel: "12:18",
    durationLabel: "2h 14m",
  },
  {
    id: "inventory-api-5xx",
    severity: "SEV-3" as const,
    title: "Inventory API — Increased 5xx Responses",
    service: "inventory-service",
    statusLabel: "Monitoring",
    startedLabel: "09:40",
    durationLabel: "4h 52m",
  },
] as const;
