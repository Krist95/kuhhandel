// Seeded randomness for the pure rules engine. The engine never calls Math.random():
// callers pass an `rng` (a function returning a float in [0, 1)) so every game is reproducible.

/** Mulberry32: a small, fast seedable PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A string of `length` characters, each drawn from `alphabet`. */
export function randomId(rng: () => number, length = 8, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"): string {
  let id = "";
  for (let i = 0; i < length; i++) id += alphabet[Math.floor(rng() * alphabet.length)];
  return id;
}

/** Fisher–Yates shuffle of a copy; `items` is left untouched. */
export function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One element of `items`, chosen uniformly. */
export function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}
