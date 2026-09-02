import { afterEach, describe, expect, it, vi } from "vitest";
import { PRIMARY_INCIDENT_ID, TOOL_LATENCY_MS } from "@/lib/constants";
import { useIncidentStore } from "@/lib/store/use-incident-store";
import { registerIncidentOsTools, resetIncidentOsToolRegistration } from "./register";
import { listTools } from "./catalog";

afterEach(() => {
  resetIncidentOsToolRegistration();
  useIncidentStore.getState().resetInvestigation();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("registerIncidentOsTools", () => {
  it("registers after registerTool appears, with ChatGPT-shaped tool payloads", async () => {
    vi.useFakeTimers();
    const registerTool = vi.fn(
      async (_tool: ModelContextTool, _options?: { signal?: AbortSignal }) => undefined,
    );
    const holder: { context: ModelContext | undefined } = { context: undefined };
    vi.stubGlobal("document", {
      get modelContext() {
        return holder.context;
      },
    });

    const done = registerIncidentOsTools();
    holder.context = {
      registerTool,
    };
    await vi.advanceTimersByTimeAsync(250);
    await done;

    expect(registerTool).toHaveBeenCalledTimes(listTools().length);
    expect(registerTool.mock.calls[0]?.[1]).toBeUndefined();
    const payloads = registerTool.mock.calls.map((call) => call[0]);
    expect(payloads.some((tool) => tool.name === "propose_rollback")).toBe(true);
    const sample = payloads.find((tool) => tool.name === "get_incident");
    expect(sample).toBeDefined();
    expect(sample?.annotations).toEqual({ readOnlyHint: true });
    expect(sample?.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(sample?.inputSchema).not.toHaveProperty("$schema");
    const logs = payloads.find((tool) => tool.name === "search_logs");
    expect(logs?.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
    const propose = payloads.find((tool) => tool.name === "propose_rollback");
    expect(propose).toBeDefined();
    expect(propose?.annotations).toEqual({ readOnlyHint: false });
  });

  it("keeps execute callable after the React wait signal aborts, including with no host signal", async () => {
    vi.useFakeTimers();
    const registerTool = vi.fn(
      async (_tool: ModelContextTool, _options?: { signal?: AbortSignal }) => undefined,
    );
    const waitController = new AbortController();
    vi.stubGlobal("document", {
      modelContext: {
        registerTool,
      },
    });

    const done = registerIncidentOsTools(waitController.signal);
    await done;
    waitController.abort();

    const getIncident = registerTool.mock.calls
      .map((call) => call[0])
      .find((tool) => tool.name === "get_incident");
    expect(getIncident).toBeDefined();

    const work = getIncident?.execute({ incidentId: PRIMARY_INCIDENT_ID });
    await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.get_incident);
    const result = await work;
    expect(result).toMatchObject({ ok: true });

    const abortedHost = new AbortController();
    abortedHost.abort();
    const retry = getIncident?.execute({ incidentId: PRIMARY_INCIDENT_ID }, {
      signal: abortedHost.signal,
    });
    await vi.advanceTimersByTimeAsync(TOOL_LATENCY_MS.get_incident);
    const retried = await retry;
    expect(retried).toMatchObject({ ok: true });
  });

  it("does not treat a modelContext without registerTool as WebMCP", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("document", {
      modelContext: {},
    });
    const done = registerIncidentOsTools();
    await vi.advanceTimersByTimeAsync(40 * 250);
    await expect(done).resolves.toBeUndefined();
  });
});
