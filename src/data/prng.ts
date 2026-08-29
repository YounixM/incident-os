/** Mulberry32 — deterministic, seedable, no Math.random. */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Signed noise in [-1, 1] keyed by a stable tuple. */
export function keyedNoise(...parts: Array<string | number>): number {
  const rng = createPrng(hashString(parts.join("|")));
  return rng() * 2 - 1;
}

export function hexId(rng: () => number, byteCount: number): string {
  let out = "";
  for (let i = 0; i < byteCount; i += 1) {
    out += Math.floor(rng() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return out;
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error("pick() called with an empty list");
  }
  return item;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
