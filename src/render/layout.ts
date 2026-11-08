/**
 * Scale relationships between dots, strokes and lattice spacing.
 *
 * Everything is expressed in design units (lattice spacing = 1). Because the
 * SVG is then fitted to the viewport, the on-screen stroke thickness follows
 * automatically from the canvas size and the pattern's extent: a 3 × 3 kolam
 * gets bold finger-width lines, a 15 × 15 one gets fine, cloth-like lines.
 *
 *   stroke  = unit · ratio(family, complexity), capped so neighbouring
 *             strands keep a clear gap of at least ~0.6 stroke widths
 *   dot     = diameter 1.45 × stroke — dots read as the same powder mark as
 *             the lines, a little heavier. In pulli the dots are the joints
 *             every stroke meets at, so they are drawn at 2.3 × to stay legible
 *   margin  = 0.55 unit around the drawing, so the artwork nearly fills the
 *             frame
 */

import type { KolamDesign, Bounds } from '../engine';

export interface Layout {
  strokeWidth: number;
  dotRadius: number;
  viewBox: Bounds;
}

export function strokeRatio(design: KolamDesign): number {
  const c = design.config.complexity;
  if (design.config.family === 'yantra') return 0.085; // fine, even lines for a drawn diagram
  const base = design.config.family === 'pulli' ? 0.1 : 0.135;
  // Larger designs are viewed with smaller cells; thin the line slightly so
  // the weave stays legible, without losing the finger-drawn weight.
  return base * (1.08 - 0.02 * c);
}

export function computeLayout(design: KolamDesign): Layout {
  const unit = design.unit;
  let sw = unit * strokeRatio(design);
  if (Number.isFinite(design.strandGap)) sw = Math.min(sw, design.strandGap * 0.62);
  const dotRadius = (sw * (design.config.family === 'pulli' ? 2.3 : 1.45)) / 2;
  const b = design.bounds;
  const pad = sw * 0.5 + unit * 0.12;
  return {
    strokeWidth: sw,
    dotRadius,
    viewBox: { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad },
  };
}
