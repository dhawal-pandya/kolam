/**
 * Construction-specific validation. Generation fails loudly (and the caller
 * retries a different deterministic candidate) rather than emit a design
 * that breaks its family's rules.
 */

import { Path, isDegenerate, samplePath } from './geometry/bezier';
import { Seg, findIntersections, pointSegDist } from './geometry/intersect';
import { Vec, dist } from './geometry/vec';
import { GraphSymmetry, SymmetryGroup } from './symmetry';
import { apply } from './geometry/vec';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  /** Smallest distance between two strands that are not meant to touch. */
  minStrandGap: number;
  /** Smallest distance from a line to a dot it goes around (line families). */
  minDotClearance: number;
}

export interface ValidateInput {
  family: 'pulli' | 'kambi' | 'sikku' | 'yantra';
  paths: Path[];
  dots: Vec[];
  unit: number;
  sym: GraphSymmetry;
  /** Points where crossings are intended (sikku). */
  crossings: Vec[];
  /** Region all geometry must stay within. */
  region: { minX: number; minY: number; maxX: number; maxY: number };
  loops?: number;
}

export function sampleStrands(paths: Path[], perSeg = 10): { segs: Seg[]; lens: number[] } {
  const segs: Seg[] = [];
  const lens: number[] = [];
  paths.forEach((p, owner) => {
    const pts = samplePath(p, perSeg);
    lens.push(pts.length - 1);
    for (let i = 0; i + 1 < pts.length; i++) segs.push({ a: pts[i], b: pts[i + 1], owner, idx: i });
  });
  return { segs, lens };
}

export function validateDesign(input: ValidateInput): ValidationReport {
  const errors: string[] = [];
  const { paths, unit } = input;
  const tol = unit * 1e-3;

  // Degenerate geometry.
  paths.forEach((p, i) => {
    if (p.segs.length === 0) errors.push(`path ${i} is empty`);
    p.segs.forEach((s, j) => {
      if (isDegenerate(s, unit * 1e-5)) errors.push(`path ${i} segment ${j} is degenerate`);
    });
    if (p.closed) {
      const a = p.segs[0][0];
      const b = p.segs[p.segs.length - 1][3];
      if (dist(a, b) > tol) errors.push(`closed path ${i} does not close`);
    }
    for (let j = 1; j < p.segs.length; j++) {
      if (dist(p.segs[j - 1][3], p.segs[j][0]) > tol) errors.push(`path ${i} breaks at segment ${j}`);
    }
  });

  // Bounds.
  const r = input.region;
  for (const p of paths)
    for (const s of p.segs)
      for (const q of s) {
        if (q.x < r.minX - tol || q.x > r.maxX + tol || q.y < r.minY - tol || q.y > r.maxY + tol) {
          errors.push('geometry leaves the drawing region');
          break;
        }
      }

  const { segs, lens } = sampleStrands(paths);
  const adjacent = (s1: Seg, s2: Seg) => {
    if (s1.owner !== s2.owner) return false;
    const n = lens[s1.owner];
    const d = Math.abs(s1.idx - s2.idx);
    return d <= 1 || (paths[s1.owner].closed && d >= n - 1);
  };
  const hits = findIntersections(segs, unit * 0.5, adjacent);

  if (input.family === 'sikku') {
    const allowed = (p: Vec) => input.crossings.some((c) => dist(c, p) < unit * 0.02);
    const bad = hits.filter((h) => !allowed(h.p));
    if (bad.length) errors.push(`${bad.length} unintended intersections`);
  } else if (input.family === 'kambi') {
    if (hits.length) errors.push(`${hits.length} intersections in a non-crossing kambi`);
  } else {
    // Pulli strokes may meet only at the dots they join.
    const bad = hits.filter((h) => !input.dots.some((d) => dist(d, h.p) < unit * 0.13));
    if (bad.length) errors.push(`${bad.length} strokes meet away from a dot`);
  }

  // Dot clearance for line families: no line may touch a dot.
  let minDotClearance = Infinity;
  if (input.family !== 'pulli') {
    const segGrid = new PointGrid<Seg>(unit * 0.5);
    for (const sg of segs) segGrid.add((sg.a.x + sg.b.x) / 2, (sg.a.y + sg.b.y) / 2, sg);
    for (const d of input.dots)
      segGrid.near(d.x, d.y, 2, (sg) => {
        const dd = pointSegDist(d, sg.a, sg.b);
        if (dd < minDotClearance) minDotClearance = dd;
      });
    if (minDotClearance < unit * 0.12) errors.push(`a line passes within ${minDotClearance.toFixed(3)} of a dot`);
  }

  const minStrandGap = strandGap(segs, lens, paths, unit, input.crossings, input.family === 'pulli' ? input.dots : []);

  // Exact symmetry: every sampled point maps onto the drawing.
  const symErr = symmetryError(paths, input.sym, unit);
  if (symErr > unit * 1e-3) errors.push(`symmetry deviates by ${symErr.toExponential(2)}`);

  return { ok: errors.length === 0, errors, minStrandGap, minDotClearance };
}

/**
 * Yantra validation. Lines of a yantra intersect by design (interlocking
 * triangles), so there is no intersection rule; instead every line and the
 * bindu must carry the form's symmetry exactly, nothing may be degenerate,
 * and closed shapes must close. Inscribed text (bija, numerals) is exempt
 * from symmetry by nature.
 */
export function validateYantra(input: {
  paths: Path[];
  symmetricFills: Path[];
  fills: Path[];
  group: SymmetryGroup;
  unit: number;
}): ValidationReport {
  const errors: string[] = [];
  const tol = input.unit * 1e-6;
  [...input.paths, ...input.symmetricFills, ...input.fills].forEach((p, i) => {
    if (p.segs.length === 0) errors.push(`shape ${i} is empty`);
    p.segs.forEach((s, j) => {
      if (isDegenerate(s, input.unit * 1e-6)) errors.push(`shape ${i} segment ${j} is degenerate`);
    });
    for (let j = 1; j < p.segs.length; j++) if (dist(p.segs[j - 1][3], p.segs[j][0]) > tol) errors.push(`shape ${i} breaks at ${j}`);
    if (p.closed && dist(p.segs[0][0], p.segs[p.segs.length - 1][3]) > tol) errors.push(`closed shape ${i} does not close`);
  });
  const symErr = symmetryError([...input.paths, ...input.symmetricFills], { group: input.group, map: (g, p) => apply(input.group.elements[g], p) }, input.unit);
  if (symErr > input.unit * 1e-6) errors.push(`symmetry deviates by ${symErr.toExponential(2)}`);
  return { ok: errors.length === 0, errors, minStrandGap: Infinity, minDotClearance: Infinity };
}

/** Worst distance between a transformed sample point and the original drawing. */
export function symmetryError(paths: Path[], sym: Pick<GraphSymmetry, 'group' | 'map'>, unit: number): number {
  const pts: Vec[] = [];
  for (const p of paths) pts.push(...samplePath(p, 6));
  const cell = unit * 0.25;
  const grid = new Map<string, Vec[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const p of pts) {
    const k = key(p.x, p.y);
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(p);
  }
  let worst = 0;
  for (let g = 0; g < sym.group.elements.length; g++) {
    for (let i = 0; i < pts.length; i += 3) {
      const q = sym.map(g, pts[i]);
      let best = Infinity;
      const cx = Math.floor(q.x / cell);
      const cy = Math.floor(q.y / cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const l = grid.get(`${cx + dx},${cy + dy}`);
          if (l) for (const p of l) best = Math.min(best, dist(p, q));
        }
      worst = Math.max(worst, best);
    }
  }
  return worst;
}

/**
 * Smallest gap between strands that are not locally the same strand, ignoring
 * the immediate neighbourhood of intended crossings and of dots (where pulli
 * strokes legitimately meet).
 */
function strandGap(segs: Seg[], lens: number[], paths: Path[], unit: number, crossings: Vec[], joinDots: Vec[]): number {
  const pts = segs.map((s) => ({ p: s.a, owner: s.owner, idx: s.idx }));
  const cell = unit * 0.2;
  const grid = new Map<string, typeof pts>();
  for (const q of pts) {
    const k = `${Math.floor(q.p.x / cell)},${Math.floor(q.p.y / cell)}`;
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(q);
  }
  const special = new PointGrid<{ p: Vec; r: number }>(unit * 0.3);
  for (const c of crossings) special.add(c.x, c.y, { p: c, r: unit * 0.12 });
  for (const d of joinDots) special.add(d.x, d.y, { p: d, r: unit * 0.3 });
  const excluded = (p: Vec) => {
    let hit = false;
    special.near(p.x, p.y, 1, (o) => {
      if (!hit && dist(o.p, p) < o.r) hit = true;
    });
    return hit;
  };
  let best = Infinity;
  for (const q of pts) {
    if (excluded(q.p)) continue;
    const cx = Math.floor(q.p.x / cell);
    const cy = Math.floor(q.p.y / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const l = grid.get(`${cx + dx},${cy + dy}`);
        if (!l) continue;
        for (const o of l) {
          if (o.owner === q.owner) {
            const n = lens[o.owner];
            let d = Math.abs(o.idx - q.idx);
            if (paths[o.owner].closed) d = Math.min(d, n - d);
            if (d < 12) continue; // same strand, locally
          }
          if (excluded(o.p)) continue;
          best = Math.min(best, dist(o.p, q.p));
        }
      }
  }
  return best;
}

/** Minimal uniform spatial hash for proximity queries. */
class PointGrid<T> {
  private cells = new Map<number, T[]>();
  constructor(private cell: number) {}
  private key(ix: number, iy: number) {
    return ix * 73856093 + iy * 19349663;
  }
  add(x: number, y: number, item: T) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell));
    let l = this.cells.get(k);
    if (!l) this.cells.set(k, (l = []));
    l.push(item);
  }
  near(x: number, y: number, radiusCells: number, fn: (item: T) => void) {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    for (let dx = -radiusCells; dx <= radiusCells; dx++)
      for (let dy = -radiusCells; dy <= radiusCells; dy++) {
        const l = this.cells.get(this.key(cx + dx, cy + dy));
        if (l) for (const it of l) fn(it);
      }
  }
}
