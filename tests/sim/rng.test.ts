import { describe, expect, it } from 'vitest';
import { chance, createRng, nextFloat, nextInt, pick, shuffle, type RngState } from '../../src/sim/rng';

function take(rng: RngState, n: number): number[] {
  const out: number[] = [];
  let r = rng;
  for (let i = 0; i < n; i++) {
    let v: number;
    [v, r] = nextFloat(r);
    out.push(v);
  }
  return out;
}

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    expect(take(createRng(42), 20)).toEqual(take(createRng(42), 20));
  });

  it('differs across seeds', () => {
    expect(take(createRng(1), 5)).not.toEqual(take(createRng(2), 5));
  });

  it('never mutates its input state', () => {
    const r = createRng(7);
    const snapshot = { ...r };
    nextFloat(r);
    nextInt(r, 0, 10);
    expect(r).toEqual(snapshot);
  });

  it('survives a JSON round-trip mid-sequence', () => {
    let r = createRng(99);
    [, r] = nextFloat(r);
    [, r] = nextFloat(r);
    const restored = JSON.parse(JSON.stringify(r)) as RngState;
    expect(take(restored, 10)).toEqual(take(r, 10));
  });

  it('produces floats in [0, 1) and ints within bounds', () => {
    let r = createRng(123);
    for (let i = 0; i < 1000; i++) {
      let f: number, n: number;
      [f, r] = nextFloat(r);
      [n, r] = nextInt(r, 3, 8);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  it('chance(…, 0) is never true and chance(…, 1) is always true', () => {
    let r = createRng(5);
    for (let i = 0; i < 100; i++) {
      let a: boolean, b: boolean;
      [a, r] = chance(r, 0);
      [b, r] = chance(r, 1);
      expect(a).toBe(false);
      expect(b).toBe(true);
    }
  });

  it('pick and shuffle keep the same elements', () => {
    const items = ['marcus', 'priya', 'dalton', 'imogen', 'theo', 'rosa'];
    const [picked] = pick(createRng(1), items);
    expect(items).toContain(picked);
    const [shuffled] = shuffle(createRng(1), items);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });
});
