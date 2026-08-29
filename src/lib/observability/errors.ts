export type TelemetryErrorCode = "NOT_FOUND" | "INVALID_ARGUMENT" | "INVALID_ROLLBACK";

export class TelemetryError extends Error {
  readonly code: TelemetryErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: TelemetryErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "TelemetryError";
    this.code = code;
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function notFound(entity: string, id: string): TelemetryError {
  return new TelemetryError("NOT_FOUND", `${entity} not found: ${id}`, { entity, id });
}

export function invalidArgument(message: string, details?: Record<string, unknown>): TelemetryError {
  return new TelemetryError("INVALID_ARGUMENT", message, details ?? {});
}

export function invalidRollback(message: string, details?: Record<string, unknown>): TelemetryError {
  return new TelemetryError("INVALID_ROLLBACK", message, details ?? {});
}
