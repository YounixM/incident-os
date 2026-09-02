# IncidentOS specialist contracts

Orchestrator owns `src/types/**` and `src/lib/constants.ts`. Do not rewrite them. Extend types only if blocked, and document the change.

Never commit. Never add auth. Never put secrets in client code. Never fake tool calls with narrative text. Never use emojis in UI.

Read `docs/ARCHITECTURE.md` before writing code. Read relevant sections of `IncidentOS.md` for screen copy and numbers.

## Telemetry engineer

Own: `src/data/**`, `src/lib/observability/**`, `src/lib/store/**`

Deliver:

- Deterministic seed data matching the checkout-api SEV-1 story
- `ObservabilityService` implementation with real filtering, comparison math, rollback mutation, reset
- Simulated tool latency via the constants map (callers may wrap; service itself should be fast and pure-ish; provide `withLatency` helper)
- Zustand store implementing `AppState` from types, plus telemetry snapshot access for queries
- Vitest coverage for queries, filters, compare, rollback, reset, consistency (deployment time vs metric inflection)

## Shell / design engineer

Own: `src/components/layout/**`, `src/components/ui/**` (shadcn only), `src/app/**` (routes and shell; keep page bodies as composition slots)

Deliver:

- Desktop three-pane shell: nav | workspace | agent column; bottom agent input bar
- Routes: `/` overview, `/incidents`, `/incidents/[id]`, `/services`, `/services/[id]`, `/settings`
- Dark production header with clock frozen at 14:32
- Nav, empty/loading slots, accessibility (focus, semantic buttons, not color-only)
- Do not build charts, traces, or agent logic

## Observability UI engineer

Own: `src/components/observability/**` and the contents of incident/service/overview pages by importing layout slots

Deliver:

- Overview, incident list, incident detail (header, KPIs, charts with deployment marker, timeline, logs, traces, deployments, service graph)
- Evidence navigation targets via `id` attributes / store `workspaceTab`
- Virtualize logs/traces if lists are large
- Recharts. Textual summaries for a11y

## WebMCP engineer

Own: `src/lib/webmcp/**`

Deliver:

- Tool definitions wrapping ObservabilityService
- `registerIncidentOsTools()` client registrar for `document.modelContext`
- `get_investigation_context` plus compact query payloads and structured errors
- Capabilities catalog used by the capabilities drawer
- Structured errors; never fabricate results

## Investigation engineer

Own: `src/lib/agent/**`, `src/components/agent/**`, `src/app/api/**`

Deliver:

- Deterministic demo investigation using the same WebMCP/tool execute functions
- Real agent mode via AI SDK if key present
- Activity timeline, hypotheses, evidence, approval dialog, human input, reset
- Pause for “traffic spike?” challenge, then continue

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
