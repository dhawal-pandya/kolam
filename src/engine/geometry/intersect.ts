import { Vec } from './vec';

export interface Seg {
  a: Vec;
  b: Vec;
  /** Owner tag: which stroke / element the segment belongs to. */
  owner: number;
  /** Index along the owner's polyline, used to skip neighbouring segments. */
  idx: number;
}

export interface Hit {
  p: Vec;
  s1: Seg;
  s2: Seg;
}

function segIntersect(a: Vec, b: Vec, c: Vec, d: Vec): Vec | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-14) return null;
  const qp = { x: c.x - a.x, y: c.y - a.y };
  const t = (qp.x * s.y - qp.y * s.x) / den;
  const u = (qp.x * r.y - qp.y * r.x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}

/**
 * All proper intersections among segments, via a uniform spatial hash.
 * `skip(s1, s2)` filters out pairs that are allowed to touch (e.g. adjacent
 * segments of the same polyline).
 */
export function findIntersections(segs: Seg[], cell: number, skip: (s1: Seg, s2: Seg) => boolean): Hit[] {
  const grid = new Map<string, number[]>();
  segs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s.a.x, s.b.x) / cell);
    const x1 = Math.floor(Math.max(s.a.x, s.b.x) / cell);
    const y0 = Math.floor(Math.min(s.a.y, s.b.y) / cell);
    const y1 = Math.floor(Math.max(s.a.y, s.b.y) / cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(i);
      }
  });
  const seen = new Set<number>();
  const hits: Hit[] = [];
  const n = segs.length;
  for (const list of grid.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = Math.min(list[i], list[j]);
        const b = Math.max(list[i], list[j]);
        const key = a * n + b;
        if (seen.has(key)) continue;
        seen.add(key);
        const s1 = segs[a];
        const s2 = segs[b];
        if (skip(s1, s2)) continue;
        const p = segIntersect(s1.a, s1.b, s2.a, s2.b);
        if (p) hits.push({ p, s1, s2 });
      }
  }
  return hits;
}

/** Minimum distance from point p to segment ab. */
export function pointSegDist(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
