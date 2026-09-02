import { DEPLOY_V231_ISO, PRIMARY_SERVICE_ID } from "@/lib/constants";
import type { Deployment } from "@/types";
import { createPrng, hexId } from "./prng";
import { SEED, V230_DEPLOY_ISO } from "./story";

interface DeploymentSpec {
  service: string;
  version: string;
  timestamp: string;
  commit?: string;
  summary: string;
}

const SPECS: DeploymentSpec[] = [
  {
    service: PRIMARY_SERVICE_ID,
    version: "v2.31",
    timestamp: DEPLOY_V231_ISO,
    commit: "a91f2c",
    summary: "Optimize checkout query",
  },
  {
    service: PRIMARY_SERVICE_ID,
    version: "v2.30",
    timestamp: V230_DEPLOY_ISO,
    commit: "83af31",
    summary: "Payment retry improvements",
  },
  {
    service: PRIMARY_SERVICE_ID,
    version: "v2.29",
    timestamp: "2026-08-30T16:04:00.000Z",
    summary: "Cart validation timeout padding",
  },
  {
    service: PRIMARY_SERVICE_ID,
    version: "v2.28",
    timestamp: "2026-08-29T14:22:00.000Z",
    summary: "Reduce checkout span cardinality",
  },
  {
    service: PRIMARY_SERVICE_ID,
    version: "v2.27",
    timestamp: "2026-08-28T11:09:00.000Z",
    summary: "Feature flag for express checkout",
  },
  {
    service: PRIMARY_SERVICE_ID,
    version: "v2.26",
    timestamp: "2026-08-26T19:41:00.000Z",
    summary: "Address tax calculation edge case",
  },
  {
    service: PRIMARY_SERVICE_ID,
    version: "v2.25",
    timestamp: "2026-08-24T09:15:00.000Z",
    summary: "Checkout session TTL increase",
  },
  {
    service: "frontend",
    version: "v3.8",
    timestamp: "2026-08-31T08:05:00.000Z",
    summary: "Checkout loading skeleton",
  },
  {
    service: "frontend",
    version: "v3.7",
    timestamp: "2026-08-29T17:33:00.000Z",
    summary: "Fix promo code input focus",
  },
  {
    service: "frontend",
    version: "v3.6",
    timestamp: "2026-08-27T13:12:00.000Z",
    summary: "RUM sampling adjustment",
  },
  {
    service: "frontend",
    version: "v3.5",
    timestamp: "2026-08-22T10:48:00.000Z",
    summary: "New order confirmation layout",
  },
  {
    service: "payment-service",
    version: "v1.18",
    timestamp: "2026-08-30T12:10:00.000Z",
    summary: "Issuer timeout budget 800ms",
  },
  {
    service: "payment-service",
    version: "v1.17",
    timestamp: "2026-08-28T08:55:00.000Z",
    summary: "Idempotency key on capture",
  },
  {
    service: "payment-service",
    version: "v1.16",
    timestamp: "2026-08-25T15:27:00.000Z",
    summary: "Visa 3DS retry policy",
  },
  {
    service: "payment-service",
    version: "v1.15",
    timestamp: "2026-08-21T09:02:00.000Z",
    summary: "Dead-letter queue for webhooks",
  },
  {
    service: "inventory-service",
    version: "v2.4",
    timestamp: "2026-08-30T07:40:00.000Z",
    summary: "Warehouse reservation lock tweak",
  },
  {
    service: "inventory-service",
    version: "v2.3",
    timestamp: "2026-08-27T18:19:00.000Z",
    summary: "SKU cache warmer",
  },
  {
    service: "inventory-service",
    version: "v2.2",
    timestamp: "2026-08-23T11:51:00.000Z",
    summary: "Backorder flag propagation",
  },
  {
    service: "inventory-service",
    version: "v2.1",
    timestamp: "2026-08-19T14:06:00.000Z",
    summary: "Read replica routing",
  },
  {
    service: "user-service",
    version: "v5.2",
    timestamp: "2026-08-31T06:28:00.000Z",
    summary: "Session store connection pooling",
  },
  {
    service: "user-service",
    version: "v5.1",
    timestamp: "2026-08-28T21:14:00.000Z",
    summary: "Profile field validation",
  },
  {
    service: "user-service",
    version: "v5.0",
    timestamp: "2026-08-24T16:37:00.000Z",
    summary: "GDPR export endpoint",
  },
  {
    service: "user-service",
    version: "v4.9",
    timestamp: "2026-08-18T10:00:00.000Z",
    summary: "Auth token rotation",
  },
];

export const CHECKOUT_ROLLBACK_DEPLOY_ID = "deploy-checkout-api-rollback-v2.30";

export function isRollbackDeployment(deployment: Deployment): boolean {
  return deployment.id.includes("-rollback-");
}

export function buildDeployments(): Deployment[] {
  const rng = createPrng(SEED ^ 0xde9107);
  return SPECS.map((spec) => ({
    id: `deploy-${spec.service}-${spec.version}`,
    service: spec.service,
    version: spec.version,
    timestamp: spec.timestamp,
    commit: spec.commit ?? hexId(rng, 3),
    summary: spec.summary,
  }));
}
