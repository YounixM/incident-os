import { DEMO_NOW_ISO } from "@/lib/constants";

let seq = 0;

export function resetAgentClock(): void {
  seq = 0;
}

export function nextAgentId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function nextAgentTimestamp(): string {
  const ms = Date.parse(DEMO_NOW_ISO) + seq * 1000;
  return new Date(ms).toISOString();
}
