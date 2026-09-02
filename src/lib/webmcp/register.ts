"use client";

import { executeIncidentTool } from "@/lib/agent/invoke-tool";
import { listTools } from "./catalog";
import { getModelContext, toRegisterInputSchema } from "./model-context";

const MODEL_CONTEXT_ATTEMPTS = 40;
const MODEL_CONTEXT_INTERVAL_MS = 250;

let registration: Promise<void> | undefined;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function executeSignal(options: unknown): AbortSignal | undefined {
  if (options instanceof AbortSignal) {
    return options.aborted ? undefined : options;
  }
  if (
    options !== null &&
    typeof options === "object" &&
    "signal" in options &&
    (options as { signal?: unknown }).signal instanceof AbortSignal
  ) {
    const signal = (options as { signal: AbortSignal }).signal;
    return signal.aborted ? undefined : signal;
  }
  return undefined;
}

function executeInput(input: unknown): Record<string, unknown> {
  if (typeof input === "string") {
    try {
      const parsed: unknown = JSON.parse(input);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  if (input !== null && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

export async function waitForModelContext(
  signal: AbortSignal,
): Promise<ModelContext | undefined> {
  const existing = getModelContext();
  if (existing) {
    return existing;
  }
  if (typeof document === "undefined") {
    return undefined;
  }
  for (let attempt = 0; attempt < MODEL_CONTEXT_ATTEMPTS; attempt += 1) {
    if (signal.aborted) {
      return undefined;
    }
    try {
      await wait(MODEL_CONTEXT_INTERVAL_MS, signal);
    } catch {
      return undefined;
    }
    const ctx = getModelContext();
    if (ctx) {
      return ctx;
    }
  }
  return getModelContext();
}

async function registerAll(modelContext: ModelContext): Promise<void> {
  await Promise.all(
    listTools().map((tool) =>
      modelContext.registerTool({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: toRegisterInputSchema(tool.inputSchema),
        annotations: {
          readOnlyHint: tool.readOnly,
          ...(tool.untrustedContent ? { untrustedContentHint: true } : {}),
        },
        execute: async (inputObject, options) => {
          return executeIncidentTool(tool.name, executeInput(inputObject), executeSignal(options));
        },
      }),
    ),
  );
}

/** Test-only: allow a fresh register after stubbing document. */
export function resetIncidentOsToolRegistration(): void {
  registration = undefined;
}

export async function registerIncidentOsTools(signal?: AbortSignal): Promise<void> {
  const waitSignal = signal ?? new AbortController().signal;
  const modelContext = await waitForModelContext(waitSignal);
  if (!modelContext || waitSignal.aborted) {
    return;
  }
  if (!registration) {
    registration = registerAll(modelContext);
  }
  await registration;
}
