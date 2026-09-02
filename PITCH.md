# IncidentOS — pitch and judge path

A WebMCP Challenge submission.

**Live demo:** [https://yunus-incidentos.vercel.app](https://yunus-incidentos.vercel.app)  
**Incident:** [checkout SEV-1](https://yunus-incidentos.vercel.app/incidents/checkout-api-error-rate)

---

## Pitch

Observability products bolted a chatbot onto the side of the dashboard. You still copy metrics into chat. The agent still cannot use the product. You still cannot see what it looked at.

I built IncidentOS so the application itself is the agent interface.

The page registers real tools. ChatGPT discovers them, queries the same telemetry I am looking at, and the workspace moves with every call. Charts, logs, traces, and deployments update in front of me. When it wants to roll back production, it has to ask. I approve or I do not.

The data is synthetic on purpose. The incident is always the same checkout SEV-1, so a two-minute judging session is reliable. The WebMCP integration is not synthetic. ChatGPT is calling tools registered on the page.

---

## The story

Checkout is down. Error rate is **18.4%**. p95 is **2.8s**. Version **v2.31** shipped at 13:45 with the note “Optimize checkout query.”

It looks like a traffic spike. It is not. Requests only moved from about 20k to 24.1k per minute. That does not explain a 23× jump in errors. The slow query is in the database, sitting at ~91% of a failed trace.

After I approve a rollback to **v2.30**, errors fall toward **1.1%** and p95 toward **430ms**.

---

## For judges

This is the path I want you to take. About two minutes. Do not click **Investigate with AI** — that is the backup if site tools are unavailable.

### 1. Open the incident

[Checkout SEV-1](https://yunus-incidentos.vercel.app/incidents/checkout-api-error-rate)

Stay on this page. The clock is frozen at 14:32 so the story does not drift.

### 2. Open it in ChatGPT

1. ChatGPT desktop, model **GPT-5.6 Sol** or **Terra**. Luna cannot use site tools.
2. Settings → Browser → Permissions → turn on **site tools**.
3. Ask ChatGPT to open the incident URL above, or paste it into the in-app browser.

[ChatGPT site tools](https://learn.chatgpt.com/docs/webmcp)

### 3. Ask it to investigate

Something like:

> Investigate this checkout incident using the tools on the page. Start with the current investigation context. Do not guess. Show me evidence.

Watch the workspace, not only the chat. Tabs should change. Metrics should highlight. Logs and traces should open as it searches. The right-hand panel should show tool activity.

### 4. Challenge it

When it blames the deploy or the database, type:

> Could this just be a traffic spike?

It should query request rate again and come back with numbers: traffic rose a little; errors rose a lot. Traffic alone does not explain it.

### 5. Approve the rollback

When it proposes rolling **v2.31 → v2.30**, a dialog opens in IncidentOS. Click **Approve**.

Watch error rate and p95 recover.

### What I want you to notice

- ChatGPT is using page tools, not a sidecar chatbot.
- I can see every piece of evidence in the same UI.
- Rollback does not happen until I click Approve.

![Agent using application tools](docs/screenshots/investigation.png)

![Rollback approval](docs/screenshots/approval.png)

---

## If you cannot use ChatGPT site tools

The header will say **WebMCP unavailable · in-app demo**. That path still calls the same tools. It is a labeled backup, not the judged story.

1. Open the [checkout incident](https://yunus-incidentos.vercel.app/incidents/checkout-api-error-rate).
2. Click **Investigate with AI**.
3. Click evidence cards to jump into traces, logs, or deployments.
4. When asked, click **Could this just be a traffic spike?**
5. Approve **v2.31 → v2.30**.
6. Click **Reset Investigation** if you want to replay.

Chrome 149+ with `chrome://flags/#enable-webmcp-testing` can also host the page tools.

---

## What I built during the window

- A three-pane incident workspace: nav, telemetry, investigation panel.
- Page-registered tools for context, metrics, logs, traces, services, deployments, comparison, notes, and rollback.
- One execute path. ChatGPT, the in-app demo, and an optional in-app LLM all go through it.
- Human approval before any mutating action.
- A consistent synthetic dataset so the checkout story always holds together.

Repo: [github.com/YounixM/incident-os](https://github.com/YounixM/incident-os)  
License: MIT
