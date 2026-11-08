import { Vec, add, dist, scale, sub, signedAngle, norm, len, dot } from './vec';

/** A cubic Bézier segment p0 → p3 with control points p1, p2. */
export type Cubic = [Vec, Vec, Vec, Vec];

/** A drawable stroke: a chain of cubic segments, optionally closed. */
export interface Path {
  closed: boolean;
  segs: Cubic[];
}

export function cubicAt(c: Cubic, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return {
    x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x,
    y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y,
  };
}

export function cubicTangent(c: Cubic, t: number): Vec {
  const u = 1 - t;
  return {
    x: 3 * u * u * (c[1].x - c[0].x) + 6 * u * t * (c[2].x - c[1].x) + 3 * t * t * (c[3].x - c[2].x),
    y: 3 * u * u * (c[1].y - c[0].y) + 6 * u * t * (c[2].y - c[1].y) + 3 * t * t * (c[3].y - c[2].y),
  };
}

/**
 * Hermite-style cubic from p0 (heading t0) to p3 (heading t3).
 * Handle length follows the circular-arc approximation
 *   h = chord · (2/3) · tan(θ/4) / sin(θ/2)
 * where θ is the total turning angle, so a constant-curvature turn is drawn
 * as close to a true circular arc as a single cubic allows.
 * `tension` scales both handles (1 = circular).
 */
export function hermite(p0: Vec, t0: Vec, p3: Vec, t3: Vec, tension = 1): Cubic {
  const chord = dist(p0, p3);
  const a = norm(t0);
  const b = norm(t3);
  const theta = Math.abs(signedAngle(a, b));
  let h: number;
  if (theta < 1e-6) {
    h = chord / 3;
  } else {
    h = (chord * (2 / 3) * Math.tan(theta / 4)) / Math.sin(theta / 2);
  }
  h *= tension;
  return [p0, add(p0, scale(a, h)), sub(p3, scale(b, h)), p3];
}

export function sampleCubic(c: Cubic, n: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) out.push(cubicAt(c, i / n));
  return out;
}

export function cubicLength(c: Cubic, n = 16): number {
  let total = 0;
  let prev = c[0];
  for (let i = 1; i <= n; i++) {
    const p = cubicAt(c, i / n);
    total += dist(prev, p);
    prev = p;
  }
  return total;
}

/** Polyline approximation of a whole path (closed paths repeat the first point). */
export function samplePath(path: Path, perSeg = 12): Vec[] {
  const pts: Vec[] = [];
  path.segs.forEach((s, i) => {
    const sm = sampleCubic(s, perSeg);
    pts.push(...(i === 0 ? sm : sm.slice(1)));
  });
  return pts;
}

export function pathLength(path: Path): number {
  return path.segs.reduce((acc, s) => acc + cubicLength(s), 0);
}

/** Is the segment degenerate (zero length or vanishing tangent)? */
export function isDegenerate(c: Cubic, eps = 1e-6): boolean {
  if (cubicLength(c, 8) < eps) return true;
  return len(cubicTangent(c, 0.5)) < eps;
}

/** Points sampled at roughly equal arc-length spacing `step` along a path. */
export function samplePathEvenly(path: Path, step: number): { p: Vec; t: Vec }[] {
  const out: { p: Vec; t: Vec }[] = [];
  let carry = 0;
  for (const seg of path.segs) {
    const n = 24;
    let prev = seg[0];
    for (let i = 1; i <= n; i++) {
      const p = cubicAt(seg, i / n);
      const d = dist(prev, p);
      let along = step - carry;
      while (along <= d) {
        const f = along / d;
        const q = { x: prev.x + (p.x - prev.x) * f, y: prev.y + (p.y - prev.y) * f };
        const tg = sub(p, prev);
        out.push({ p: q, t: len(tg) > 0 ? norm(tg) : { x: 1, y: 0 } });
        along += step;
      }
      carry = d - (along - step);
      prev = p;
    }
  }
  return out;
}

/** Cosine of angle between tangents at a joint; 1 means perfectly smooth. */
export function jointSmoothness(a: Cubic, b: Cubic): number {
  const ta = cubicTangent(a, 1);
  const tb = cubicTangent(b, 0);
  if (len(ta) < 1e-9 || len(tb) < 1e-9) return 1;
  return dot(norm(ta), norm(tb));
}
