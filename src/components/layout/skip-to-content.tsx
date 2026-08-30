export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-1.5 focus:text-sm focus:text-foreground focus:shadow-sm focus:ring-3 focus:ring-ring/50 focus:outline-none"
    >
      Skip to content
    </a>
  );
}
