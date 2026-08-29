import { INCIDENT_PEAK, SERVICE_IDS } from "@/lib/constants";
import type { Service, ServiceStatus } from "@/types";

const SERVICE_NAME: Record<(typeof SERVICE_IDS)[number], string> = {
  frontend: "Frontend",
  "checkout-api": "Checkout API",
  "payment-service": "Payment Service",
  "inventory-service": "Inventory Service",
  "user-service": "User Service",
};

export function buildServices(): Service[] {
  return [
    {
      id: "frontend",
      name: SERVICE_NAME.frontend,
      status: "healthy",
      dependencies: ["checkout-api"],
      errorRate: 0.2,
      p95Latency: 90,
    },
    {
      id: "checkout-api",
      name: SERVICE_NAME["checkout-api"],
      status: "critical",
      dependencies: ["payment-service", "inventory-service", "user-service"],
      errorRate: INCIDENT_PEAK.errorRate,
      p95Latency: INCIDENT_PEAK.p95LatencyMs,
    },
    {
      id: "payment-service",
      name: SERVICE_NAME["payment-service"],
      status: "degraded",
      dependencies: [],
      errorRate: 0.4,
      p95Latency: 380,
    },
    {
      id: "inventory-service",
      name: SERVICE_NAME["inventory-service"],
      status: "degraded",
      dependencies: [],
      errorRate: 0.9,
      p95Latency: 160,
    },
    {
      id: "user-service",
      name: SERVICE_NAME["user-service"],
      status: "healthy",
      dependencies: [],
      errorRate: 0.15,
      p95Latency: 70,
    },
  ];
}

export function healthForErrorRate(errorRate: number): ServiceStatus {
  if (errorRate >= 5) {
    return "critical";
  }
  if (errorRate >= 1) {
    return "degraded";
  }
  return "healthy";
}
