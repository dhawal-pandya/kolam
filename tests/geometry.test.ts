import { describe, expect, it } from 'vitest';
import {
  ARRANGEMENTS,
  FAMILIES,
  arrangementsFor,
  familySymmetries,
  generateKolam,
  isSupported,
  normalizeConfig,
  CROSS,
  JOIN,
} from '../src/engine';
import { buildArrangement } from '../src/engine/lattice/arrangements';
import { makeGroup, realise } from '../src/engine/symmetry';
import { buildMedial, countLoops, traceLoops, SPLIT, EdgeState } from '../src/engine/medial';
import { generateSikku } from '../src/engine/families/sikku';
import { generateKambi } from '../src/engine/families/kambi';
import { generatePulli } from '../src/engine/families/pulli';
import { rootRng } from '../src/engine/rng';
import { symmetryError } from '../src/engine/validate';
import { SAMPLES } from './helpers';

const setup = (cfg: Parameters<typeof normalizeConfig>[0]) => {
  const c = normalizeConfig(cfg);
  const graph = buildArrangement(c.arrangement, c.grid, c.symmetryCount);
  const sym = realise(graph, makeGroup(c.symmetry, c.symmetryCount));
  return { c, graph, sym, medial: buildMedial(graph), rng: rootRng(c.seed, 1).fork('test') };
};

describe('dot arrangements', () => {
  it('have the traditional dot counts', () => {
    expect(buildArrangement('square', { w: 15, h: 15 }, 4).dots.length).toBe(225);
    // 1-3-5-7-5-3-1
    expect(buildArrangement('diamond', { w: 3, h: 3 }, 4).dots.length).toBe(25);
    expect(buildArrangement('hexagonal', { w: 2, h: 2 }, 6).dots.length).toBe(19);
    const diamondRows = new Map<number, number>();
    for (const p of buildArrangement('diamond', { w: 3, h: 3 }, 4).dots) diamondRows.set(p.y, (diamondRows.get(p.y) ?? 0) + 1);
    expect([...diamondRows.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])).toEqual([1, 3, 5, 7, 5, 3, 1]);
  });

  it('every supported symmetry maps the dot set onto itself, and unsupported ones are refused', () => {
    for (const arr of ARRANGEMENTS) {
      const g = buildArrangement(arr, normalizeConfig({ arrangement: arr, family: 'pulli', symmetry: arr === 'radial' ? 'rotational' : 'four-way', symmetryCount: arr === 'radial' ? 8 : 2 }).grid, 8);
      for (const f of FAMILIES)
        for (const o of familySymmetries(f, arr)) {
          if (arr === 'radial' && o.count !== 8) continue;
          expect(() => realise(g, makeGroup(o.type, o.count))).not.toThrow();
        }
    }
    expect(() => realise(buildArrangement('square', { w: 5, h: 5 }, 4), makeGroup('rotational', 6))).toThrow();
    expect(() => realise(buildArrangement('rectangle', { w: 6, h: 4 }, 4), makeGroup('rotational', 4))).toThrow();
  });

  it('plane graphs are well formed (Euler: V − E + F = 2)', () => {
    for (const arr of ARRANGEMENTS) {
      const g = buildArrangement(arr, { w: 4, h: 3 }, 8);
      expect(g.dots.length - g.edges.length + (g.faces.length + 1), arr).toBe(2);
    }
  });
});

describe('symmetry invariants', () => {
  it.each(SAMPLES.map((s) => [`${s.family} ${s.arrangement} ${s.symmetry}${s.symmetryCount}`, s]))('%s is exactly symmetric', (_, cfg) => {
    const { sym } = setup(cfg);
    const d = generateKolam(cfg);
    expect(symmetryError(d.paths, sym, d.unit)).toBeLessThan(1e-6);
  });
});

describe('Sikku construction', () => {
  it('is a single continuous line of crossings and turns only, around every dot', () => {
    for (const cfg of SAMPLES.filter((s) => s.family === 'sikku')) {
      const { c, graph, sym, medial, rng } = setup(cfg);
      const res = generateSikku(graph, medial, sym, rng, c);
      expect(res.loops).toBe(1);
      expect(res.states.includes(JOIN)).toBe(false);
      expect(res.states.filter((s) => s === CROSS).length).toBeGreaterThan(0);
      const d = generateKolam(cfg);
      expect(d.validation.ok).toBe(true);
      expect(d.validation.minDotClearance).toBeGreaterThan(d.unit * 0.12);
    }
  });

  it('mirror lines through dots make a single line impossible (why sikku has no D4)', () => {
    // Exhaustive over all D4-symmetric mirror placements on 5×5.
    const { graph, sym, medial } = setup({ family: 'pulli', arrangement: 'square', grid: { w: 5, h: 5 }, symmetry: 'dihedral', symmetryCount: 4 });
    let best = Infinity;
    for (let mask = 0; mask < 1 << sym.edgeOrbits.length; mask++) {
      const st: EdgeState[] = new Array(graph.edges.length).fill(CROSS);
      sym.edgeOrbits.forEach((orb, o) => mask & (1 << o) && orb.forEach((e) => (st[e] = SPLIT)));
      best = Math.min(best, countLoops(medial, st));
    }
    expect(best).toBeGreaterThanOrEqual(5);
    expect(isSupported('sikku', 'square', 'dihedral', 4)).toBe(false);
  });

  it('even × even grids with a half-turn cannot carry one line, so they are never offered', () => {
    const { graph, sym, medial } = setup({ family: 'pulli', arrangement: 'square', grid: { w: 4, h: 4 }, symmetry: 'rotational', symmetryCount: 4 });
    let best = Infinity;
    for (let mask = 0; mask < 1 << sym.edgeOrbits.length; mask++) {
      const st: EdgeState[] = new Array(graph.edges.length).fill(CROSS);
      sym.edgeOrbits.forEach((orb, o) => mask & (1 << o) && orb.forEach((e) => (st[e] = SPLIT)));
      best = Math.min(best, countLoops(medial, st));
    }
    expect(best).toBe(2);
    const c = normalizeConfig({ family: 'sikku', arrangement: 'square', grid: { w: 4, h: 4 }, symmetry: 'rotational', symmetryCount: 4 });
    expect(c.grid.w % 2).toBe(1);
  });
});

describe('Kambi construction', () => {
  it('uses only non-crossing turns, closes every loop and never intersects', () => {
    for (const cfg of SAMPLES.filter((s) => s.family === 'kambi')) {
      const { c, graph, sym, medial, rng } = setup(cfg);
      const res = generateKambi(graph, medial, sym, rng, c);
      expect(res.states.includes(CROSS)).toBe(false);
      for (const l of traceLoops(medial, res.states)) expect(l.steps.length).toBeGreaterThan(0);
      const d = generateKolam(cfg);
      expect(d.validation.ok, d.validation.errors.join()).toBe(true);
      expect(d.paths.every((p) => p.closed)).toBe(true);
    }
  });
});

describe('Pulli construction', () => {
  it('joins every dot into one connected figure', () => {
    for (const cfg of SAMPLES.filter((s) => s.family === 'pulli')) {
      const { c, graph, sym, rng } = setup(cfg);
      const res = generatePulli(graph, sym, rng, { complexity: c.complexity, ornamentation: c.ornamentation, curvature: c.curvature / 10 });
      const parent = graph.dots.map((_, i) => i);
      const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      for (const l of res.links) parent[find(l.a)] = find(l.b);
      expect(new Set(graph.dots.map((_, i) => find(i))).size).toBe(1);
      // links only between lattice neighbours or across one cell
      for (const l of res.links) {
        const dd = Math.hypot(graph.dots[l.a].x - graph.dots[l.b].x, graph.dots[l.a].y - graph.dots[l.b].y);
        expect(dd).toBeLessThan(graph.unit * 2.2);
      }
    }
  });
});

describe('validity across the whole supported space', () => {
  it('every supported family × arrangement × symmetry × complexity generates a valid design', () => {
    let n = 0;
    for (const family of FAMILIES)
      for (const arrangement of arrangementsFor(family))
        for (const o of familySymmetries(family, arrangement))
          for (const complexity of [1, 5, 9]) {
            const cfg = { family, arrangement, symmetry: o.type, symmetryCount: o.count, complexity, seed: 1000 + n };
            const d = generateKolam(cfg);
            expect(d.validation.ok, JSON.stringify(cfg)).toBe(true);
            // no degenerate output and nothing outside the drawing region
            expect(d.paths.length).toBeGreaterThan(0);
            n++;
          }
    expect(n).toBeGreaterThan(150);
  }, 300_000);
});
