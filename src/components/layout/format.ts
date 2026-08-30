/** Display helpers for frozen UTC demo timestamps and compact telemetry chrome. */

export function formatUtcHm(iso: string): string {
  const date = new Date(iso);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function durationUtc(startIso: string, endIso: string): string {
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
    ),
  );
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatRequestRateK(perMin: number): string {
  const thousands = perMin / 1000;
  const label = Number.isInteger(thousands)
    ? String(thousands)
    : thousands.toFixed(1);
  return `${label}k`;
}
