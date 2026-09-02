# IncidentOS architecture contract

Hackathon prototype. Frontend-first. Synthetic telemetry. Real WebMCP. Real tool calling.

## Product rule

This is an observability workspace, not a chatbot. The agent uses application capabilities. Humans stay in the loop. Mutations require approval.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn (radix-nova), Zustand, Zod, AI SDK (`ai` package — read `node_modules/ai/docs`, never guess APIs), Recharts, Lucide icons
- Dark-first. Geist + Geist Mono. Desktop ≥ 1280px. High information density.
- No auth. No real infra. No client-side API keys. No emojis in UI.

## Shared source of truth

All timestamps are ISO-8601 UTC using constants in `src/lib/constants.ts`.

Primary incident: `checkout-api-error-rate` (SEV-1). Root cause: database query regression in `checkout-api` v2.31. Traffic rise is too small to explain errors (~20k → 24.1k/min vs 0.8% → 18.4% error rate).

Incident state machine:

```
investigating → identified → action_pending → remediating → monitoring → resolved
```

## Tool architecture (non-negotiable)

One implementation, three consumers:

1. In-app deterministic demo script
2. In-app real LLM agent (AI SDK)
3. Browser WebMCP via `document.modelContext.registerTool`

Tools represent domain capabilities (`search_traces`, `query_metrics`), never UI clicks.

Tools query `ObservabilityService`. Do not hardcode results inside the agent. Do not invent telemetry at runtime.

`rollback_deployment` must not execute until `approval.pendingAction` is approved.

## File ownership

| Path | Owner | Others |
|---|---|---|
| `src/types/**` | Orchestrator | READ-ONLY |
| `src/lib/constants.ts` | Orchestrator | READ-ONLY |
| `src/lib/observability/**` | Telemetry | exclusive write |
| `src/data/**` | Telemetry | exclusive write |
| `src/lib/store/**` | Telemetry first, then Investigation | extend only |
| `src/components/ui/**` | Shell | exclusive write (shadcn) |
| `src/components/layout/**` | Shell | exclusive write |
| `src/app/**` except page bodies noted below | Shell | exclusive write for shell/routes |
| `src/components/observability/**` | Observability UI | exclusive write |
| `src/lib/webmcp/**` | WebMCP | exclusive write |
| `src/lib/agent/**` | Investigation | exclusive write |
| `src/components/agent/**` | Investigation | exclusive write |
| `src/app/api/**` | Investigation | exclusive write |

Do not edit files outside your ownership. Do not commit. Do not add new dependencies without noting them.

## Design

Feel: Datadog × Linear × Vercel. Not a consumer AI app.

- Dark zinc/charcoal, not `#000`. Thin borders. Compact controls. Monospace for IDs, versions, queries, logs.
- Semantic color only: critical red, warning amber, healthy green, info blue. Never color-only.
- No AI purple, no giant chat bubbles, no glassmorphism, no decorative illustrations, no magic AI effects.
- Agent workspace is a live investigation panel (progress, hypothesis, evidence), not a chat transcript.
- Signature element: evidence items that navigate into real telemetry views.

## Demo script (must be executable via the same tools)

1. get_incident
2. get_service
3. query_metrics(error_rate)
4. query_metrics(p95_latency)
5. query_metrics(db_latency)
6. query_metrics(request_rate)
7. get_deployments
8. search_traces
9. get_trace (representative failed trace; DB span ~91% of duration)
10. search_logs (timeout / deadline exceeded)
11. compare_periods error_rate
12. get_service + query_metrics on payment-service (reject downstream hypothesis)
13. create hypothesis (DB regression ~92%; payment latency rejected; traffic spike ~7%)
14. present evidence
15. wait for human challenge
16. query request_rate again + compare_periods
17. reject traffic spike; add_incident_note; propose_rollback v2.31 → v2.30
18. wait for approval
19. rollback_deployment
20. recover telemetry (error 18.4% → 1.1%, p95 2.8s → 430ms)
21. monitoring → resolved
22. total 60–90s including simulated tool latency

## Dataset minimums

- 5 services: frontend, checkout-api, payment-service, inventory-service, user-service
- 20+ deployments (v2.31 at 13:45 on checkout-api is the smoking gun)
- 100+ traces, 500+ logs, hundreds of metric points per metric
- 3 incidents; only the first is fully investigable
- Internally consistent: deployment → latency → DB latency → errors → 500s → alert → incident
- Request rate increase must not explain the incident
- Representative error trace: validate-cart 12ms, inventory.check 81ms, payment.authorize 204ms, db.query 3.49s ERROR, total ~3.82s

## WebMCP

ChatGPT site tools are a subset of WebMCP: JavaScript `document.modelContext.registerTool` on the **top-level page**. No iframe registration. No declarative HTML-form tools. Support check is `typeof document.modelContext?.registerTool === "function"` (retry briefly if it appears after mount). Do not pass the React effect AbortSignal into `registerTool` — aborting it unregisters tools and ChatGPT then sees `AbortError` on `get_incident` / `propose_rollback`. Wait-for-context can abort; registered execute ignores an already-aborted host signal.

Registered `execute` goes through `executeIncidentTool` so ChatGPT calls show in the activity timeline and ingest evidence. Do not require `getTools()` — ChatGPT’s host may omit it. The in-app agent uses `invokeIncidentTool`: if the host exposes `getTools`, it calls the registered tool; otherwise it executes locally.

`propose_rollback` is the write that opens the human approval dialog. For ChatGPT / site-tool calls it **waits until Approve or Cancel**, then returns `status: approved`. If ChatGPT never calls `propose_rollback` after ingest marks the incident **identified**, the page still opens the approval dialog (agent idle only; in-app demo still owns the traffic-challenge pause). Approving with no waiter executes `rollback_deployment`. In-app investigation still returns immediately and uses `waitForApproval`. `get_incident` includes `approval.approved` as a poll fallback if the wait is cut short. `rollback_deployment` still requires a matching approved pending action. ChatGPT also runs its own safety review before each invocation.

Tool descriptions describe **only that tool**. Never instruct an agent to call another tool from a description or from a read-only result. Inspect tools set `readOnlyHint: true`. `search_logs` also sets `untrustedContentHint: true`. Write tools do not infer authorization from `get_incident` copy.

```ts
if (typeof document.modelContext?.registerTool === "function") {
  await document.modelContext.registerTool({
    name: "search_traces",
    description: "...",
    inputSchema: { type: "object", properties: { ... }, required: [...], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async (input, { signal }) => { ... },
  });
}
```

Fallback: in-app agent still calls the same execute functions if WebMCP is unavailable.

## AI SDK

Read `node_modules/ai/docs` and `node_modules/ai/src` before writing agent code. Use current `ToolLoopAgent` / `tool({ inputSchema })` APIs. Route models through AI Gateway string IDs. Demo mode must work with no API key.
