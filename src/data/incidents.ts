import {
  INCIDENT_OPENED_ISO,
  INCIDENT_PEAK,
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
} from "@/lib/constants";
import type { Incident } from "@/types";
import { INVENTORY_INCIDENT_ID, PAYMENT_INCIDENT_ID } from "./story";

export function buildIncidents(): Incident[] {
  return [
    {
      id: PRIMARY_INCIDENT_ID,
      title: "Checkout API — Elevated Error Rate",
      severity: "SEV-1",
      service: PRIMARY_SERVICE_ID,
      status: "investigating",
      startedAt: INCIDENT_OPENED_ISO,
      description:
        "Error rate on checkout-api rose from 0.8% to 18.4% after the v2.31 deploy at 13:45. p95 latency is 2.8s (baseline 420ms). Customer checkout is failing. Database query time is elevated.",
      errorRate: INCIDENT_PEAK.errorRate,
      p95Latency: INCIDENT_PEAK.p95LatencyMs,
      requestRate: INCIDENT_PEAK.requestRatePerMin,
      affectedUsersPercent: INCIDENT_PEAK.affectedUsersPercent,
    },
    {
      id: PAYMENT_INCIDENT_ID,
      title: "Payment Service — Elevated Latency",
      severity: "SEV-2",
      service: "payment-service",
      status: "investigating",
      startedAt: "2026-08-31T11:18:00.000Z",
      description:
        "p95 authorize latency on payment-service has been running above the 300ms SLO since late morning. Error rate remains near baseline. Not correlated with checkout-api v2.31.",
      errorRate: 0.4,
      p95Latency: 380,
      requestRate: 8_200,
      affectedUsersPercent: 6,
    },
    {
      id: INVENTORY_INCIDENT_ID,
      title: "Inventory API — Increased 5xx Responses",
      severity: "SEV-3",
      service: "inventory-service",
      status: "monitoring",
      startedAt: "2026-08-31T10:42:00.000Z",
      description:
        "Brief 5xx spike on inventory-service around 10:40. Rate has since receded. Residual error rate ~0.9%. No checkout-api dependency failure indicated.",
      errorRate: 0.9,
      p95Latency: 160,
      requestRate: 12_400,
      affectedUsersPercent: 2,
    },
  ];
}
