# IncidentOS
## Agent-Native Observability — Complete Build PRD

**Version:** 1.0  
**Product type:** Hackathon prototype  
**Build approach:** Frontend-first, synthetic observability backend, real WebMCP integration, real AI tool calling  
**Primary objective:** Demonstrate a compelling human + AI collaborative incident investigation workflow using WebMCP.

---

# 1. Executive Summary

IncidentOS is an **agent-native observability application** designed to demonstrate what happens when an observability product is built for both humans and AI agents.

A human engineer opens a production incident and asks an AI agent to investigate it.

The agent uses **WebMCP tools exposed by the web application** to:

- Inspect incidents
- Query metrics
- Search logs
- Search traces
- Inspect individual traces
- Inspect services
- Inspect deployments
- Compare time periods
- Form hypotheses
- Gather evidence
- Recommend remediation

The human can:

- Watch the investigation
- Inspect every piece of evidence
- Ask follow-up questions
- Redirect the investigation
- Challenge the agent
- Approve/reject actions

The agent cannot perform mutating operations without human approval.

The entire application uses a **synthetic but internally consistent observability dataset** so the demo is deterministic and reliable.

---

# 2. Product Vision

### Vision

> Build an observability application where an AI agent can investigate production systems alongside engineers rather than merely answer questions about telemetry.

### Product thesis

Traditional AI assistant:

```text
Human → Chatbot → Text response
```

IncidentOS:

```text
Human
  ↓
Agent
  ↓
WebMCP
  ↓
Application capabilities
  ↓
Telemetry
  ↓
Evidence
  ↓
Diagnosis
  ↓
Human approval
  ↓
Action
```

The distinction must be obvious during the demo.

---

# 3. Hackathon Objective

The application should optimize for four things:

### 1. WebMCP leverage

WebMCP should be a fundamental part of the architecture, not a superficial integration.

### 2. Demonstrable agent behavior

The agent must actually invoke application capabilities.

### 3. Human + agent collaboration

The human must remain an active participant.

### 4. Visual polish

The application should feel like a credible developer infrastructure product.

---

# 4. Product Positioning

Do NOT position the application as:

> "An AI chatbot for observability."

Position it as:

> **"An observability workspace designed for humans and AI agents to investigate incidents together."**

---

# 5. Target User

Primary user:

**Software Engineer / SRE**

Characteristics:

- Comfortable with developer tools
- Understands services, logs, metrics and traces
- Investigates production incidents
- Wants fast root-cause analysis
- Does not want an AI black box

---

# 6. Core User Journey

The complete MVP journey:

```text
Open IncidentOS
       ↓
See active production incident
       ↓
Open incident
       ↓
Start AI investigation
       ↓
Agent gathers incident context
       ↓
Agent checks metrics
       ↓
Agent checks deployments
       ↓
Agent searches traces
       ↓
Agent inspects representative trace
       ↓
Agent searches correlated logs
       ↓
Agent compares baseline
       ↓
Agent generates hypotheses
       ↓
Agent identifies likely root cause
       ↓
Human reviews evidence
       ↓
Human challenges agent
       ↓
Agent performs additional investigation
       ↓
Agent proposes rollback
       ↓
Human approves rollback
       ↓
Rollback simulated
       ↓
Telemetry recovers
       ↓
Incident moves to monitoring/resolved
```

---

# 7. MVP Definition

The MVP must support exactly one polished primary incident.

## Primary incident

**Checkout API — Elevated Error Rate**

Severity:

**SEV-1**

Affected service:

`checkout-api`

Root cause:

**Database query regression introduced in checkout-api v2.31**

---

# 8. Demo Story

The incident should tell a coherent story.

## Timeline

```text
13:45
checkout-api v2.31 deployed

13:47
p95 latency begins increasing

13:49
database latency increases

13:50
error rate begins increasing

13:52
HTTP 500 rate spikes

13:53
alert triggered

13:55
incident opened
```

## Expected investigation

The agent should discover:

```text
v2.31 deployment
       ↓
latency increase
       ↓
database query slowdown
       ↓
request timeout
       ↓
HTTP 500
       ↓
checkout failures
```

---

# 9. Application Information Architecture

Top-level application:

```text
IncidentOS
│
├── Overview
│
├── Incidents
│   ├── Active
│   └── Resolved
│
├── Services
│   ├── checkout-api
│   ├── payment-service
│   ├── inventory-service
│   └── user-service
│
└── Settings
```

For the hackathon, only the following need to be deeply implemented:

- Incidents
- Incident detail
- Services
- Telemetry views
- Agent investigation

---

# 10. Global Application Layout

Use a desktop-first developer-tool interface.

```text
┌──────────────────────────────────────────────────────────────┐
│ IncidentOS                         Production ●   14:32      │
├─────────────┬────────────────────────────────┬───────────────┤
│             │                                │               │
│ NAVIGATION  │       MAIN WORKSPACE           │ AI AGENT      │
│             │                                │               │
│ Overview    │       Incident details        │ Investigation │
│             │                                │               │
│ Incidents   │       Metrics                 │ Agent status  │
│             │       Timeline                │               │
│ Services    │       Traces                  │ Evidence      │
│             │       Logs                    │ Hypotheses   │
│             │       Deployments             │               │
│             │                                │               │
│             │                                │               │
├─────────────┴────────────────────────────────┴───────────────┤
│ Ask the agent...                                    [Send]  │
└──────────────────────────────────────────────────────────────┘
```

---

# 11. Visual Design

## Design language

The product should feel like:

- Datadog
- Linear
- Vercel
- Modern developer infrastructure tooling

But it must not directly copy any one product.

## Style

- Dark-first
- High information density
- Minimal gradients
- Thin borders
- Strong typography
- Compact controls
- Subtle shadows
- Clear state indicators
- Monospace for IDs and technical values
- Smooth micro-interactions

## Avoid

- Generic AI gradients
- Giant chat bubbles
- Excessive rounded cards
- Consumer-app styling
- Excessive glassmorphism
- Decorative illustrations
- "Magic AI" visual effects

---

# 12. Color Semantics

Use semantic colors only where meaningful.

### Status

- Critical → red
- Warning → amber
- Healthy → green
- Informational → blue

Do not use color as the only indicator.

---

# 13. Typography

Use a modern sans-serif font.

Recommended:

- Inter
- Geist

Monospace:

- Geist Mono
- JetBrains Mono

Use monospace for:

- Trace IDs
- Span IDs
- Service names
- Version numbers
- Query values
- Log content

---

# 14. Main Screens

The application requires these screens:

## Screen 1 — Overview

Purpose:

Provide an at-a-glance system health view.

Components:

- Active incidents
- Service health
- Error-rate summary
- Latency summary
- Recent deployments

---

## Screen 2 — Incidents

List incidents.

Columns:

- Severity
- Incident
- Service
- Status
- Started
- Duration

Example:

```text
SEV-1  Checkout API — Elevated Error Rate
       checkout-api
       Investigating
       13:52
```

---

## Screen 3 — Incident Detail

This is the primary screen.

Sections:

1. Incident header
2. Key metrics
3. Timeline
4. Metrics charts
5. Recent deployments
6. Investigation
7. Evidence
8. Remediation

---

# 15. Incident Header

Example:

```text
← Incidents

SEV-1

Checkout API
Elevated Error Rate

checkout-api

Investigating · Started 13:52

[Investigate with AI]
```

Key metrics:

```text
Error Rate       18.4%
p95 Latency      2.8s
Requests         24.1k/min
Affected Users   32%
```

---

# 16. Metrics Section

Display:

### Error rate

Line chart.

Baseline:

~0.8%

Incident peak:

18.4%

### p95 latency

Baseline:

~420ms

Incident peak:

2.8s

### Request rate

Baseline:

~20k/min

Incident:

~24k/min

Important:

The traffic increase should **not** be large enough to explain the incident.

This gives the agent evidence against the "traffic spike" hypothesis.

---

# 17. Service Dependency Graph

Show:

```text
frontend
   │
   ▼
checkout-api
   ├── payment-service
   ├── inventory-service
   └── user-service
```

The graph should be visually clean.

Highlight `checkout-api` as unhealthy.

Highlight database dependency when investigation reaches it.

---

# 18. Logs View

Logs should look realistic.

Example:

```text
13:53:42.921  ERROR checkout-api

request failed

trace_id=8fd3...
span_id=93ab...

context deadline exceeded
database query exceeded 2s timeout
```

Each log must contain:

- timestamp
- level
- service
- message
- trace ID
- span ID

Clicking a trace ID should open the corresponding trace.

---

# 19. Traces View

Trace list:

```text
Trace ID             Duration    Status

8fd3c21...            3.82s       ERROR
9a31d42...            3.41s       ERROR
bc73d11...            2.98s       ERROR
...
```

Trace detail:

```text
checkout-api          3.82s
│
├── HTTP POST /checkout       3.82s
│
├── validate-cart              12ms
│
├── inventory.check            81ms
│
├── payment.authorize         204ms
│
└── db.query                  3.49s  ← ERROR
```

The database span should visually stand out.

---

# 20. Deployments View

Example:

```text
Version    Time     Commit       Change

v2.31      13:45    a91f2c       Optimize checkout query
v2.30      09:21    83af31       Payment retry improvements
v2.29      yesterday ...
```

The v2.31 deployment should correlate strongly with the incident.

---

# 21. Agent Workspace

The agent workspace is the most important UI element.

Do NOT make it a standard chat panel.

Instead:

```text
┌─────────────────────────────────┐
│ AI INVESTIGATION                │
│                                 │
│ ● Investigating                 │
│ checkout-api                    │
│                                 │
│ Progress                        │
│                                 │
│ ✓ Incident context              │
│ ✓ Error-rate analysis           │
│ ✓ Deployment analysis           │
│ ✓ Failed traces                 │
│ ◉ Database correlation          │
│ ○ Root cause validation         │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ CURRENT HYPOTHESIS              │
│ Database regression             │
│                                 │
│ Confidence                      │
│ ████████████████░░ 92%          │
│                                 │
│ [View evidence]                 │
└─────────────────────────────────┘
```

---

# 22. Agent Activity Timeline

Every agent operation must be visible.

Example:

```text
14:02:11
🤖 Started investigation

14:02:12
✓ get_incident
Loaded incident context

14:02:14
✓ query_metrics
Error rate increased 23×

14:02:16
✓ get_deployments
v2.31 deployed 7m before incident

14:02:18
✓ search_traces
Found 43 failed traces

14:02:20
✓ inspect_trace
Database query accounts for 91% of duration

14:02:23
✓ search_logs
Found database timeout errors

14:02:25
◉ Validating database hypothesis
```

The tool names should be visible but visually secondary.

---

# 23. WebMCP Architecture

WebMCP tools are the bridge between the agent and the application.

Architecture:

```text
                 AI Agent
                    │
                    │ WebMCP
                    ▼
        ┌─────────────────────────┐
        │ IncidentOS WebMCP API   │
        └────────────┬────────────┘
                     │
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
    Metrics        Logs           Traces
       │             │              │
       └─────────────┼──────────────┘
                     ▼
              Synthetic Data
```

---

# 24. WebMCP Tool Categories

## Investigation tools

### `get_incident`

Retrieve incident context.

Input:

```json
{
  "incidentId": "checkout-api-error-rate"
}
```

Output:

```json
{
  "id": "checkout-api-error-rate",
  "title": "Checkout API — Elevated Error Rate",
  "severity": "SEV-1",
  "service": "checkout-api",
  "status": "investigating",
  "startedAt": "...",
  "errorRate": 18.4,
  "p95Latency": 2.8
}
```

---

### `get_service`

Input:

```json
{
  "service": "checkout-api"
}
```

Return:

- service metadata
- dependencies
- health
- deployment history

---

### `query_metrics`

Input:

```json
{
  "service": "checkout-api",
  "metric": "error_rate",
  "startTime": "...",
  "endTime": "..."
}
```

Return:

```json
{
  "metric": "error_rate",
  "unit": "percent",
  "points": [
    {
      "timestamp": "...",
      "value": 0.8
    }
  ]
}
```

Support metrics:

- error_rate
- request_rate
- p50_latency
- p95_latency
- p99_latency
- db_latency

---

### `search_logs`

Input:

```json
{
  "service": "checkout-api",
  "query": "timeout",
  "startTime": "...",
  "endTime": "...",
  "limit": 20
}
```

---

### `search_traces`

Input:

```json
{
  "service": "checkout-api",
  "status": "error",
  "startTime": "...",
  "endTime": "...",
  "limit": 20
}
```

---

### `get_trace`

Input:

```json
{
  "traceId": "8fd3c21"
}
```

Return complete trace/span hierarchy.

---

### `get_deployments`

Input:

```json
{
  "service": "checkout-api",
  "limit": 10
}
```

---

### `compare_periods`

Input:

```json
{
  "service": "checkout-api",
  "metric": "p95_latency",
  "baselineStart": "...",
  "baselineEnd": "...",
  "incidentStart": "...",
  "incidentEnd": "..."
}
```

Return:

- baseline average
- incident average
- delta
- percentage change

---

# 25. Mutation Tools

Mutating tools require human approval.

## `rollback_deployment`

Input:

```json
{
  "service": "checkout-api",
  "targetVersion": "v2.30"
}
```

The tool should never execute directly from an uncontrolled agent action.

Flow:

```text
Agent requests rollback
        ↓
UI approval dialog
        ↓
Human approves
        ↓
Tool executes
        ↓
Synthetic telemetry updates
```

---

## `add_incident_note`

Input:

```json
{
  "incidentId": "...",
  "note": "Root cause appears related to..."
}
```

This can be automatically executed or require approval depending on implementation.

---

# 26. WebMCP Design Principle

Tools should represent **domain capabilities**, not UI clicks.

Bad:

```text
click_button
open_tab
scroll_panel
```

Good:

```text
search_traces
query_metrics
get_deployments
compare_periods
rollback_deployment
```

This distinction is important for the hackathon.

---

# 27. Agent System Prompt

Use an agent prompt along these lines:

```text
You are an SRE investigating a production incident.

Your goal is to identify the most likely root cause using
observable evidence.

You have access to IncidentOS through WebMCP tools.

Rules:

1. Do not assume the root cause.
2. Gather evidence before forming conclusions.
3. Prefer direct telemetry evidence over speculation.
4. Correlate metrics, deployments, traces and logs.
5. Investigate competing hypotheses when appropriate.
6. Clearly distinguish facts from hypotheses.
7. Cite evidence for important conclusions.
8. You may investigate autonomously.
9. You must request human approval before executing
   mutating operations.
10. Never fabricate telemetry or tool results.

When you believe you have identified the root cause,
summarize:

- Root cause
- Confidence
- Evidence
- Alternative explanations considered
- Recommended action
```

---

# 28. Agent Investigation Strategy

The agent should naturally follow approximately this sequence.

### Phase 1 — Context

Call:

```text
get_incident
get_service
```

### Phase 2 — Determine impact

Call:

```text
query_metrics(error_rate)
query_metrics(p95_latency)
query_metrics(request_rate)
```

### Phase 3 — Recent changes

Call:

```text
get_deployments
```

### Phase 4 — Trace investigation

Call:

```text
search_traces
get_trace
```

### Phase 5 — Log correlation

Call:

```text
search_logs
```

### Phase 6 — Validation

Call:

```text
compare_periods
```

### Phase 7 — Hypothesis

Agent creates:

```text
Database query regression
Confidence: 92%
```

### Phase 8 — Human interaction

Human may challenge:

> "Could this simply be a traffic spike?"

Agent investigates:

```text
query_metrics(request_rate)
compare_periods(request_rate)
```

### Phase 9 — Recommendation

Agent proposes:

```text
Rollback checkout-api v2.31 → v2.30
```

### Phase 10 — Approval

Human approves.

### Phase 11 — Remediation

Execute:

```text
rollback_deployment
```

---

# 29. Hypothesis UI

Display competing hypotheses.

Example:

```text
ROOT CAUSE ANALYSIS

① Database query regression              92%
   Strong evidence

② Payment-service latency               28%
   Weak correlation

③ Traffic spike                          7%
   Insufficient evidence
```

Each hypothesis should have expandable evidence.

---

# 30. Evidence UI

Evidence should be first-class objects.

Example:

```text
Evidence

✓ v2.31 deployed at 13:45
  → View deployment

✓ Error rate increased at 13:50
  → View metric

✓ 83% of failed traces contain DB timeout
  → View traces

✓ DB query consumes 91% of representative trace
  → View trace

✓ v2.30 does not exhibit the regression
  → Compare versions
```

Clicking an evidence item should navigate to the corresponding application view.

---

# 31. Human Intervention

The input bar is always available.

Examples:

```text
Ask the agent:

"Check if traffic increased."
"Show me evidence for the database hypothesis."
"Investigate payment-service instead."
"Compare this with yesterday."
"Why are you confident?"
"Rollback the deployment."
```

The agent should react using tools whenever the request requires application data.

---

# 32. Approval Experience

When a mutation is proposed:

```text
┌───────────────────────────────────────┐
│ ACTION REQUIRES APPROVAL              │
│                                       │
│ Rollback checkout-api                 │
│                                       │
│ v2.31  →  v2.30                      │
│                                       │
│ Why                                   │
│ Deployment correlates with the       │
│ incident and traces show a database  │
│ regression.                           │
│                                       │
│ [Cancel]              [Approve]       │
└───────────────────────────────────────┘
```

Never silently execute.

---

# 33. Recovery Simulation

After rollback:

Before:

```text
Error rate: 18.4%
p95: 2.8s
```

After:

```text
Error rate: 1.1%
p95: 430ms
```

Animate the transition.

Update:

- charts
- incident status
- service health
- agent timeline

---

# 34. Incident State Machine

Incident states:

```text
INVESTIGATING
      ↓
IDENTIFIED
      ↓
ACTION_PENDING
      ↓
REMEDIATING
      ↓
MONITORING
      ↓
RESOLVED
```

The UI should visually reflect the current state.

---

# 35. Synthetic Data Model

Create TypeScript models.

## Incident

```typescript
interface Incident {
  id: string;
  title: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  service: string;
  status:
    | "investigating"
    | "identified"
    | "action_pending"
    | "remediating"
    | "monitoring"
    | "resolved";
  startedAt: string;
  description: string;
}
```

## Service

```typescript
interface Service {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "critical";
  dependencies: string[];
}
```

## MetricPoint

```typescript
interface MetricPoint {
  timestamp: string;
  value: number;
}
```

## Log

```typescript
interface LogEntry {
  timestamp: string;
  service: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  traceId?: string;
  spanId?: string;
}
```

## Trace

```typescript
interface Trace {
  traceId: string;
  service: string;
  duration: number;
  status: "ok" | "error";
  spans: Span[];
}
```

## Span

```typescript
interface Span {
  spanId: string;
  parentSpanId?: string;
  service: string;
  operation: string;
  duration: number;
  status: "ok" | "error";
}
```

## Deployment

```typescript
interface Deployment {
  id: string;
  service: string;
  version: string;
  timestamp: string;
  commit: string;
  summary: string;
}
```

---

# 36. Data Consistency Requirements

The synthetic data must be internally consistent.

For example:

If the deployment happens at 13:45:

- metric degradation should begin shortly afterward
- traces should show degradation
- logs should show related errors
- the deployment should reference the correct service/version

Do not generate unrelated random data.

The demo story depends on correlation.

---

# 37. Dataset Requirements

Generate enough data to make the application feel real.

Minimum:

### Services

5

```text
frontend
checkout-api
payment-service
inventory-service
user-service
```

### Deployments

20+

### Traces

100+

### Logs

500+

### Metric points

Several hundred per metric.

### Incidents

At least 3:

1. Checkout API — Elevated Error Rate
2. Payment Service — Increased Latency
3. Inventory API — Error Spike

Only the first needs full agent investigation.

---

# 38. Additional Incidents

The other incidents should primarily make the dashboard feel realistic.

Example:

### Payment Service

```text
SEV-2
Payment Service — Elevated Latency
```

### Inventory

```text
SEV-3
Inventory API — Increased 5xx Responses
```

They do not require complete investigation workflows.

---

# 39. Demo Mode

Add a prominent button:

**Run Investigation**

When clicked:

1. Reset incident state.
2. Start scripted agent investigation.
3. Execute tool calls sequentially.
4. Update UI in real time.
5. Display evidence.
6. Generate hypothesis.
7. Pause for human interaction.
8. Continue when human responds.

---

# 40. Deterministic Demo Mode

For hackathon reliability, support two agent modes:

### Real Agent Mode

Uses the configured LLM and actual WebMCP tool calls.

### Demo Mode

Uses a deterministic investigation script that still invokes the same application tools.

This ensures the demo cannot fail because of:

- LLM latency
- API rate limits
- unexpected agent behavior
- network issues

The UI should not visually distinguish the two modes.

---

# 41. Investigation Script

The deterministic demo should perform:

```text
1. get_incident
2. get_service
3. query_metrics(error_rate)
4. query_metrics(p95_latency)
5. query_metrics(request_rate)
6. get_deployments
7. search_traces
8. get_trace
9. search_logs
10. compare_periods
11. create hypothesis
12. present evidence
13. wait for human challenge
14. query request_rate again
15. compare periods
16. recommend rollback
17. wait for approval
18. rollback deployment
19. update telemetry
20. resolve incident
```

---

# 42. Agent Activity Animation

Tool execution should feel live.

Each tool invocation:

```text
○ searching traces...
```

Then:

```text
✓ found 43 matching traces
```

Use subtle animations.

Avoid excessive animation.

---

# 43. Agent Thinking UX

Do not display hidden chain-of-thought.

Instead display **concise action/status summaries**.

Good:

> Checking whether the latency increase correlates with the latest deployment.

Bad:

> "I am thinking about whether..."

The user sees:

- tool invoked
- result
- concise conclusion

Not private reasoning.

---

# 44. Agent Message Types

Support:

### Status

```text
I'm checking recent deployments.
```

### Tool activity

```text
✓ get_deployments
Found v2.31 deployed 7 minutes before the incident.
```

### Finding

```text
The error spike begins 5 minutes after v2.31.
```

### Hypothesis

```text
The strongest hypothesis is a database query regression.
```

### Question

```text
Would you like me to investigate whether traffic contributed?
```

### Action proposal

```text
I recommend rolling back v2.31.
```

---

# 45. Backend Architecture

Keep the backend intentionally simple.

```text
src/
├── app/
├── components/
├── pages/
├── data/
│   ├── incidents.ts
│   ├── services.ts
│   ├── metrics.ts
│   ├── logs.ts
│   ├── traces.ts
│   └── deployments.ts
│
├── agent/
│   ├── agent.ts
│   ├── prompts.ts
│   └── demo-investigation.ts
│
├── webmcp/
│   ├── getIncident.ts
│   ├── getService.ts
│   ├── queryMetrics.ts
│   ├── searchLogs.ts
│   ├── searchTraces.ts
│   ├── getTrace.ts
│   ├── getDeployments.ts
│   ├── comparePeriods.ts
│   └── rollbackDeployment.ts
│
├── state/
│
└── types/
```

Adjust structure if the chosen framework requires a different organization.

---

# 46. State Management

Global state should include:

```typescript
interface AppState {
  selectedIncidentId: string;
  incidentStatus: IncidentStatus;

  agent: {
    status: "idle" | "investigating" | "waiting" | "complete";
    messages: AgentMessage[];
    activities: AgentActivity[];
    hypotheses: Hypothesis[];
    evidence: Evidence[];
  };

  telemetry: {
    recoveryTriggered: boolean;
  };

  approval: {
    pendingAction?: PendingAction;
  };
}
```

Keep state simple.

Do not over-engineer.

---

# 47. Agent Activity Model

```typescript
interface AgentActivity {
  id: string;
  timestamp: string;
  tool:
    | "get_incident"
    | "get_service"
    | "query_metrics"
    | "search_logs"
    | "search_traces"
    | "get_trace"
    | "get_deployments"
    | "compare_periods"
    | "rollback_deployment";

  status: "running" | "success" | "error";

  summary: string;
  result?: unknown;
}
```

---

# 48. Evidence Model

```typescript
interface Evidence {
  id: string;
  type:
    | "metric"
    | "trace"
    | "log"
    | "deployment"
    | "comparison";

  title: string;
  summary: string;
  confidence: number;

  reference: {
    type: string;
    id: string;
  };
}
```

---

# 49. Hypothesis Model

```typescript
interface Hypothesis {
  id: string;
  title: string;
  confidence: number;
  status: "active" | "rejected" | "confirmed";
  evidenceIds: string[];
}
```

---

# 50. Navigation Behavior

When clicking:

### Metric evidence

Navigate/scroll to metrics.

### Trace evidence

Open trace detail.

### Log evidence

Open logs filtered by trace/service.

### Deployment evidence

Open deployment detail.

### Comparison evidence

Open comparison visualization.

---

# 51. Responsive Behavior

Primary target:

**Desktop ≥ 1280px**

Secondary:

1024px+

Do not prioritize mobile.

At smaller widths:

- Collapse navigation
- Collapse agent panel
- Maintain telemetry usability

---

# 52. Accessibility

Required:

- Keyboard navigation
- Visible focus states
- Semantic buttons
- Accessible dialogs
- Accessible charts via textual summaries
- Do not rely only on color
- Appropriate ARIA labels where needed

---

# 53. Error States

Every tool should support failure.

Example:

```text
⚠ Unable to retrieve traces

Trace service temporarily unavailable.

[Retry]
```

Agent should receive the error and adapt.

Never display fabricated results.

---

# 54. Loading States

Use skeletons for initial application loading.

For agent operations, use activity states rather than generic spinners.

Example:

```text
◉ Searching failed traces...
```

---

# 55. Empty States

Example:

```text
No matching traces

Try expanding the time range or removing filters.
```

---

# 56. Performance Requirements

Target:

- Initial render < 2 seconds on normal connection
- Interactions feel immediate
- No unnecessary re-renders
- Charts should remain smooth
- Large logs/traces should be virtualized if necessary

Synthetic data should be loaded locally where possible.

---

# 57. Security

This is a prototype.

Do not implement:

- authentication
- authorization
- real secrets
- real infrastructure credentials

Never include API keys in client-side source.

If an LLM API is required, use a server-side environment variable or server-side proxy.

---

# 58. Environment Variables

Example:

```text
LLM_API_KEY=
LLM_MODEL=
```

Provide:

`.env.example`

Never commit secrets.

---

# 59. API Abstraction

Create a telemetry service abstraction:

```typescript
interface ObservabilityService {
  getIncident(id: string): Promise<Incident>;
  getService(id: string): Promise<Service>;
  queryMetrics(params: MetricQuery): Promise<MetricResult>;
  searchLogs(params: LogQuery): Promise<LogEntry[]>;
  searchTraces(params: TraceQuery): Promise<Trace[]>;
  getTrace(id: string): Promise<Trace>;
  getDeployments(service: string): Promise<Deployment[]>;
  comparePeriods(params: CompareQuery): Promise<ComparisonResult>;
  rollbackDeployment(params: RollbackParams): Promise<RollbackResult>;
}
```

The current implementation can use synthetic data.

This keeps the architecture extensible.

---

# 60. Synthetic Telemetry Engine

Create deterministic functions for telemetry queries.

Examples:

```text
queryMetrics(...)
searchLogs(...)
searchTraces(...)
```

These should behave like real APIs:

- accept parameters
- filter data
- return structured results
- simulate latency where useful

Do not hardcode every tool result directly inside the agent.

---

# 61. Tool Latency Simulation

To make the demo feel real:

Use small artificial delays:

```text
get_incident       300ms
query_metrics      600ms
search_traces      900ms
get_trace          700ms
search_logs        600ms
compare_periods    800ms
```

Do not make the demo unnecessarily slow.

Target:

**60–90 seconds total.**

---

# 62. Tool Result Rendering

The UI should interpret tool results into meaningful summaries.

Example:

Raw:

```json
{
  "points": [...]
}
```

UI:

```text
Error rate

0.8% → 18.4%

↑ 22.9× increase
```

---

# 63. Charts

Required charts:

### Error rate

Line chart with incident marker.

### p95 latency

Line chart with deployment marker.

### Request rate

Line chart.

### Recovery

After rollback, show metrics returning toward baseline.

Charts should have:

- labels
- time axis
- tooltips
- incident/deployment annotations

---

# 64. Deployment Correlation Visualization

On metric charts, show a vertical marker:

```text
13:45
│
│ v2.31 deployed
│
▼
──────────────────────────────
          ╱
         ╱
________╱
```

This visually communicates causality without claiming certainty.

---

# 65. Incident Timeline

Timeline entries:

```text
13:45  Deployment v2.31

13:47  p95 latency begins increasing

13:49  DB latency increases

13:50  Error rate increases

13:52  Alert triggered

13:55  Incident created

14:02  AI investigation started
```

---

# 66. Service Health

Service cards:

```text
checkout-api
● Critical

Error rate 18.4%
p95 2.8s
```

Healthy services:

```text
payment-service
● Healthy

inventory-service
● Healthy
```

This helps establish that the incident is localized.

---

# 67. Incident Dashboard Summary

At the top:

```text
SEV-1

Checkout API
Elevated Error Rate

┌─────────┬─────────┬─────────┬─────────┐
│ 18.4%   │ 2.8s    │ 24.1k   │ 32%     │
│ Errors  │ p95     │ req/min │ Impact  │
└─────────┴─────────┴─────────┴─────────┘
```

---

# 68. AI Investigation Summary

When complete:

```text
ROOT CAUSE IDENTIFIED

Database query regression
introduced in checkout-api v2.31

Confidence
92%

Impact
32% of checkout requests

Evidence
4 strong signals

Recommended action
Rollback to v2.30
```

---

# 69. Resolution Summary

After rollback:

```text
INCIDENT RECOVERING

Rollback completed

Error rate
18.4% → 1.1%

p95 latency
2.8s → 430ms

Service
checkout-api

Status
Monitoring
```

Then after a short delay:

```text
✓ Incident resolved
```

---

# 70. Demo Script

The product should support this exact presentation.

### Step 1

Open dashboard.

Say:

> "Checkout is currently experiencing a SEV-1 incident."

### Step 2

Open incident.

Say:

> "Instead of investigating this manually, I'll ask the agent to investigate."

Click:

**Investigate with AI**

### Step 3

Agent starts calling tools.

Highlight:

```text
get_incident
query_metrics
get_deployments
search_traces
get_trace
search_logs
```

### Step 4

Agent identifies deployment correlation.

### Step 5

Open evidence.

Show trace.

### Step 6

Human asks:

> "Could this just be a traffic spike?"

Agent investigates.

### Step 7

Agent rejects traffic spike hypothesis.

### Step 8

Agent recommends rollback.

### Step 9

Human approves.

### Step 10

Rollback completes.

Show metrics recovering.

---

# 71. Hackathon "Wow" Moment

The critical moment should be:

```text
Agent:
"I found a likely database regression."

[View evidence]

User:
"Could traffic be causing this?"

Agent:
"I'll check."

→ WebMCP tool calls

Agent:
"Traffic increased only 12%, while the error rate increased
22×. Traffic alone doesn't explain the incident."
```

This demonstrates **collaboration**, not automation alone.

---

# 72. WebMCP "Wow" Moment

The second important moment:

Show a subtle capabilities drawer:

```text
AGENT CAPABILITIES

Observability

✓ Query metrics
✓ Search logs
✓ Search traces
✓ Inspect traces
✓ Inspect services
✓ Inspect deployments
✓ Compare periods

Operations

✓ Rollback deployment
✓ Add incident note
```

When tools are invoked, highlight them.

The judge should immediately understand:

> The application itself exposes capabilities that an AI agent can use.

---

# 73. Product Differentiation

The application should demonstrate three levels:

### Level 1 — AI answers questions

Basic chatbot.

### Level 2 — AI uses tools

Tool-using agent.

### Level 3 — AI and human collaborate inside the application

**IncidentOS.**

The product should clearly target Level 3.

---

# 74. Acceptance Criteria

## Core application

- [ ] Application loads without errors.
- [ ] Dashboard renders.
- [ ] Incident list renders.
- [ ] Incident detail renders.
- [ ] Services render.
- [ ] Metrics render.
- [ ] Logs render.
- [ ] Traces render.
- [ ] Deployments render.

## WebMCP

- [ ] WebMCP integration works.
- [ ] Read-only tools are exposed.
- [ ] Tools return structured data.
- [ ] Agent can invoke tools.
- [ ] Tool activity is visible.
- [ ] Tool failures are handled.

## Agent

- [ ] Agent can start investigation.
- [ ] Agent gathers evidence.
- [ ] Agent forms hypotheses.
- [ ] Agent can answer follow-up questions.
- [ ] Agent can investigate alternative hypotheses.
- [ ] Agent cites evidence.
- [ ] Agent proposes remediation.

## Human control

- [ ] Mutations require approval.
- [ ] Approval dialog works.
- [ ] Reject action works.
- [ ] Agent can continue after approval.

## Remediation

- [ ] Rollback executes.
- [ ] Telemetry changes.
- [ ] Error rate decreases.
- [ ] Latency decreases.
- [ ] Incident state updates.

## Demo

- [ ] Demo mode works deterministically.
- [ ] Demo completes in 60–90 seconds.
- [ ] No external infrastructure is required.
- [ ] Demo can be reset.
- [ ] Application remains usable after demo.

---

# 75. Testing Requirements

### Unit tests

Test:

- telemetry queries
- metric calculations
- trace filtering
- log filtering
- deployment filtering
- comparison calculations
- rollback state transition

### Integration tests

Test:

```text
Start investigation
→ tool calls
→ evidence
→ hypothesis
→ approval
→ rollback
→ recovery
```

### UI tests

Test:

- incident navigation
- trace opening
- evidence navigation
- approval dialog
- investigation start
- demo reset

---

# 76. Reset Function

Add:

**Reset Investigation**

It should restore:

```text
incident status = investigating
rollback = false
metrics = incident state
agent activity = empty
hypotheses = empty
evidence = empty
```

This is important for repeated judging/demo sessions.

---

# 77. Build Priorities

## P0 — Must Have

1. App shell
2. Incident page
3. Synthetic telemetry
4. Charts
5. Logs
6. Traces
7. Deployments
8. WebMCP tools
9. Agent
10. Agent activity UI
11. Evidence
12. Human approval
13. Rollback
14. Recovery

## P1 — Important

15. Hypothesis UI
16. Alternative hypothesis investigation
17. Service dependency graph
18. Investigation timeline
19. Demo mode
20. Reset

## P2 — Polish

21. Keyboard shortcuts
22. Additional incidents
23. Agent capabilities drawer
24. More micro-interactions
25. Advanced filtering

---

# 78. Implementation Strategy

The AI builder should work in these phases.

## Phase 1 — Foundation

Create:

- project
- routing
- theme
- layout
- navigation
- typography
- base components

Do not implement agent logic yet.

---

## Phase 2 — Synthetic Backend

Implement:

- data models
- seed data
- telemetry service
- query functions
- state transitions

Verify that all telemetry is internally consistent.

---

## Phase 3 — Observability UI

Build:

- incident dashboard
- charts
- logs
- traces
- deployments
- service graph

At this point the application should already feel like a polished observability product.

---

## Phase 4 — WebMCP

Implement:

- tool definitions
- tool handlers
- schemas
- error handling
- tool execution state

Test tools independently.

---

## Phase 5 — Agent

Implement:

- system prompt
- tool calling
- investigation loop
- activity tracking
- evidence extraction
- hypotheses

---

## Phase 6 — Human Collaboration

Implement:

- chat/input
- follow-up requests
- investigation interruption
- alternative hypothesis flow

---

## Phase 7 — Remediation

Implement:

- action proposal
- approval dialog
- rollback
- telemetry recovery
- state transitions

---

## Phase 8 — Demo Mode

Implement:

- deterministic investigation
- animation
- reset
- scripted human intervention

---

## Phase 9 — Polish

Focus on:

- typography
- spacing
- animations
- chart quality
- empty/loading/error states
- responsiveness
- accessibility

---

# 79. AI Builder Rules

The AI implementing this product must follow these rules.

### Rule 1

Do not simplify the application into a chatbot.

### Rule 2

Do not replace real tool calls with fake text that claims a tool was called.

### Rule 3

Use the same WebMCP tools for real and demo modes.

### Rule 4

Keep synthetic data deterministic.

### Rule 5

Do not invent telemetry at runtime.

### Rule 6

All important agent conclusions must be supported by data.

### Rule 7

Mutating operations require explicit human approval.

### Rule 8

Do not expose hidden chain-of-thought.

Show concise actions, tool calls, results and conclusions.

### Rule 9

Do not over-engineer infrastructure.

### Rule 10

Prioritize the primary incident investigation flow above secondary features.

---

# 80. Definition of Done

The product is considered complete when a judge can:

1. Open IncidentOS.
2. Understand the active incident within 10 seconds.
3. Start an AI investigation.
4. See the agent actually use application capabilities.
5. Understand what the agent discovered.
6. Click evidence and inspect the underlying telemetry.
7. Challenge the agent.
8. Watch the agent investigate the challenge.
9. Receive a remediation recommendation.
10. Approve the action.
11. Watch the system recover.

The complete experience should take approximately:

**1–2 minutes.**

---

# 81. Final Product Principle

The finished application should communicate one idea extremely clearly:

> **The future of observability isn't an AI chatbot sitting beside your dashboards. It's an observability system whose capabilities are directly usable by AI agents, while humans remain in control.**

The synthetic backend is intentional.

The data is fake.

The **agent interaction is real**.

The **WebMCP integration is real**.

The **human-in-the-loop workflow is real**.

That distinction is the core of the hackathon submission.