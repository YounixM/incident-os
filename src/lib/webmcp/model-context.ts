/** ChatGPT site tools: support is `typeof document.modelContext?.registerTool === "function"`. */

export function getModelContext(): ModelContext | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const ctx = document.modelContext;
  if (typeof ctx?.registerTool !== "function") {
    return undefined;
  }
  return ctx;
}

export function toRegisterInputSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...schema };
  delete rest.$schema;
  return rest;
}
