/**
 * Deterministic pseudorandom numbers for the generation pipeline.
 *
 * Algorithm (generator version 1 — frozen):
 *   - Sub-seed derivation: FNV-1a (32-bit) over the UTF-16 code units of a
 *     label string, mixed with the parent state and finalised with the
 *     MurmurHash3 `fmix32` avalanche step.
 *   - Stream: Mulberry32 (Tommy Ettinger), a 32-bit state generator with
 *     period 2^32. Its output is converted to [0, 1) as `u32 / 2^32`.
 *
 * All arithmetic uses `Math.imul` and `>>> 0`, so results are bit-identical on
 * every JavaScript engine. `Math.random()` is never used anywhere in the
 * engine or the renderers.
 *
 * Every consumer derives a *named* child stream with `fork(label)`, so adding a
 * new consumer in one stage never shifts the numbers another stage receives.
 */

export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** FNV-1a over a string, seeded with `basis`, finalised with fmix32. */
export function hashString(str: string, basis = 0x811c9dc5): number {
  let h = basis >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}

/** Hash any list of primitive parts into a 32-bit value. */
export function hashParts(...parts: (string | number | boolean)[]): number {
  return hashString(parts.map(String).join('␟'));
}

export class Rng {
  private state: number;
  private readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** Mulberry32 step. Returns an unsigned 32-bit integer. */
  nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform float in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  /** Uniform integer in [a, b] (inclusive). */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty list');
    return items[Math.floor(this.next() * items.length)];
  }

  /** Weighted pick; weights need not be normalised. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return items[0];
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Fisher–Yates shuffle into a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** Approximately normal (Irwin–Hall, n = 4), mean 0, sd 1. */
  gauss(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * Math.sqrt(3);
  }

  /**
   * Independent, named child stream derived from this stream's *seed* (not
   * its current position), so a child never depends on how many numbers the
   * parent has already drawn. Does not advance this stream.
   */
  fork(label: string | number): Rng {
    return new Rng(hashString(String(label), this.seed ^ 0x9e3779b9));
  }
}

/** Root stream for a design: depends only on the seed and generator version. */
export function rootRng(seed: number, version: number): Rng {
  return new Rng(hashParts('kolam', version, seed));
}
