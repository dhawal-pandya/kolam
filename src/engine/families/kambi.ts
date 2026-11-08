/**
 * KAMBI KOLAM — "wire" kolam of closed, non-crossing loops around dots.
 *
 * Convention adopted here (sources disagree; see docs/CONSTRUCTION.md):
 *   K1  Lines wrap around dots like bent wire and never cross each other or
 *       themselves. (The interlaced variant is treated as Sikku.)
 *   K2  Every line is a closed loop; several loops may nest.
 *   K3  Every dot is enclosed; no line touches a dot.
 *   K4  Between neighbouring dots a line either passes between them
 *       (split) or wraps both together (join).
 *   K5  The structure is concentric: whole rings of dots are "wired"
 *       together, and symmetric bridges and spurs between rings turn the
 *       concentric wires into meanders. This produces the deliberate repeated
 *       loops and balanced positive/negative space of the tradition.
 *   K6  Wires stay one dot thick: at most two sides of any lattice cell are
 *       joined (the central cell excepted). Three would fold the wire into a
 *       pocket, four would pinch off an empty window loop, and either turns a
 *       hugging wire into a slab of loose dots.
 */

import { Rng } from '../rng';
import { EdgeState, JOIN, MedialStructure, SPLIT, countLoops } from '../medial';
import { GraphSymmetry } from '../symmetry';
import { DotGraph } from '../lattice/graph';

export interface KambiResult {
  states: EdgeState[];
  loops: number;
  attempts: number;
  wiredBands: number[];
}

export interface KambiParams {
  complexity: number;
  ornamentation: number;
}

export function generateKambi(
  graph: DotGraph,
  medial: MedialStructure,
  sym: GraphSymmetry,
  rng: Rng,
  params: KambiParams,
): KambiResult {
  const maxBand = Math.max(...graph.band);
  const edgeFaces = graph.edges.map((_, e) => [graph.leftFace[e], graph.rightFace[e]].filter((f) => f >= 0));
  const faceEdges: number[][] = graph.faces.map((cyc) =>
    cyc.map((d, i) => graph.edgeBetween(d, cyc[(i + 1) % cyc.length])!),
  );
  const faceIsCentral = graph.faces.map((cyc) => cyc.every((d) => graph.band[d] === graph.band[cyc[0]] && graph.band[d] === maxBand));
  const orbitBand = (o: number) => {
    const e = graph.edges[sym.edgeOrbits[o][0]];
    return [graph.band[e.a], graph.band[e.b]] as const;
  };
  const tangential = sym.edgeOrbits.map((_, o) => orbitBand(o)[0] === orbitBand(o)[1]);

  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng.fork(`kambi-attempt-${attempt}`);
    const states: EdgeState[] = new Array(graph.edges.length).fill(SPLIT);
    const joinedFaceCount = new Array(graph.faces.length).fill(0);

    const tryJoin = (o: number): boolean => {
      const es = sym.edgeOrbits[o];
      if (states[es[0]] === JOIN) return false;
      const bump = new Map<number, number>();
      for (const e of es) for (const f of edgeFaces[e]) bump.set(f, (bump.get(f) ?? 0) + 1);
      for (const [f, add] of bump) {
        if (faceIsCentral[f]) continue;
        if (joinedFaceCount[f] + add > Math.max(2, faceEdges[f].length - 2)) return false;
      }
      for (const e of es) states[e] = JOIN;
      for (const [f, add] of bump) joinedFaceCount[f] += add;
      return true;
    };
    const undoJoin = (o: number) => {
      for (const e of sym.edgeOrbits[o]) {
        for (const f of edgeFaces[e]) joinedFaceCount[f] -= 1;
        states[e] = SPLIT;
      }
    };

    // 1. Wired rings. The outer band is always wired (the frame of the
    //    design) in most designs; wired and loose bands strictly alternate
    //    so every wire is separated from the next by a row of dots.
    const wired: number[] = [];
    const phase = r.chance(0.75) ? 0 : 1;
    for (let b = 0; b <= maxBand; b++) if (b % 2 === phase) wired.push(b);
    for (let o = 0; o < sym.edgeOrbits.length; o++) {
      if (!tangential[o]) continue;
      if (wired.includes(orbitBand(o)[0])) tryJoin(o);
    }

    // 2. Spurs: a wired ring reaches out to a loose dot, so the wire bends
    //    around it. Spurs from the rings on both sides of a loose band can
    //    meet at the same dot, which threads the wires into one meander.
    //    Every band gap gets at least one spur orbit.
    const radial = sym.edgeOrbits.map((_, o) => o).filter((o) => !tangential[o]);
    const pSpur = 0.22 + 0.05 * params.ornamentation;
    const gapHit = new Set<number>();
    const shuffled = r.shuffle(radial);
    for (const o of shuffled) {
      const [b1, b2] = orbitBand(o);
      if (wired.includes(b1) === wired.includes(b2)) continue;
      const gap = Math.min(b1, b2);
      if ((!gapHit.has(gap) || r.chance(pSpur)) && tryJoin(o)) gapHit.add(gap);
    }
    for (const o of shuffled) {
      const [b1, b2] = orbitBand(o);
      const gap = Math.min(b1, b2);
      if (gapHit.has(gap) || wired.includes(b1) === wired.includes(b2)) continue;
      if (tryJoin(o)) gapHit.add(gap);
    }
    // Loose tangential pairs in unwired bands (short capsules).
    for (let o = 0; o < sym.edgeOrbits.length; o++) {
      if (!tangential[o] || wired.includes(orbitBand(o)[0])) continue;
      if (r.chance(0.08 * params.ornamentation)) tryJoin(o);
    }

    // 3. Merge loops toward a complexity-dependent ceiling with extra
    //    spurs: fewer, longer wires read as more deliberate.
    let loops = countLoops(medial, states);
    // Aesthetic target, not a validity rule: roughly a couple of wires per
    // band and symmetric copy. Designs above it are still valid kambi.
    const bands = maxBand + 1;
    const ceiling = Math.max(1, Math.round(sym.group.elements.length * (0.5 + 0.08 * params.complexity) * Math.max(1, bands / 3)));
    const loose = (o: number) => {
      const [b1, b2] = orbitBand(o);
      return wired.includes(b1) !== wired.includes(b2);
    };
    for (const o of r.shuffle(radial.filter(loose))) {
      if (loops <= ceiling) break;
      if (!tryJoin(o)) continue;
      const l2 = countLoops(medial, states);
      if (l2 < loops) loops = l2;
      else undoJoin(o);
    }
    // Reject degenerate designs that are nothing but separate dot circles.
    const joins = states.filter((s) => s === JOIN).length;
    if (joins < graph.edges.length * 0.15) continue;
    return { states, loops, attempts: attempt + 1, wiredBands: wired };
  }
  throw new Error('Kambi: no valid wire construction found for this configuration');
}
