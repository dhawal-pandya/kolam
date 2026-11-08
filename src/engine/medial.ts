/**
 * Medial-graph ("mirror curve") construction shared by the line families.
 *
 * A kolam line that weaves *around* dots never touches a dot; between every
 * pair of neighbouring dots P–Q it does exactly one of three things at the
 * midpoint of PQ (Gerdes' and Jablan's mirror-curve model; the medial graph of
 * the dot graph in Nagata's analysis):
 *
 *   cross   two strands cross diagonally between P and Q (no mirror)
 *   split   the line turns back on each side, so P and Q are wrapped
 *           separately and the strand passes *between* them
 *           (a mirror perpendicular to PQ)
 *   join    the line runs past P and Q together on both sides, so they share
 *           one enclosed cell (a mirror along PQ)
 *
 * Around each dot the line travels through the "corners" between consecutive
 * neighbour directions. Given a state per edge the line is fully determined;
 * we trace it into closed loops and then build smooth geometry.
 */

import { Cubic, Path, hermite } from './geometry/bezier';
import { Vec, add, angle, dist, fromAngle, mid, neg, norm, perp, scale, sub, wrap2pi, dot, signedAngle } from './geometry/vec';
import { DotGraph, other } from './lattice/graph';

export const CROSS = 0;
export const SPLIT = 1;
export const JOIN = 2;
export type EdgeState = typeof CROSS | typeof SPLIT | typeof JOIN;

interface Corner {
  dot: number;
  e1: number;
  e2: number;
  /** Slot ids of the corner's two ends (at e1 and at e2). */
  s1: number;
  s2: number;
  /** Is the sector reflex (≥ π)? Then it opens onto the outside. */
  reflex: boolean;
  /** Angular size of the sector at the dot (radians). */
  sweep: number;
}

/** slot = 4·edge + (endpoint b ? 2 : 0) + (right side ? 1 : 0) */
const slotId = (e: number, atB: boolean, minus: boolean) => e * 4 + (atB ? 2 : 0) + (minus ? 1 : 0);

export interface MedialStructure {
  graph: DotGraph;
  corners: Corner[];
  /** slot → corner id */
  slotCorner: Int32Array;
  /** Reusable buffer for loop counting. */
  scratch: Uint8Array;
}

export function buildMedial(graph: DotGraph): MedialStructure {
  const corners: Corner[] = [];
  const slotCorner = new Int32Array(graph.edges.length * 4).fill(-1);
  graph.rot.forEach((list, d) => {
    const deg = list.length;
    if (deg === 0) return;
    for (let i = 0; i < deg; i++) {
      const e1 = list[i];
      const e2 = list[(i + 1) % deg];
      // Sector from e1 CCW to e2 lies left of d→e1 and right of d→e2.
      const e1AtB = graph.edges[e1].b === d;
      const e2AtB = graph.edges[e2].b === d;
      // Left of d→other: if d is a, that's the + side; if d is b, it's the − side.
      const s1 = slotId(e1, e1AtB, e1AtB);
      const s2 = slotId(e2, e2AtB, !e2AtB);
      const t1 = angle(sub(graph.dots[other(graph.edges[e1], d)], graph.dots[d]));
      const t2 = angle(sub(graph.dots[other(graph.edges[e2], d)], graph.dots[d]));
      let sweep = wrap2pi(t2 - t1);
      if (deg === 1) sweep = Math.PI * 2;
      const id = corners.length;
      corners.push({ dot: d, e1, e2, s1, s2, reflex: sweep >= Math.PI - 1e-9, sweep });
      slotCorner[s1] = id;
      slotCorner[s2] = id;
    }
  });
  return { graph, corners, slotCorner, scratch: new Uint8Array(corners.length) };
}

/** The slot reached from `slot` by passing through its edge in `state`. */
function partner(slot: number, state: EdgeState): number {
  const e = slot >> 2;
  const atB = (slot & 2) !== 0;
  const minus = (slot & 1) !== 0;
  switch (state) {
    case CROSS:
      return slotId(e, !atB, !minus);
    case SPLIT:
      return slotId(e, atB, !minus);
    case JOIN:
      return slotId(e, !atB, minus);
  }
}

export interface TracedLoop {
  /** Sequence of (corner, forward?) where forward means s1 → s2. */
  steps: { corner: number; forward: boolean }[];
}

/** Trace all closed loops. Every corner is used exactly once. */
export function traceLoops(m: MedialStructure, states: ArrayLike<EdgeState>): TracedLoop[] {
  const used = new Uint8Array(m.corners.length);
  const loops: TracedLoop[] = [];
  for (let c0 = 0; c0 < m.corners.length; c0++) {
    if (used[c0]) continue;
    const steps: TracedLoop['steps'] = [];
    let c = c0;
    let forward = true;
    let guard = 0;
    while (true) {
      used[c] = 1;
      steps.push({ corner: c, forward });
      const exit = forward ? m.corners[c].s2 : m.corners[c].s1;
      const nextSlot = partner(exit, states[exit >> 2]);
      const nc = m.slotCorner[nextSlot];
      const nForward = m.corners[nc].s1 === nextSlot;
      // Slots form a 2-regular graph (corner pairing + edge pairing), so the
      // walk can only close by re-entering the first corner at its start.
      if (nc === c0) {
        if (!nForward) throw new Error('loop orientation mismatch');
        break;
      }
      c = nc;
      forward = nForward;
      if (++guard > m.corners.length + 2) throw new Error('loop trace did not close');
    }
    loops.push({ steps });
  }
  return loops;
}

/** Number of separate closed lines for a state assignment (allocation-light). */
export function countLoops(m: MedialStructure, states: ArrayLike<EdgeState>): number {
  const n = m.corners.length;
  const used = m.scratch.length >= n ? m.scratch : (m.scratch = new Uint8Array(n));
  used.fill(0, 0, n);
  const corners = m.corners;
  const slotCorner = m.slotCorner;
  let loops = 0;
  for (let c0 = 0; c0 < n; c0++) {
    if (used[c0]) continue;
    loops++;
    let c = c0;
    let exit = corners[c].s2;
    for (;;) {
      used[c] = 1;
      const next = partner(exit, states[exit >> 2]);
      const nc = slotCorner[next];
      if (nc === c0) break;
      c = nc;
      exit = corners[nc].s1 === next ? corners[nc].s2 : corners[nc].s1;
    }
  }
  return loops;
}

export interface MedialGeometryOptions {
  /** 0 … 1 */
  curvature: number;
}

interface SlotGeom {
  p: Vec;
  /** Direction of travel when leaving the corner into the edge. */
  t: Vec;
}

/**
 * Precompute local clearances: ρ(d) is how far an undisturbed diagonal strand
 * passes from dot d (0.354 on the square lattice, 0.433 on the triangular).
 */
function clearances(g: DotGraph, m: MedialStructure): number[] {
  const sum = new Array(g.dots.length).fill(0);
  const cnt = new Array(g.dots.length).fill(0);
  for (const c of m.corners) {
    if (c.reflex) continue;
    const P = g.dots[c.dot];
    const m1 = mid(P, g.dots[other(g.edges[c.e1], c.dot)]);
    const m2 = mid(P, g.dots[other(g.edges[c.e2], c.dot)]);
    const dir = sub(m2, m1);
    const l = Math.hypot(dir.x, dir.y);
    const dd = Math.abs((P.x - m1.x) * dir.y - (P.y - m1.y) * dir.x) / l;
    sum[c.dot] += dd;
    cnt[c.dot] += 1;
  }
  return sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0.354 * g.unit));
}

/**
 * Smooth geometry for the traced loops. Each corner becomes one or more cubic
 * segments sweeping counter-clockwise around its dot; consecutive corners
 * share an endpoint and a tangent, so every loop is G1-continuous.
 */
export function medialGeometry(
  m: MedialStructure,
  states: ArrayLike<EdgeState>,
  loops: TracedLoop[],
  opts: MedialGeometryOptions,
): { paths: Path[]; crossings: Vec[] } {
  const g = m.graph;
  const rho = clearances(g, m);
  const k = opts.curvature;
  const tension = 0.9 + 0.25 * k;
  // One clearance governs every way a line passes a dot (diagonal, turning,
  // wrapping, running alongside), so strands keep an even distance from dots.
  const wrapFactor = 0.97 + 0.16 * k;
  const splitFactor = wrapFactor;

  // Height of each face above an edge, for join offsets.
  const faceHeight = (e: number, side: 1 | -1): number | null => {
    const f = side > 0 ? g.leftFace[e] : g.rightFace[e];
    if (f < 0) return null;
    const P = g.dots[g.edges[e].a];
    const Q = g.dots[g.edges[e].b];
    const n = perp(norm(sub(Q, P)));
    let h = 0;
    for (const vtx of g.faces[f]) h = Math.max(h, Math.abs(dot(sub(g.dots[vtx], P), n)));
    return h;
  };

  // Other edge-midpoint of the corner adjacent to a slot (for crossing slope).
  const cornerFar = (slot: number): Vec | null => {
    const c = m.corners[m.slotCorner[slot]];
    if (c.reflex) return null;
    const farEdge = c.s1 === slot ? c.e2 : c.e1;
    return mid(g.dots[c.dot], g.dots[other(g.edges[farEdge], c.dot)]);
  };

  const slotGeom = new Map<number, SlotGeom>();
  const crossings: Vec[] = [];
  g.edges.forEach((e, ei) => {
    const P = g.dots[e.a];
    const Q = g.dots[e.b];
    const M = mid(P, Q);
    const L = dist(P, Q);
    const u = norm(sub(Q, P));
    const n = perp(u);
    const s = (atB: boolean, minus: boolean) => slotId(ei, atB, minus);
    const st = states[ei];
    if (st === CROSS) {
      crossings.push(M);
      // Strand 1: (a,+) → (b,−).  Strand 2: (a,−) → (b,+).
      const strand = (from: number, to: number, fallback: Vec): Vec => {
        const fa = cornerFar(from);
        const fb = cornerFar(to);
        if (fa && fb) return norm(sub(fb, fa));
        if (fa) return norm(sub(M, fa));
        if (fb) return norm(sub(fb, M));
        return norm(fallback);
      };
      const d1 = strand(s(false, false), s(true, true), sub(u, n));
      const d2 = strand(s(false, true), s(true, false), add(u, n));
      slotGeom.set(s(false, false), { p: M, t: d1 });
      slotGeom.set(s(true, true), { p: M, t: neg(d1) });
      slotGeom.set(s(false, true), { p: M, t: d2 });
      slotGeom.set(s(true, false), { p: M, t: neg(d2) });
    } else if (st === SPLIT) {
      const minSep = 0.22 * L;
      let ra = rho[e.a] * splitFactor;
      let rb = rho[e.b] * splitFactor;
      const over = ra + rb - (L - minSep);
      if (over > 0) {
        ra -= over / 2;
        rb -= over / 2;
      }
      const pa = add(P, scale(u, ra));
      const pb = sub(Q, scale(u, rb));
      slotGeom.set(s(false, false), { p: pa, t: neg(n) });
      slotGeom.set(s(false, true), { p: pa, t: n });
      slotGeom.set(s(true, false), { p: pb, t: neg(n) });
      slotGeom.set(s(true, true), { p: pb, t: n });
    } else {
      const base = (rho[e.a] + rho[e.b]) / 2;
      const off = (side: 1 | -1) => {
        const h = faceHeight(ei, side);
        if (h === null) return base * wrapFactor;
        // The strand alongside PQ must meet the next strand around each dot
        // before the edge midpoint, or the corner would fold back on itself:
        // offset < (L/2)·tan(θ/2) for the sector angle θ at each end.
        const sa = m.corners[m.slotCorner[s(false, side < 0)]].sweep;
        const sb = m.corners[m.slotCorner[s(true, side < 0)]].sweep;
        const wedge = 0.75 * (L / 2) * Math.tan(Math.min(sa, sb, Math.PI * 0.99) / 2);
        return Math.min(base * wrapFactor, 0.36 * h, wedge);
      };
      const pp = add(M, scale(n, off(1)));
      const pm = sub(M, scale(n, off(-1)));
      slotGeom.set(s(false, false), { p: pp, t: u });
      slotGeom.set(s(true, false), { p: pp, t: neg(u) });
      slotGeom.set(s(false, true), { p: pm, t: u });
      slotGeom.set(s(true, true), { p: pm, t: neg(u) });
    }
  });

  // Geometry for each corner, built s1 → s2 (counter-clockwise around its dot).
  const cornerSegs: Cubic[][] = m.corners.map((c) => {
    const D = g.dots[c.dot];
    const a = slotGeom.get(c.s1)!;
    const b = slotGeom.get(c.s2)!;
    const start = a.p;
    const startDir = neg(a.t);
    const end = b.p;
    const endDir = b.t;
    const a0 = angle(sub(start, D));
    let sweep: number;
    if (c.reflex) {
      sweep = wrap2pi(angle(sub(end, D)) - a0);
      if (sweep < 1e-6) sweep = Math.PI * 2;
    } else {
      // Inside a convex sector the strand never circles the dot.
      sweep = signedAngle(sub(start, D), sub(end, D));
    }
    // The tolerance keeps symmetric copies on the same side of the threshold
    // when a sweep lands exactly on it (e.g. 3 × 36° = 108° in 10-fold designs).
    const pieces = c.reflex
      ? Math.max(2, Math.ceil(sweep / (Math.PI * 0.55) - 1e-7))
      : Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI * 0.6) - 1e-7));
    const pts: SlotGeom[] = [{ p: start, t: startDir }];
    const r0 = dist(start, D);
    const r1 = dist(end, D);
    for (let i = 1; i < pieces; i++) {
      const f = i / pieces;
      const ta = a0 + sweep * f;
      let r = r0 + (r1 - r0) * f;
      if (c.reflex) r = rho[c.dot] * wrapFactor;
      pts.push({ p: add(D, fromAngle(ta, r)), t: fromAngle(ta + Math.PI / 2) });
    }
    pts.push({ p: end, t: endDir });
    const segs: Cubic[] = [];
    for (let i = 0; i + 1 < pts.length; i++) segs.push(hermite(pts[i].p, pts[i].t, pts[i + 1].p, pts[i + 1].t, tension));
    return segs;
  });

  const reverse = (c: Cubic): Cubic => [c[3], c[2], c[1], c[0]];
  const paths: Path[] = loops.map((loop) => {
    const segs: Cubic[] = [];
    for (const step of loop.steps) {
      const cs = cornerSegs[step.corner];
      if (step.forward) segs.push(...cs);
      else for (let i = cs.length - 1; i >= 0; i--) segs.push(reverse(cs[i]));
    }
    return { closed: true, segs };
  });
  return { paths, crossings };
}
