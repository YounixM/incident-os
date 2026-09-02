# IncidentOS

An observability workspace where a human and an AI agent investigate the same production incident together.

The agent does not sit in a chat box beside the dashboards. It uses tools on the page: metrics, logs, traces, deployments. You can challenge its conclusions. Rollback still needs your approval.

**Live demo:** [https://yunus-incidentos.vercel.app](https://yunus-incidentos.vercel.app)

Judges: start with [PITCH.md](PITCH.md).

![Incident header and KPIs](docs/screenshots/incident.png)

## The incident

Checkout is failing. Error rate is **18.4%**. p95 latency is **2.8s**. Version **v2.31** shipped at 13:45 (“Optimize checkout query”).

The cause is a slow database query, not a traffic spike. Requests only rose from about 20k to 24.1k per minute. That does not explain a 23× jump in errors.

After you approve a rollback to **v2.30**, errors fall toward **1.1%** and p95 toward **430ms**.

## Try the demo

Open the [checkout SEV-1](https://yunus-incidentos.vercel.app/incidents/checkout-api-error-rate).

### With ChatGPT (best)

This is the intended path. ChatGPT uses tools registered by the IncidentOS page.

1. Use ChatGPT desktop with **GPT-5.6 Sol** or **Terra** (Luna cannot use site tools).
2. Settings → Browser → Permissions → enable **site tools**.
3. Stay on the incident page.
4. Ask it to investigate the checkout incident.
5. Watch the workspace move with each tool call.
6. When it proposes a rollback, click **Approve**.

Details: [ChatGPT site tools](https://learn.chatgpt.com/docs/webmcp). You can also use Chrome 149+ with `chrome://flags/#enable-webmcp-testing`.

### Without ChatGPT

If site tools are unavailable, the header says **WebMCP unavailable · in-app demo**. That path is a backup.

1. Click **Investigate with AI**.
2. Watch the investigation and click evidence to open traces, logs, or deployments.
3. When asked, click **Could this just be a traffic spike?**
4. Approve the rollback **v2.31 → v2.30**.
5. Click **Reset Investigation** to replay.

![Agent using application tools](docs/screenshots/investigation.png)

![Rollback approval](docs/screenshots/approval.png)

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No API key is required for the in-app demo.

```bash
pnpm test
pnpm lint
pnpm build
```

Optional in-app LLM follow-ups: copy `.env.example` to `.env.local`. Do not put keys in client code. See `docs/ARCHITECTURE.md` for how tools are wired.

## Stack

Next.js 16, React 19, Tailwind v4, shadcn/ui, Zustand, Zod, AI SDK, Recharts.

## License

MIT. See [LICENSE](LICENSE).
