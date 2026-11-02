/**
 * Seeded, serialisable PRNG (mulberry32).
 *
 * Every random decision in the simulation goes through this so a run can be
 * replayed exactly from its seed. The state is a single 32-bit integer, so it
 * can be stored inside GameState and survive JSON round-trips.
 */

export interface RngState {
  readonly seed: number;
  readonly state: number;
}

export function createRng(seed: number): RngState {
  const s = seed >>> 0;
  return { seed: s, state: s };
}

/** Returns a float in [0, 1) and the next RNG state. Pure: never mutates input. */
export function nextFloat(rng: RngState): [number, RngState] {
  let t = (rng.state + 0x6d2b79f5) >>> 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { seed: rng.seed, state: nextState }];
}

/** Integer in [min, max] inclusive. */
export function nextInt(rng: RngState, min: number, max: number): [number, RngState] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`nextInt: invalid range [${min}, ${max}]`);
  }
  const [f, next] = nextFloat(rng);
  return [min + Math.floor(f * (max - min + 1)), next];
}

/** True with the given probability (0..1). */
export function chance(rng: RngState, probability: number): [boolean, RngState] {
  const [f, next] = nextFloat(rng);
  return [f < probability, next];
}

/** Picks one element uniformly. Throws on an empty array. */
export function pick<T>(rng: RngState, items: readonly T[]): [T, RngState] {
  if (items.length === 0) throw new RangeError('pick: empty array');
  const [i, next] = nextInt(rng, 0, items.length - 1);
  return [items[i] as T, next];
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(rng: RngState, items: readonly T[]): [T[], RngState] {
  const out = [...items];
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, r] = nextInt(r, 0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return [out, r];
}
