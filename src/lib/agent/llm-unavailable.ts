export class LlmUnavailableError extends Error {
  constructor(message = "LLM unavailable") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export function isLlmUnavailableError(error: unknown): boolean {
  return error instanceof LlmUnavailableError;
}
