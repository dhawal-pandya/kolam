/**
 * Clean ("mathematical") renderer: exact geometry, uniform stroke.
 * Produces plain data (path strings, circles) so both React and the
 * string exporter can draw it.
 */

import type { KolamDesign } from '../engine';
import type { Path } from '../engine/geometry/bezier';
import { computeLayout, Layout } from './layout';

const f = (x: number) => {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

/** SVG path data. Design space is y-up; SVG is y-down, so y is negated. */
export function pathData(p: Path): string {
  if (p.segs.length === 0) return '';
  const s0 = p.segs[0][0];
  let d = `M${f(s0.x)} ${f(-s0.y)}`;
  for (const c of p.segs) d += `C${f(c[1].x)} ${f(-c[1].y)} ${f(c[2].x)} ${f(-c[2].y)} ${f(c[3].x)} ${f(-c[3].y)}`;
  if (p.closed) d += 'Z';
  return d;
}

export interface SceneData {
  layout: Layout;
  /** viewBox string in SVG (y-down) space */
  viewBox: string;
  width: number;
  height: number;
  minX: number;
  minY: number;
  paths: string[];
  /** Filled powder shapes (yantra bija, numerals, bindu). */
  fills: string[];
  dots: { cx: number; cy: number }[];
}

export function sceneData(design: KolamDesign): SceneData {
  const layout = computeLayout(design);
  const vb = layout.viewBox;
  const minX = vb.minX;
  const minY = -vb.maxY;
  const width = vb.maxX - vb.minX;
  const height = vb.maxY - vb.minY;
  return {
    layout,
    viewBox: `${f(minX)} ${f(minY)} ${f(width)} ${f(height)}`,
    width,
    height,
    minX,
    minY,
    paths: design.paths.map(pathData),
    fills: design.fills.map(pathData),
    dots: design.dots.map((d) => ({ cx: d.x, cy: -d.y })),
  };
}

export const POWDER = '#f6f1e7';

/** Standalone clean SVG document (for export and visual test sheets). */
export function cleanSvgString(design: KolamDesign, opts: { size?: number; background?: string } = {}): string {
  const s = sceneData(design);
  const size = opts.size ?? 800;
  const bg = opts.background ? `<rect x="${f(s.minX)}" y="${f(s.minY)}" width="${f(s.width)}" height="${f(s.height)}" fill="${opts.background}"/>` : '';
  const sw = f(s.layout.strokeWidth);
  const paths = s.paths.map((d) => `<path d="${d}"/>`).join('');
  const dots = s.dots.map((d) => `<circle cx="${f(d.cx)}" cy="${f(d.cy)}" r="${f(s.layout.dotRadius)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${s.viewBox}" width="${size}" height="${Math.round((size * s.height) / s.width)}">${bg}<g fill="none" stroke="${POWDER}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><g fill="${POWDER}">${dots}</g></svg>`;
}
