/**
 * NAMED YANTRAS — canonical, documented forms (no seed-driven variation).
 *
 * A yantra is not a dot-lattice kolam: it is a centred, layered diagram
 * (bindu, triangles, circles, lotus petals, bhupura). Each named yantra below
 * is drawn in ONE fixed form, with its source recorded in
 * docs/CONSTRUCTION.md §11. The design seed only varies the organic powder
 * texture, never the geometry.
 *
 * Shared primitives:
 *   bhupura   three nested square lines with a T-shaped gate at the middle
 *             of each side (the "earth square" with four doors)
 *   lotus     n petals whose bases tile a circle and whose pointed tips reach
 *             an outer radius
 *   triangle  straight lines; hexagram (shatkona) = upward + downward
 *   circle    eight cubic arcs (max radial error ≈ 0.0004 r)
 */

import { Cubic, Path } from '../geometry/bezier';
import { Vec, add, fromAngle, scale, sub, v, norm } from '../geometry/vec';
import { hermite } from '../geometry/bezier';
import type { SymmetryType } from '../config';
import { GLYPHS } from './glyphs';

export type YantraName = 'ganapati' | 'sri-chakra' | 'shatkona' | 'kubera';
export const YANTRAS: YantraName[] = ['ganapati', 'sri-chakra', 'shatkona', 'kubera'];

export const YANTRA_INFO: Record<YantraName, { label: string; code: string; symmetry: SymmetryType; count: number; note: string }> = {
  ganapati: {
    label: 'Ganapati yantra',
    code: 'G',
    symmetry: 'bilateral-v',
    count: 1,
    note: 'Bhupura, eight-petal lotus, shatkona and central triangle, with the bija गं.',
  },
  'sri-chakra': {
    label: 'Sri Chakra',
    code: 'S',
    symmetry: 'bilateral-v',
    count: 1,
    note: 'Nine interlocking triangles by the classical 48-unit construction, 8- and 16-petal lotuses, three circles, bhupura, bindu.',
  },
  shatkona: {
    label: 'Shatkona yantra',
    code: 'H',
    symmetry: 'four-way',
    count: 2,
    note: 'The six-pointed star of Kartikeya (Subramanya) in a circle and bhupura, with the bindu.',
  },
  kubera: {
    label: 'Kubera kolam',
    code: 'K',
    symmetry: 'dihedral',
    count: 4,
    note: 'The rice-flour magic square of २०–२८ (20–28) in Devanagari numerals: every row, column and diagonal sums to ७२ (72).',
  },
};

export interface YantraGeometry {
  /** Stroked lines. These carry the yantra's symmetry exactly. */
  paths: Path[];
  /** Filled shapes: bija syllable, numerals, bindu. Text is exempt from symmetry. */
  fills: Path[];
  /** Fills that are geometric (bindu) and so must respect symmetry. */
  symmetricFills: Path[];
}

/* ---------------------------------------------------------------- primitives */

const seg = (a: Vec, b: Vec): Cubic => [a, add(a, scale(sub(b, a), 1 / 3)), add(a, scale(sub(b, a), 2 / 3)), b];

export function polygon(pts: Vec[], closed = true): Path {
  const segs: Cubic[] = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push(seg(pts[i], pts[i + 1]));
  if (closed) segs.push(seg(pts[pts.length - 1], pts[0]));
  return { closed, segs };
}

export function circle(c: Vec, r: number, n = 8): Path {
  const k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * r;
  const segs: Cubic[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * i) / n;
    const a1 = (2 * Math.PI * (i + 1)) / n;
    const p0 = add(c, fromAngle(a0, r));
    const p3 = add(c, fromAngle(a1, r));
    segs.push([p0, add(p0, fromAngle(a0 + Math.PI / 2, k)), sub(p3, fromAngle(a1 + Math.PI / 2, k)), p3]);
  }
  return { closed: true, segs };
}

/** Regular triangle inscribed in radius R; `up` points the apex upward. */
export function triangle(R: number, up: boolean): Path {
  const start = up ? Math.PI / 2 : -Math.PI / 2;
  return polygon([0, 1, 2].map((i) => fromAngle(start + (2 * Math.PI * i) / 3, R)));
}

/**
 * Lotus ring: n petals, bases on radius r0 (adjacent petals share base
 * points), pointed tips on radius r1. One path per petal: base → tip → base.
 */
export function lotus(n: number, r0: number, r1: number, phase = Math.PI / 2): Path[] {
  const out: Path[] = [];
  for (let i = 0; i < n; i++) {
    const t = phase + (2 * Math.PI * i) / n;
    const half = Math.PI / n;
    const A = fromAngle(t + half, r0);
    const T = fromAngle(t, r1);
    const B = fromAngle(t - half, r0);
    // Petal sides leave the base circle radially, swell, and meet at a point.
    const tipIn = 0.55; // half-angle of the tip, radians
    const left = hermite(A, fromAngle(t + half * 0.35), T, fromAngle(t - tipIn), 1.05);
    const right = hermite(T, fromAngle(t + Math.PI + tipIn), B, fromAngle(t - half * 0.35 + Math.PI), 1.05);
    out.push({ closed: false, segs: [left, right] });
  }
  return out;
}

/**
 * Bhupura: `lines` nested square outlines with a T-shaped gate at the middle
 * of each side. S = half-size of the innermost square; spacing between lines.
 * The gate on each side: a stem of half-width g, then a crossbar overhanging
 * by w with thickness t. Outer lines are exact offsets of the inner outline
 * (rectilinear offset), so the lines stay evenly spaced. Each offset shortens
 * the stem by 2·spacing, so `d` is the stem depth of the OUTERMOST line and
 * the inner stem is lengthened to match — otherwise outer stems would invert
 * and cross themselves.
 */
export function bhupura(S: number, spacing: number, lines = 3, g = 1.0, dOuter = 0.45, w = 0.5, t = 0.45): Path[] {
  const d = dOuter + 2 * spacing * (lines - 1);
  // One side (top), in order from left corner to right corner.
  const side: Vec[] = [v(-S, S), v(-g, S), v(-g, S + d), v(-g - w, S + d), v(-g - w, S + d + t), v(g + w, S + d + t), v(g + w, S + d), v(g, S + d), v(g, S)];
  const rot = (p: Vec, k: number): Vec => {
    // rotate by −90°·k (clockwise), so sides go top → right → bottom → left
    let q = p;
    for (let i = 0; i < k; i++) q = v(q.y, -q.x);
    return q;
  };
  const outline: Vec[] = [];
  for (let k = 0; k < 4; k++) outline.push(...side.map((p) => rot(p, k)));
  const out: Path[] = [];
  for (let l = 0; l < lines; l++) out.push(polygon(offsetRectilinear(outline, spacing * l)));
  return out;
}

/** Outward offset of a clockwise rectilinear polygon by s. */
function offsetRectilinear(pts: Vec[], s: number): Vec[] {
  if (s === 0) return pts;
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    // Outward normals of the incoming and outgoing edges (clockwise order → left normal points out).
    const e1 = norm(sub(p, a));
    const e2 = norm(sub(b, p));
    const n1 = v(-e1.y, e1.x);
    const n2 = v(-e2.y, e2.x);
    return add(p, scale(add(n1, n2), s));
  });
}

/**
 * Text as filled outlines, centred at c. `height` is the height of the
 * vertical band [band[0], band[1]] (font units) that is centred on c; by
 * default the band is the text's own extent. Passing a shared band (e.g. all
 * digits) puts every number on the same baseline.
 */
export function glyphText(text: string, c: Vec, height: number, band?: [number, number]): Path[] {
  const chars = GLYPHS[text] ? [text] : [...text];
  const datas = chars.map((ch) => {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`no glyph for "${ch}"`);
    return g;
  });
  let x = 0;
  const placed: { g: (typeof datas)[number]; x: number }[] = [];
  for (const g of datas) {
    placed.push({ g, x });
    x += g.advance;
  }
  const minX = Math.min(...placed.map((p) => p.x + p.g.box[0]));
  const maxX = Math.max(...placed.map((p) => p.x + p.g.box[2]));
  const [lo, hi] = band ?? [Math.min(...datas.map((g) => g.box[1])), Math.max(...datas.map((g) => g.box[3]))];
  const k = height / (hi - lo);
  const ox = (minX + maxX) / 2;
  const oy = (lo + hi) / 2;
  const out: Path[] = [];
  for (const { g, x: gx } of placed)
    for (const cont of g.contours) {
      const pt = (i: number) => v(c.x + (cont[i] + gx - ox) * k, c.y + (cont[i + 1] - oy) * k);
      const segs: Cubic[] = [];
      let prev = pt(0);
      for (let i = 2; i + 5 < cont.length + 0; i += 6) {
        const end = pt(i + 4);
        // Fonts contain zero-length closing lines; drop them, keep continuity.
        if (Math.hypot(end.x - prev.x, end.y - prev.y) < height * 1e-4) continue;
        segs.push([prev, pt(i), pt(i + 2), end]);
        prev = end;
      }
      if (segs.length) out.push({ closed: true, segs });
    }
  return out;
}

/** Devanagari numerals (०–९) for a non-negative integer. */
export function devanagariNumeral(n: number): string {
  return [...String(n)].map((d) => String.fromCharCode(0x0966 + Number(d))).join('');
}

/** Shared vertical band of the Devanagari digits, so numbers align. */
function digitBand(): [number, number] {
  const ds = [...'०१२३४५६७८९'].map((d) => GLYPHS[d].box);
  return [Math.min(...ds.map((b) => b[1])), Math.max(...ds.map((b) => b[3]))];
}

/* ------------------------------------------------------------------- yantras */

function ganapati(): YantraGeometry {
  const r0 = 4.4; // vritta: base of the lotus, circumscribing the shatkona
  const paths: Path[] = [
    ...bhupura(8, 0.32, 3, 1.1, 0.4, 0.5, 0.4),
    circle(v(0, 0), 7.1), // lotus enclosure
    ...lotus(8, r0, 6.8),
    circle(v(0, 0), r0),
    triangle(r0, true),
    triangle(r0, false), // shatkona
    // Trikona: the downward triangle touching the inner hexagon of the
    // shatkona at its edge midpoints (radius r0/2).
    triangle(r0 / 2, false),
  ];
  // Bija गं sits in the central triangle (whose base is uppermost).
  const fills = glyphText('गं', v(0, 0.1), 1.5);
  return { paths, fills, symmetricFills: [] };
}

/**
 * Sri Chakra by the classical inward construction (Kaivalyashrama's
 * commentary on the Saundarya-lahari): a vertical diameter of 48 units,
 * nine horizontal lines at 6, 12, 17, 20, 23, 27, 30, 36, 42 from the top,
 * ends trimmed by 3, 5, 0, 16, 18, 16, 0, 4, 3 units, and each line's ends
 * joined to a fixed point on the axis. Lines 3 and 7 keep their ends on the
 * circle; their apexes are the circle's bottom and top.
 */
export const SRI_LINES = [6, 12, 17, 20, 23, 27, 30, 36, 42];
export const SRI_TRIM = [3, 5, 0, 16, 18, 16, 0, 4, 3];
/** Apex (units from top) joined to the ends of line i. */
export const SRI_APEX = [27, 42, 48, 36, 30, 12, 0, 6, 17];

function sriChakra(): YantraGeometry {
  const Rt = 3.4; // circle enclosing the triangles
  const k = Rt / 24;
  const P = (x: number, Y: number) => v(x * k, (24 - Y) * k);
  const paths: Path[] = [];
  SRI_LINES.forEach((Y, i) => {
    const half = Math.sqrt(24 * 24 - (Y - 24) * (Y - 24)) - SRI_TRIM[i];
    paths.push(polygon([P(-half, Y), P(half, Y), P(0, SRI_APEX[i])]));
  });
  paths.push(circle(v(0, 0), Rt));
  paths.push(...lotus(8, Rt, 4.55)); // ashta-dala
  paths.push(circle(v(0, 0), 4.65));
  paths.push(...lotus(16, 4.65, 5.65)); // shodasha-dala
  for (const r of [5.75, 6.0, 6.25]) paths.push(circle(v(0, 0), r)); // three circles
  paths.push(...bhupura(7.0, 0.3, 3, 1.0, 0.38, 0.45, 0.38));
  const bindu = circle(v(0, 0), 0.16);
  return { paths, fills: [], symmetricFills: [bindu] };
}

function shatkona(): YantraGeometry {
  const R = 5.4;
  const paths: Path[] = [
    ...bhupura(7.2, 0.32, 3, 1.1, 0.4, 0.5, 0.4),
    circle(v(0, 0), R),
    triangle(R, true),
    triangle(R, false),
  ];
  return { paths, fills: [], symmetricFills: [circle(v(0, 0), 0.22)] };
}

/** The Kubera kolam magic square (Wikipedia, "Kuberakolam"): sum 72. */
export const KUBERA_SQUARE = [
  [27, 20, 25],
  [22, 24, 26],
  [23, 28, 21],
];

function kubera(): YantraGeometry {
  const cell = 4;
  const h = 1.5 * cell;
  const paths: Path[] = [];
  for (let i = 0; i <= 3; i++) {
    const p = -h + i * cell;
    paths.push(polygon([v(-h, p), v(h, p)], false));
    paths.push(polygon([v(p, -h), v(p, h)], false));
  }
  // Numerals written in Devanagari digits (२७ २० २५ …), on a common baseline.
  const fills: Path[] = [];
  const band = digitBand();
  KUBERA_SQUARE.forEach((row, r) =>
    row.forEach((n, c) => fills.push(...glyphText(devanagariNumeral(n), v((c - 1) * cell, (1 - r) * cell), 1.9, band))),
  );
  return { paths, fills, symmetricFills: [] };
}

export function buildYantra(name: YantraName): YantraGeometry {
  switch (name) {
    case 'ganapati':
      return ganapati();
    case 'sri-chakra':
      return sriChakra();
    case 'shatkona':
      return shatkona();
    case 'kubera':
      return kubera();
  }
}
