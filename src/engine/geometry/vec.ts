export interface Vec {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const neg = (a: Vec): Vec => ({ x: -a.x, y: -a.y });
/** Rotate 90° counter-clockwise (y up). */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const norm = (a: Vec): Vec => {
  const l = Math.hypot(a.x, a.y);
  if (l < 1e-12) throw new Error('normalising a zero vector');
  return { x: a.x / l, y: a.y / l };
};
export const angle = (a: Vec): number => Math.atan2(a.y, a.x);
export const fromAngle = (t: number, r = 1): Vec => ({ x: Math.cos(t) * r, y: Math.sin(t) * r });

/** Signed angle from a to b in (-π, π]. */
export function signedAngle(a: Vec, b: Vec): number {
  return Math.atan2(cross(a, b), dot(a, b));
}

/** Normalise an angle into [0, 2π). */
export function wrap2pi(t: number): number {
  const tau = Math.PI * 2;
  t %= tau;
  return t < 0 ? t + tau : t;
}

/** Orthogonal 2×2 linear map about the origin: [a b; c d]. */
export interface Mat2 {
  a: number;
  b: number;
  c: number;
  d: number;
}

export const apply = (m: Mat2, p: Vec): Vec => ({ x: m.a * p.x + m.b * p.y, y: m.c * p.x + m.d * p.y });
export const det = (m: Mat2): number => m.a * m.d - m.b * m.c;
export const rotation = (t: number): Mat2 => {
  // Snap to exact values for multiples of 90° so lattice symmetries stay exact.
  const c = snap(Math.cos(t));
  const s = snap(Math.sin(t));
  return { a: c, b: -s, c: s, d: c };
};
/** Reflection across the line through the origin at angle t. */
export const reflection = (t: number): Mat2 => {
  const c = snap(Math.cos(2 * t));
  const s = snap(Math.sin(2 * t));
  return { a: c, b: s, c: s, d: -c };
};
export const compose = (m: Mat2, n: Mat2): Mat2 => ({
  a: m.a * n.a + m.b * n.c,
  b: m.a * n.b + m.b * n.d,
  c: m.c * n.a + m.d * n.c,
  d: m.c * n.b + m.d * n.d,
});

function snap(x: number): number {
  for (const t of [0, 1, -1, 0.5, -0.5]) if (Math.abs(x - t) < 1e-12) return t;
  return x;
}

/** Quantised key for exact-match lookup of computed points. */
export function pointKey(p: Vec, q = 1e-6): string {
  const x = Math.round(p.x / q);
  const y = Math.round(p.y / q);
  return `${x === 0 ? 0 : x},${y === 0 ? 0 : y}`;
}
