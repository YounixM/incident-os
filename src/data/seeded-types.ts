import type { Trace } from "@/types";

/** TraceQuery filters by time, but the public Trace type has no timestamp (type gap). */
export interface SeededTrace extends Trace {
  timestamp: string;
}
