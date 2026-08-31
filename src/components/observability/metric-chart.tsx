"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUtcHm } from "@/components/observability/format";
import { cn } from "@/lib/utils";
import type { MetricPoint } from "@/types";

export interface ChartMarker {
  ts: number;
  label: string;
  tone: "warning" | "critical" | "info";
}

interface ChartRow {
  ts: number;
  value: number;
  iso: string;
}

const TONE_STROKE: Record<ChartMarker["tone"], string> = {
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  info: "var(--status-info)",
};

function toRows(points: MetricPoint[]): ChartRow[] {
  return points.map((point) => ({
    ts: Date.parse(point.timestamp),
    value: point.value,
    iso: point.timestamp,
  }));
}

function MetricTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: string | number;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0];
  const value = typeof entry.value === "number" ? entry.value : Number(entry.value);
  const ts = typeof label === "number" ? label : Number(label);
  if (!Number.isFinite(value) || !Number.isFinite(ts)) {
    return null;
  }
  return (
    <div className="rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] text-popover-foreground shadow-sm">
      <p className="font-mono tabular-nums text-muted-foreground">{formatUtcHm(new Date(ts).toISOString())}</p>
      <p className="font-mono tabular-nums">{formatValue(value)}</p>
    </div>
  );
}

export function MetricChart({
  points,
  color,
  formatValue,
  yDomain,
  markers = [],
  baseline,
  baselineLabel,
  className,
}: {
  points: MetricPoint[];
  color: string;
  formatValue: (value: number) => string;
  yDomain?: [number, number] | ["auto", "auto"];
  markers?: ChartMarker[];
  baseline?: number;
  baselineLabel?: string;
  className?: string;
}) {
  const data = useMemo(() => toRows(points), [points]);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className={cn("h-40 w-full min-w-0", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value: number) => formatUtcHm(new Date(value).toISOString())}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={28}
            height={22}
          />
          <YAxis
            width={48}
            domain={yDomain ?? ["auto", "auto"]}
            tickFormatter={(value: number) => formatValue(value)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={(props) => (
              <MetricTooltip
                active={props.active}
                payload={props.payload}
                label={props.label}
                formatValue={formatValue}
              />
            )}
            isAnimationActive={false}
          />
          {baseline !== undefined ? (
            <ReferenceLine
              y={baseline}
              stroke="var(--muted-foreground)"
              strokeDasharray="2 4"
              ifOverflow="visible"
              label={{
                value: baselineLabel ?? "baseline",
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 9,
              }}
            />
          ) : null}
          {markers.map((marker) => (
            <ReferenceLine
              key={`${marker.ts}-${marker.label}`}
              x={marker.ts}
              stroke={TONE_STROKE[marker.tone]}
              strokeDasharray="4 3"
              ifOverflow="visible"
              label={{
                value: marker.label,
                position: "insideTopLeft",
                fill: TONE_STROKE[marker.tone],
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
