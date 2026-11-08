/**
 * PULLI KOLAM — dot-joining kolam.
 *
 * In this family the dots are the anchors that strokes *join* (as opposed to
 * Sikku/Kambi, where lines go around the dots). Construction rules:
 *   P1  Strokes run only between lattice neighbours: along a lattice edge or
 *       across the diagonal of a square cell. No free-floating geometry.
 *   P2  Each stroke is one of the traditional joining marks: a straight line
 *       (kodu), a petal/leaf (two arcs meeting at both dots), or a single arc
 *       bowed outward, inward, or (rotational designs only) swirling.
 *   P3  Strokes meet only at dots — never cross or touch elsewhere.
 *   P4  Every dot is used (no orphan dots) and the drawing is one connected
 *       figure through its dots.
 *   P5  Styles are chosen per concentric layer and per stroke orbit, so
 *       motifs repeat ring by ring as they do in drawn pulli kolams.
 */

import { Cubic, Path, hermite, sampleCubic } from '../geometry/bezier';
import { findIntersections, Seg } from '../geometry/intersect';
import { Vec, dist, dot, len, mid, norm, perp, sub, angle, wrap2pi } from '../geometry/vec';
import { DotGraph } from '../lattice/graph';
import { Rng } from '../rng';
import { GraphSymmetry, isReflection } from '../symmetry';

export type PulliStyle = 'line' | 'petal' | 'arc-out' | 'arc-in' | 'arc-swirl';

export interface PulliLink {
  a: number;
  b: number;
  kind: 'edge' | 'diag';
  style: 'line' | 'petal' | 'arc';
  /** For arcs: +1 bulges left of a→b, −1 right. */
  side: 1 | -1;
  /** Tangent half-angle at the dots (radians). */
  theta: number;
}

export interface PulliResult {
  links: PulliLink[];
  attempts: number;
}

export interface PulliParams {
  complexity: number;
  ornamentation: number;
  curvature: number; // 0…1
}

interface Cand {
  a: number;
  b: number;
  kind: 'edge' | 'diag';
}

const keyOf = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

export function linkCandidates(graph: DotGraph): Cand[] {
  const out: Cand[] = graph.edges.map((e) => ({ a: e.a, b: e.b, kind: 'edge' as const }));
  const seen = new Set(out.map((c) => keyOf(c.a, c.b)));
  for (const f of graph.faces) {
    if (f.length !== 4) continue;
    for (const [i, j] of [
      [0, 2],
      [1, 3],
    ]) {
      const a = Math.min(f[i], f[j]);
      const b = Math.max(f[i], f[j]);
      const k = keyOf(a, b);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ a, b, kind: 'diag' });
    }
  }
  return out;
}

export function linkPaths(graph: DotGraph, l: PulliLink): Path[] {
  const P = graph.dots[l.a];
  const Q = graph.dots[l.b];
  const u = norm(sub(Q, P));
  const rot = (w: Vec, t: number): Vec => ({ x: w.x * Math.cos(t) - w.y * Math.sin(t), y: w.x * Math.sin(t) + w.y * Math.cos(t) });
  const arc = (s: number): Cubic => hermite(P, rot(u, s * l.theta), Q, rot(u, -s * l.theta), 1);
  if (l.style === 'line') return [{ closed: false, segs: [hermite(P, u, Q, u)] }];
  if (l.style === 'arc') return [{ closed: false, segs: [arc(l.side)] }];
  const top = arc(1);
  const bot = arc(-1);
  return [{ closed: true, segs: [top, [bot[3], bot[2], bot[1], bot[0]]] }];
}

const DEFAULT_THETA: Record<'line' | 'petal' | 'arc', number> = {
  line: 0,
  petal: (25 * Math.PI) / 180,
  arc: (42 * Math.PI) / 180,
};

export function generatePulli(graph: DotGraph, sym: GraphSymmetry, rng: Rng, params: PulliParams): PulliResult {
  const cands = linkCandidates(graph);
  const candIndex = new Map(cands.map((c, i) => [keyOf(c.a, c.b), i]));
  const hasReflection = sym.group.elements.some(isReflection);

  // Orbits of candidates under the group.
  const orbitOf = new Array(cands.length).fill(-1);
  const orbits: number[][] = [];
  cands.forEach((_, i) => {
    if (orbitOf[i] >= 0) return;
    const set = new Set<number>();
    for (const perm of sym.dotPerm) {
      const j = candIndex.get(keyOf(perm[cands[i].a], perm[cands[i].b]));
      if (j === undefined) throw new Error('pulli: candidate set not symmetric');
      set.add(j);
    }
    const arr = [...set].sort((x, y) => x - y);
    arr.forEach((j) => (orbitOf[j] = orbits.length));
    orbits.push(arr);
  });

  // Image of (candidate, side) under element g.
  const imageSide = (c: number, side: 1 | -1, g: number): { c: number; side: 1 | -1 } => {
    const perm = sym.dotPerm[g];
    const a2 = perm[cands[c].a];
    const b2 = perm[cands[c].b];
    const j = candIndex.get(keyOf(a2, b2))!;
    let s = side;
    if (isReflection(sym.group.elements[g])) s = -s as 1 | -1;
    if (cands[j].a !== a2) s = -s as 1 | -1;
    return { c: j, side: s };
  };

  // Geometric descriptors used for style semantics.
  const descr = cands.map((c) => {
    const P = graph.dots[c.a];
    const Q = graph.dots[c.b];
    const m = mid(P, Q);
    const u = norm(sub(Q, P));
    const n = perp(u);
    const ml = len(m);
    const outward = ml < 1e-9 ? 0 : dot(n, m) / ml; // + means left side faces outward
    const radialness = ml < 1e-9 ? 1 : Math.abs(dot(u, m)) / ml;
    // Orientation pointing away from the centre, for swirl arcs.
    const outSign = dot(u, m) >= 0 ? 1 : -1;
    return { outward, radialness, outSign, bandLo: Math.min(graph.band[c.a], graph.band[c.b]), bandHi: Math.max(graph.band[c.a], graph.band[c.b]) };
  });

  /**
   * Stroke roles:
   *   ring    lattice edge within one concentric band (the band's outline)
   *   spoke   lattice edge from one band to the next (a ray)
   *   dspoke  cell diagonal pointing outward (a diagonal ray / leaf)
   *   dtan    cell diagonal running around the centre (lattice net)
   */
  type Role = 'ring' | 'spoke' | 'dspoke' | 'dtan';
  const roleOf = (c: number): Role => {
    const d = descr[c];
    if (cands[c].kind === 'edge') return d.bandLo === d.bandHi ? 'ring' : 'spoke';
    return d.radialness > 0.8 ? 'dspoke' : 'dtan';
  };
  const maxBand = Math.max(...graph.band);
  const orn = params.ornamentation;

  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng.fork(`pulli-attempt-${attempt}`);
    // 1. Design plan: one ring style per band, one spoke style for the whole
    //    figure (rays read as one gesture), per-band on/off switches.
    const ringStyle: (PulliStyle | 'none')[] = [];
    for (let b = 0; b <= maxBand; b++) {
      // Bowed arcs dominate: they give the rounded, hand-swept outline of
      // drawn pulli kolams. Straight kodu lines stay rare.
      const opts: (PulliStyle | 'none')[] = ['none', 'line', 'petal', 'arc-out', 'arc-in', 'arc-swirl'];
      const w = [b === 0 ? 0 : 1.8, 0.1, 0.45, 2.6, 2.0, hasReflection ? 0 : 1.6];
      ringStyle.push(r.weighted(opts, w));
    }
    const spokeStyle = r.weighted<PulliStyle>(['petal', 'arc-swirl'], [3, hasReflection ? 0 : 2.5]);
    const dspokeStyle = r.weighted<PulliStyle>(['petal', 'arc-swirl'], [3, hasReflection ? 0 : 1]);
    const spokeOn: boolean[] = [];
    const dspokeOn: boolean[] = [];
    for (let b = 0; b <= maxBand; b++) {
      // Rays are required where neither neighbouring ring is drawn.
      const needed = ringStyle[b] === 'none' || (b + 1 <= maxBand && ringStyle[b + 1] === 'none');
      // Rays are required where neither neighbouring ring is drawn; next to
      // a petal ring they would turn the figure into a trellis of circles.
      const petalRing = ringStyle[b] === 'petal' || (b + 1 <= maxBand && ringStyle[b + 1] === 'petal');
      spokeOn.push(needed || (!petalRing && r.chance(0.35 + 0.03 * orn)));
      dspokeOn.push(r.chance(0.12 + 0.05 * orn));
    }
    const dtanOn = r.chance(0.04 * orn);
    const orbitStyle: (PulliStyle | 'none')[] = orbits.map((orb) => {
      const c = orb[0];
      const b = descr[c].bandLo;
      switch (roleOf(c)) {
        case 'ring':
          return ringStyle[b];
        case 'spoke':
          return spokeOn[b] ? spokeStyle : 'none';
        case 'dspoke':
          return dspokeOn[b] ? dspokeStyle : 'none';
        case 'dtan':
          return dtanOn ? 'petal' : 'none';
      }
    });

    // 2. Greedy, intersection-checked placement, structural strokes first.
    const placed: PulliLink[] = [];
    const index = new SegIndex(graph, graph.unit * 0.5);
    const tryPlace = (o: number, style: PulliStyle, widthScale = 1): boolean => {
      const rep = orbits[o][0];
      const links = orbitLinks(rep, style, widthScale);
      if (!links) return false;
      const segs: Seg[] = [];
      links.forEach((l, li) => {
        for (const p of linkPaths(graph, l))
          p.segs.forEach((s) => {
            const pts = sampleCubic(s, 10);
            for (let i = 0; i + 1 < pts.length; i++) segs.push({ a: pts[i], b: pts[i + 1], owner: placed.length + li, idx: i });
          });
      });
      const ownerLink = (s: Seg) => links[s.owner - placed.length];
      if (index.conflicts(segs, ownerLink) || selfConflict(graph, segs, links, placed.length)) return false;
      index.add(segs, links, placed.length);
      placed.push(...links);
      return true;
    };

    const orbitLinks = (rep: number, style: PulliStyle, widthScale: number): PulliLink[] | null => {
      const kind = cands[rep].kind;
      let base: PulliLink['style'];
      let side: 1 | -1 = 1;
      if (style === 'line' || style === 'petal') base = style;
      else {
        base = 'arc';
        const d = descr[rep];
        if (style === 'arc-swirl') {
          if (hasReflection) return null;
          side = (d.outSign as 1 | -1);
        } else {
          if (Math.abs(d.outward) < 0.2) return null;
          const outSide: 1 | -1 = d.outward > 0 ? 1 : -1;
          side = style === 'arc-out' ? outSide : (-outSide as 1 | -1);
        }
      }
      const seen = new Map<number, 1 | -1>();
      for (let g = 0; g < sym.dotPerm.length; g++) {
        const im = imageSide(rep, side, g);
        const prev = seen.get(im.c);
        if (prev !== undefined && prev !== im.side && base === 'arc') return null; // asymmetric arc
        seen.set(im.c, im.side);
      }
      return [...seen.entries()].map(([c, s]) => ({
        a: cands[c].a,
        b: cands[c].b,
        kind,
        style: base,
        side: s,
        theta: DEFAULT_THETA[base] * (0.85 + 0.3 * params.curvature) * widthScale,
      }));
    };

    const order = orbits
      .map((orb, o) => ({ o, k: (cands[orb[0]].kind === 'diag' ? 10 : 0) + descr[orb[0]].bandLo * 0.01 + r.next() * 0.001 }))
      .sort((x, y) => x.k - y.k)
      .map((x) => x.o);
    for (const o of order) {
      const st = orbitStyle[o];
      if (st === 'none') continue;
      if (!tryPlace(o, st)) {
        // A clashing curve may still fit as a straight joining line.
        // A clashing curve is first drawn slimmer; never silently straightened.
        if (!tryPlace(o, st, 0.6)) tryPlace(o, st, 0.38);
      }
    }

    // 3. Connectivity repair: join components (and orphan dots) with
    //    symmetric orbits until the drawing is one figure.
    const uf = new UnionFind(graph.dots.length);
    const touched = new Uint8Array(graph.dots.length);
    for (const l of placed) {
      uf.union(l.a, l.b);
      touched[l.a] = touched[l.b] = 1;
    }
    const usedCand = new Set(placed.map((l) => keyOf(l.a, l.b)));
    let guard = 0;
    while (uf.count() > 1 && guard++ < 200) {
      const options = orbits
        .map((orb, o) => o)
        .filter((o) => !usedCand.has(keyOf(cands[orbits[o][0]].a, cands[orbits[o][0]].b)))
        .filter((o) => orbits[o].some((c) => uf.find(cands[c].a) !== uf.find(cands[c].b)));
      if (options.length === 0) break;
      const ranked = r.shuffle(options).sort((x, y) => (cands[orbits[x][0]].kind === 'edge' ? 0 : 1) - (cands[orbits[y][0]].kind === 'edge' ? 0 : 1));
      let ok = false;
      for (const o of ranked) {
        const st = orbitStyle[o];
        const pref: PulliStyle = st === 'none' ? 'petal' : st;
        if (tryPlace(o, pref) || tryPlace(o, pref, 0.6) || tryPlace(o, 'petal', 0.45) || tryPlace(o, 'line')) {
          for (const c of orbits[o]) {
            uf.union(cands[c].a, cands[c].b);
            usedCand.add(keyOf(cands[c].a, cands[c].b));
            touched[cands[c].a] = touched[cands[c].b] = 1;
          }
          ok = true;
          break;
        }
        for (const c of orbits[o]) usedCand.add(keyOf(cands[c].a, cands[c].b));
      }
      if (!ok) break;
    }
    if (uf.count() > 1 || touched.some((t) => t === 0)) continue;
    // Too sparse to read as a kolam?
    if (placed.length < Math.min(graph.dots.length * 0.9, cands.length * 0.6)) continue;

    fitAngles(graph, placed);
    return { links: placed, attempts: attempt + 1 };
  }
  throw new Error('Pulli: no valid dot-joining construction found for this configuration');
}

function selfConflict(graph: DotGraph, segs: Seg[], links: PulliLink[], base: number): boolean {
  const hits = findIntersections(segs, 0.25, (s1, s2) => s1.owner === s2.owner);
  return hits.some((h) => !nearSharedDot(graph, h.p, links[h.s1.owner - base], links[h.s2.owner - base]));
}

/** Strokes sharing a dot may meet only inside that dot's mark. */
function nearSharedDot(graph: DotGraph, p: Vec, l1: PulliLink, l2: PulliLink): boolean {
  const shared = [l1.a, l1.b].filter((d) => d === l2.a || d === l2.b);
  return shared.some((d) => dist(p, graph.dots[d]) < 0.12 * graph.unit);
}

class SegIndex {
  private grid = new Map<string, { s: Seg; owner: number }[]>();
  private links: PulliLink[] = [];
  constructor(
    private graph: DotGraph,
    private cell: number,
  ) {}
  private keys(s: Seg): string[] {
    const out: string[] = [];
    const x0 = Math.floor(Math.min(s.a.x, s.b.x) / this.cell);
    const x1 = Math.floor(Math.max(s.a.x, s.b.x) / this.cell);
    const y0 = Math.floor(Math.min(s.a.y, s.b.y) / this.cell);
    const y1 = Math.floor(Math.max(s.a.y, s.b.y) / this.cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(`${x},${y}`);
    return out;
  }
  conflicts(segs: Seg[], pendingLink: (s: Seg) => PulliLink): boolean {
    for (const s of segs) {
      const l1 = pendingLink(s);
      for (const k of this.keys(s)) {
        const list = this.grid.get(k);
        if (!list) continue;
        for (const t of list) {
          const pair = findIntersections([s, t.s], 1e9, () => false);
          if (pair.length && !nearSharedDot(this.graph, pair[0].p, l1, this.links[t.owner])) return true;
        }
      }
    }
    return false;
  }
  add(segs: Seg[], links: PulliLink[], base: number) {
    links.forEach((l, i) => (this.links[base + i] = l));
    for (const s of segs) for (const k of this.keys(s)) {
      let list = this.grid.get(k);
      if (!list) this.grid.set(k, (list = []));
      list.push({ s, owner: s.owner });
    }
  }
}

class UnionFind {
  private p: number[];
  private n: number;
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
    this.n = n;
  }
  find(x: number): number {
    while (this.p[x] !== x) x = this.p[x] = this.p[this.p[x]];
    return x;
  }
  union(a: number, b: number) {
    const x = this.find(a);
    const y = this.find(b);
    if (x !== y) {
      this.p[x] = y;
      this.n--;
    }
  }
  count() {
    return this.n;
  }
}

/**
 * Shrink petal/arc widths where strokes leave a dot too close together so
 * they separate cleanly instead of merging into a blot. Purely a function of
 * the (symmetric) stroke set, so symmetry is preserved.
 */
function fitAngles(graph: DotGraph, links: PulliLink[]) {
  const minGap = (10 * Math.PI) / 180;
  for (let pass = 0; pass < 3; pass++) {
    const ends: { link: number; dir: number; lo: number; hi: number }[][] = graph.dots.map(() => []);
    links.forEach((l, i) => {
      for (const atA of [true, false]) {
        const d = atA ? l.a : l.b;
        const o = atA ? l.b : l.a;
        const dir = angle(sub(graph.dots[o], graph.dots[d]));
        let lo = 0;
        let hi = 0;
        if (l.style === 'petal') {
          lo = -l.theta;
          hi = l.theta;
        } else if (l.style === 'arc') {
          const s = atA ? l.side : -l.side;
          if (s > 0) hi = l.theta;
          else lo = -l.theta;
        }
        ends[d].push({ link: i, dir, lo, hi });
      }
    });
    let changed = false;
    ends.forEach((list) => {
      if (list.length < 2) return;
      list.sort((x, y) => x.dir - y.dir);
      for (let i = 0; i < list.length; i++) {
        const A = list[i];
        const B = list[(i + 1) % list.length];
        const gap = wrap2pi(B.dir + B.lo - (A.dir + A.hi));
        const raw = wrap2pi(B.dir - A.dir);
        if (gap >= minGap && gap <= raw + 1e-9) continue;
        const spread = A.hi - B.lo;
        if (spread <= 1e-9) continue;
        const avail = Math.max(0, raw - minGap);
        const f = Math.min(1, avail / spread);
        const la = links[A.link];
        const lb = links[B.link];
        la.theta = Math.min(la.theta, la.theta * f);
        lb.theta = Math.min(lb.theta, lb.theta * f);
        changed = true;
      }
    });
    if (!changed) break;
  }
  for (const l of links) {
    if (l.style !== 'line' && l.theta < (8 * Math.PI) / 180) {
      l.style = 'line';
      l.theta = 0;
    }
  }
}
