import { cn } from "@/lib/utils";

/** Keep in sync with `src/app/icon.svg`. */
export const APP_MARK = {
  tile: "#171717",
  bar: "#a3a3a3",
  spike: "#f07162",
} as const;

export function AppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-6 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="6" fill={APP_MARK.tile} />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="5.5"
        fill="none"
        stroke="#3f3f46"
        strokeWidth="1"
      />
      <rect x="5" y="18" width="4" height="8" rx="1" fill={APP_MARK.bar} />
      <rect x="11" y="14" width="4" height="12" rx="1" fill={APP_MARK.bar} />
      <rect x="17" y="8" width="4" height="18" rx="1" fill={APP_MARK.spike} />
      <rect x="23" y="16" width="4" height="10" rx="1" fill={APP_MARK.bar} />
    </svg>
  );
}
