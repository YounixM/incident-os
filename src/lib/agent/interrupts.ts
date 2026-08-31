let pending: string | null = null;

export function queueInterrupt(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  pending = trimmed;
}

export function takeInterrupt(): string | null {
  const value = pending;
  pending = null;
  return value;
}

export function peekInterrupt(): string | null {
  return pending;
}

export function clearInterrupts(): void {
  pending = null;
}
