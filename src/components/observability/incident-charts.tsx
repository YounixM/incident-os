"use client";

import { useMemo, type ReactNode } from "react";
import {
  BASELINE,
  DEMO_NOW_ISO,
  DEPLOY_V231_ISO,
  INCIDENT_OPENED_ISO,
  INCIDENT_PEAK,
  PRIMARY_SERVICE_ID,
  PRIMARY_VERSION,
} from "@/lib/constants";
import { SERIES_START_ISO } from "@/data/story";
import { buildMetricSeries, metricUnit } from "@/data/metrics";
import { useRecoveryTriggered, useTelemetrySnapshot } from "@/components/observability/use-telemetry";
import { MetricChart, type ChartMarker } from "@/components/observability/metric-chart";
import {
  formatErrorRate,
  formatLatency,
  formatRequestRate,
  formatUtcHm,
} from "@/components/observability/format";
import { EmptyState } from "@/components/observability/states";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { cn } from "@/lib/utils";
import type { MetricName, MetricResult } from "@/types";

const DEPLOY_MARKER: ChartMarker = {
  ts: Date.parse(DEPLOY_V231_ISO),
  label: `${PRIMARY_VERSION} ${formatUtcHm(DEPLOY_V231_ISO)}`,
  tone: "warning",
};

const INCIDENT_MARKER: ChartMarker = {
  ts: Date.parse(INCIDENT_OPENED_ISO),
  label: `incident ${formatUtcHm(INCIDENT_OPENED_ISO)}`,
  tone: "critical",
};

type SeriesBundle = {
  errorRate: MetricResult;
  p95: MetricResult;
  requestRate: MetricResult;
};

function lastValue(result: MetricResult): number | undefined {
  return result.points.at(-1)?.value;
}

function peakValue(result: MetricResult): number {
  return result.points.reduce((max, point) => Math.max(max, point.value), Number.NEGATIVE_INFINITY);
}

function metricResult(
  service: string,
  metric: MetricName,
  recoveryTriggered: boolean,
): MetricResult {
  return {
    metric,
    unit: metricUnit(metric),
    points: buildMetricSeries(
      service,
      metric,
      SERIES_START_ISO,
      DEMO_NOW_ISO,
      recoveryTriggered,
    ),
  };
}

export function IncidentCharts({ incidentId }: { incidentId: string }) {
  const snapshot = useTelemetrySnapshot();
  const recoveryTriggered = useRecoveryTriggered();
  const highlightedMetric = useIncidentStore((s) => s.highlightedMetric);
  const incident = snapshot.incidents.find((row) => row.id === incidentId);
  const service = incident?.service ?? PRIMARY_SERVICE_ID;

  const series: SeriesBundle = useMemo(
    () => ({
      errorRate: metricResult(service, "error_rate", recoveryTriggered),
      p95: metricResult(service, "p95_latency", recoveryTriggered),
      requestRate: metricResult(service, "request_rate", recoveryTriggered),
    }),
    [service, recoveryTriggered],
  );

  if (!incident) {
    return (
      <EmptyState
        title="No metrics for this incident"
        description="The incident id is not in the telemetry snapshot."
      />
    );
  }

  const isPrimary = service === PRIMARY_SERVICE_ID;
  const markers: ChartMarker[] = isPrimary ? [DEPLOY_MARKER, INCIDENT_MARKER] : [];
  const errorNow = lastValue(series.errorRate);
  const p95Now = lastValue(series.p95);
  const reqNow = lastValue(series.requestRate);

  return (
    <div className="flex flex-col gap-4">
      <ChartBlock
        title="Error rate"
        metric="error_rate"
        highlighted={highlightedMetric === "error_rate"}
        summary={errorSummary(series.errorRate, isPrimary, recoveryTriggered, errorNow)}
      >
        <MetricChart
          points={series.errorRate.points}
          color="var(--status-critical)"
          formatValue={formatErrorRate}
          yDomain={isPrimary ? [0, 22] : ["auto", "auto"]}
          markers={markers}
          baseline={isPrimary ? BASELINE.errorRate : undefined}
          baselineLabel={isPrimary ? `${BASELINE.errorRate}%` : undefined}
        />
      </ChartBlock>
      <ChartBlock
        title="p95 latency"
        metric="p95_latency"
        highlighted={highlightedMetric === "p95_latency"}
        summary={latencySummary(series.p95, isPrimary, recoveryTriggered, p95Now)}
      >
        <MetricChart
          points={series.p95.points}
          color="var(--status-warning)"
          formatValue={formatLatency}
          markers={isPrimary ? [DEPLOY_MARKER] : []}
          baseline={isPrimary ? BASELINE.p95LatencyMs : undefined}
          baselineLabel={isPrimary ? formatLatency(BASELINE.p95LatencyMs) : undefined}
        />
      </ChartBlock>
      <ChartBlock
        title="Request rate"
        metric="request_rate"
        highlighted={highlightedMetric === "request_rate"}
        summary={requestSummary(series.requestRate, isPrimary, reqNow)}
      >
        <MetricChart
          points={series.requestRate.points}
          color="var(--status-info)"
          formatValue={formatRequestRate}
          markers={isPrimary ? [DEPLOY_MARKER] : []}
          baseline={isPrimary ? BASELINE.requestRatePerMin : undefined}
          baselineLabel={isPrimary ? formatRequestRate(BASELINE.requestRatePerMin) : undefined}
        />
      </ChartBlock>
    </div>
  );
}

function ChartBlock({
  title,
  metric,
  summary,
  highlighted,
  children,
}: {
  title: string;
  metric: MetricName;
  summary: string;
  highlighted: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={`metric-${metric}`}
      data-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-md p-1.5 -m-1.5",
        highlighted && "bg-status-warning/8 ring-1 ring-status-warning/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {title}
          {highlighted ? <span className="sr-only"> Agent focused</span> : null}
        </h3>
        <span className="font-mono text-[10px] text-muted-foreground">{metric}</span>
      </div>
      {children}
      <p className="text-[11px] leading-snug text-muted-foreground">{summary}</p>
    </div>
  );
}

function errorSummary(
  result: MetricResult,
  isPrimary: boolean,
  recovery: boolean,
  current: number | undefined,
): string {
  if (current === undefined) {
    return "No error-rate samples in range.";
  }
  if (!isPrimary) {
    return `Current error rate ${formatErrorRate(current)}. Peak ${formatErrorRate(peakValue(result))}.`;
  }
  if (recovery) {
    return `Error rate recovering toward 1.1% after rollback. Current ${formatErrorRate(current)}. Peak was ${formatErrorRate(INCIDENT_PEAK.errorRate)} after ${PRIMARY_VERSION} at ${formatUtcHm(DEPLOY_V231_ISO)}.`;
  }
  return `Error rate rose from ${BASELINE.errorRate}% to ${formatErrorRate(INCIDENT_PEAK.errorRate)} after ${PRIMARY_VERSION} at ${formatUtcHm(DEPLOY_V231_ISO)}. Current ${formatErrorRate(current)}.`;
}

function latencySummary(
  result: MetricResult,
  isPrimary: boolean,
  recovery: boolean,
  current: number | undefined,
): string {
  if (current === undefined) {
    return "No p95 samples in range.";
  }
  if (!isPrimary) {
    return `Current p95 ${formatLatency(current)}. Peak ${formatLatency(peakValue(result))}.`;
  }
  if (recovery) {
    return `p95 recovering toward 430ms after rollback. Current ${formatLatency(current)}. Peak was ${formatLatency(INCIDENT_PEAK.p95LatencyMs)}.`;
  }
  return `p95 rose from ${formatLatency(BASELINE.p95LatencyMs)} to ${formatLatency(INCIDENT_PEAK.p95LatencyMs)} after the ${PRIMARY_VERSION} deploy. Current ${formatLatency(current)}.`;
}

function requestSummary(
  result: MetricResult,
  isPrimary: boolean,
  current: number | undefined,
): string {
  if (current === undefined) {
    return "No request-rate samples in range.";
  }
  if (!isPrimary) {
    return `Current request rate ${formatRequestRate(current)}. Peak ${formatRequestRate(peakValue(result))}.`;
  }
  return `Traffic rose from ${formatRequestRate(BASELINE.requestRatePerMin)} to ${formatRequestRate(INCIDENT_PEAK.requestRatePerMin)}. The increase is too small to explain the error-rate jump. Current ${formatRequestRate(current)}.`;
}
