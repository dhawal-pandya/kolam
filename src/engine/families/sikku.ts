/**
 * SIKKU KOLAM — interlaced line around dots.
 *
 * Construction rules (see docs/CONSTRUCTION.md):
 *   S1  The line never touches a dot; every dot is enclosed in its own cell.
 *   S2  Between neighbouring dots the line either crosses (the characteristic
 *       interlacing "X") or turns back (a mirror between the dots). It never
 *       runs past two dots together — that would merge their cells.
 *   S3  The line is smooth and closed with no ends.
 *   S4  Ideally a single continuous line (eka-rekha). When the chosen symmetry
 *       makes one line impossible, the design may instead consist of several
 *       congruent lines that the symmetry permutes (one line per sector).
 *
 * Algorithm. Start with every edge crossing (the medial graph of the dot
 * graph: the "all diagonal" weave). Visit edge orbits in a seeded order and
 * place mirrors (splits) one orbit at a time; a mirror where two different
 * lines cross fuses them into one (Gerdes' mirror-curve procedure). After the
 * line is single, further ornamental mirrors are accepted only if the line
 * stays single.
 */

import { Rng } from '../rng';
import { CROSS, EdgeState, MedialStructure, SPLIT, countLoops, traceLoops } from '../medial';
import { GraphSymmetry } from '../symmetry';
import { DotGraph } from '../lattice/graph';

export interface SikkuResult {
  states: EdgeState[];
  loops: number;
  attempts: number;
}

export interface SikkuParams {
  complexity: number;
  ornamentation: number;
}

export function generateSikku(
  graph: DotGraph,
  medial: MedialStructure,
  sym: GraphSymmetry,
  rng: Rng,
  params: SikkuParams,
): SikkuResult {
  const orbitIds = sym.edgeOrbits.map((_, i) => i);
  const maxBand = Math.max(...graph.band);
  const singleTries = 12;
  const totalTries = 20;

  for (let attempt = 0; attempt < totalTries; attempt++) {
    const r = rng.fork(`sikku-attempt-${attempt}`);
    const states: EdgeState[] = new Array(graph.edges.length).fill(CROSS);
    const setOrbit = (o: number, st: EdgeState) => {
      for (const e of sym.edgeOrbits[o]) states[e] = st;
    };
    const splitCount = new Array(graph.dots.length).fill(0);
    const canSplit = (o: number) => {
      // Keep crossings around every dot (two for interior dots, one for the
      // low-degree dots on a staircase or tip) so no dot is boxed in by
      // mirrors, which would read as a stray circle rather than a weave.
      const touched = new Map<number, number>();
      for (const e of sym.edgeOrbits[o]) {
        const { a, b } = graph.edges[e];
        touched.set(a, (touched.get(a) ?? 0) + 1);
        touched.set(b, (touched.get(b) ?? 0) + 1);
      }
      for (const [d, add] of touched) {
        const deg = graph.rot[d].length;
        if (splitCount[d] + add > (deg >= 4 ? deg - 2 : deg - 1)) return false;
      }
      return true;
    };
    const applySplit = (o: number, sign: 1 | -1) => {
      for (const e of sym.edgeOrbits[o]) {
        splitCount[graph.edges[e].a] += sign;
        splitCount[graph.edges[e].b] += sign;
      }
    };

    // Seeded order, biased so mirrors favour the outer bands first: in the
    // tradition the line's turns cluster at the border where it wraps dots.
    const weight = (o: number) => {
      const e = graph.edges[sym.edgeOrbits[o][0]];
      const band = Math.min(graph.band[e.a], graph.band[e.b]);
      return r.next() + 0.35 * (band / Math.max(1, maxBand));
    };
    const keyed = orbitIds.map((o) => ({ o, k: weight(o) }));
    keyed.sort((x, y) => x.k - y.k);
    const order = keyed.map((x) => x.o);

    let loops = countLoops(medial, states);
    let improved = true;
    while (loops > 1 && improved) {
      improved = false;
      for (const o of order) {
        if (states[sym.edgeOrbits[o][0]] !== CROSS || !canSplit(o)) continue;
        setOrbit(o, SPLIT);
        const l2 = countLoops(medial, states);
        if (l2 < loops) {
          loops = l2;
          applySplit(o, 1);
          improved = true;
          if (loops === 1) break;
        } else setOrbit(o, CROSS);
      }
    }
    // Greedy merging can stall on a plateau (every single mirror orbit keeps
    // the count). Continue with a seeded local search that also accepts
    // neutral moves — placing or removing a mirror orbit without adding
    // lines — which walks across the plateau.
    for (let it = 0; loops > 1 && it < 60 * orbitIds.length; it++) {
      const o = orbitIds[Math.floor(r.next() * orbitIds.length)];
      const wasSplit = states[sym.edgeOrbits[o][0]] === SPLIT;
      if (!wasSplit && !canSplit(o)) continue;
      setOrbit(o, wasSplit ? CROSS : SPLIT);
      const l2 = countLoops(medial, states);
      if (l2 < loops || (l2 === loops && r.chance(0.6))) {
        loops = l2;
        applySplit(o, wasSplit ? -1 : 1);
      } else setOrbit(o, wasSplit ? SPLIT : CROSS);
    }

    const acceptable = (l: number) => (attempt < singleTries ? l === 1 : loopsArePermuted(medial, states, sym, l));
    if (!acceptable(loops)) continue;

    // Ornamental mirrors: more turns at higher ornamentation/complexity.
    const frac = 0.06 + 0.022 * params.ornamentation + 0.008 * params.complexity;
    const target = Math.round(frac * graph.edges.length);
    let splits = states.filter((s) => s === SPLIT).length;
    for (const o of r.shuffle(orbitIds)) {
      if (splits >= target) break;
      if (states[sym.edgeOrbits[o][0]] !== CROSS || !canSplit(o)) continue;
      setOrbit(o, SPLIT);
      const l2 = countLoops(medial, states);
      if (l2 === loops) {
        splits += sym.edgeOrbits[o].length;
        applySplit(o, 1);
      } else setOrbit(o, CROSS);
    }
    return { states, loops, attempts: attempt + 1 };
  }
  throw new Error('Sikku: no valid continuous-line construction found for this configuration');
}

/** Are the loops a single orbit under the symmetry (congruent sector lines)? */
export function loopsArePermuted(m: MedialStructure, states: EdgeState[], sym: GraphSymmetry, loops: number): boolean {
  if (loops === 1) return true;
  if (loops > sym.group.elements.length) return false;
  const traced = traceLoops(m, states);
  const loopOfCorner = new Int32Array(m.corners.length);
  traced.forEach((l, i) => l.steps.forEach((s) => (loopOfCorner[s.corner] = i)));
  // Map loop 0's first corner by each element; images must reach every loop.
  const reach = new Set<number>();
  const c0 = m.corners[traced[0].steps[0].corner];
  sym.dotPerm.forEach((perm, g) => {
    const d = perm[c0.dot];
    const e1 = sym.edgePerm[g][c0.e1];
    const e2 = sym.edgePerm[g][c0.e2];
    const img = m.corners.findIndex((c) => c.dot === d && ((c.e1 === e1 && c.e2 === e2) || (c.e1 === e2 && c.e2 === e1)));
    if (img >= 0) reach.add(loopOfCorner[img]);
  });
  return reach.size === loops;
}
