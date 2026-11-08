/**
 * Organic ("rice flour") renderer.
 *
 * Draws exactly the same paths as the clean renderer; only presentation
 * differs. All irregularity is deterministic, derived from the design seed:
 *
 *   edge roughness   feTurbulence (seeded) → feDisplacementMap, amplitude a
 *                    fraction of the stroke width, so the line keeps its
 *                    centreline and never drifts off the construction
 *   powder grain     high-frequency fractal noise multiplied into alpha
 *   density drift    low-frequency noise: the flour thins and thickens
 *                    slightly along a stroke, as when poured from fingers
 *   dispersion       a sparse scatter of tiny flour particles beside the
 *                    strokes, positioned by the seeded PRNG
 *   halo             a faint, wide underlay of dust
 *
 * Noise frequencies are expressed in design units (primitiveUnits =
 * userSpaceOnUse), so the texture is attached to the drawing and stays
 * consistent under zoom.
 */

import type { KolamDesign } from '../engine';
import { samplePathEvenly } from '../engine/geometry/bezier';
import { rootRng } from '../engine/rng';
import { POWDER, SceneData, sceneData } from './svg';

export interface Particle {
  cx: number;
  cy: number;
  r: number;
  o: number;
}

export interface OrganicData {
  edgeSeed: number;
  grainSeed: number;
  driftSeed: number;
  edgeFreq: number;
  edgeScale: number;
  grainFreq: number;
  driftFreq: number;
  particles: Particle[];
}

export function organicData(design: KolamDesign, scene: SceneData): OrganicData {
  const rng = rootRng(design.config.seed, design.config.version).fork(`organic|${design.fullId}`);
  const sw = scene.layout.strokeWidth;
  const particles: Particle[] = [];
  const pr = rng.fork('particles');
  const step = sw * 0.55;
  for (const path of design.paths) {
    for (const s of samplePathEvenly(path, step)) {
      if (!pr.chance(0.42)) continue;
      const side = pr.chance(0.5) ? 1 : -1;
      const off = sw * (0.5 + Math.abs(pr.gauss()) * 0.32) * side;
      const along = (pr.next() - 0.5) * step;
      const nx = -s.t.y;
      const ny = s.t.x;
      particles.push({
        cx: s.p.x + nx * off + s.t.x * along,
        cy: -(s.p.y + ny * off + s.t.y * along),
        r: sw * pr.range(0.035, 0.11),
        o: pr.range(0.35, 0.85),
      });
    }
  }
  for (const d of design.dots) {
    const n = 5 + pr.int(0, 5);
    for (let i = 0; i < n; i++) {
      const t = pr.next() * Math.PI * 2;
      const rad = scene.layout.dotRadius * (1 + Math.abs(pr.gauss()) * 0.35);
      particles.push({ cx: d.x + Math.cos(t) * rad, cy: -(d.y + Math.sin(t) * rad), r: sw * pr.range(0.035, 0.09), o: pr.range(0.35, 0.8) });
    }
  }
  return {
    edgeSeed: rng.fork('edge').int(1, 9999),
    grainSeed: rng.fork('grain').int(1, 9999),
    driftSeed: rng.fork('drift').int(1, 9999),
    edgeFreq: 1 / (sw * 0.9),
    edgeScale: sw * 0.26,
    grainFreq: 1 / (sw * 0.075),
    driftFreq: 1 / (design.unit * 2.4),
    particles,
  };
}

const f = (x: number) => {
  const r = Math.round(x * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
};

/**
 * Complete SVG document for a design in either render style. Used by the
 * viewer (inserted as markup so zoom can update the viewBox without a React
 * re-render), by thumbnails and by future export.
 */
export function renderSvg(
  design: KolamDesign,
  opts: { style?: 'clean' | 'organic'; idPrefix?: string; className?: string; background?: string } = {},
): string {
  const style = opts.style ?? design.config.render;
  const scene = sceneData(design);
  const id = opts.idPrefix ?? 'k';
  const sw = scene.layout.strokeWidth;
  const r = scene.layout.dotRadius;
  const paths = scene.paths.map((d) => `<path d="${d}"/>`).join('');
  // Filled shapes (bija, numerals, bindu) use the even-odd rule so glyph
  // counters stay open.
  const dots =
    scene.dots.map((d) => `<circle cx="${f(d.cx)}" cy="${f(d.cy)}" r="${f(r)}"/>`).join('') +
    (scene.fills.length ? `<path fill-rule="evenodd" d="${scene.fills.join('')}"/>` : '');
  const cls = opts.className ? ` class="${opts.className}"` : '';
  const bg = opts.background
    ? `<rect x="${f(scene.minX)}" y="${f(scene.minY)}" width="${f(scene.width)}" height="${f(scene.height)}" fill="${opts.background}"/>`
    : '';
  const head = `<svg xmlns="http://www.w3.org/2000/svg"${cls} viewBox="${scene.viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kolam ${design.id}">`;

  if (style === 'clean') {
    return `${head}${bg}<g fill="none" stroke="${POWDER}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><g fill="${POWDER}">${dots}</g></svg>`;
  }

  const o = organicData(design, scene);
  // Filter region covers the whole drawing (plus slack for displacement).
  const pad = sw * 2;
  const region = `x="${f(scene.minX - pad)}" y="${f(scene.minY - pad)}" width="${f(scene.width + 2 * pad)}" height="${f(scene.height + 2 * pad)}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"`;
  const filter = `<filter id="${id}-powder" ${region} color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${f(o.edgeFreq)}" numOctaves="3" seed="${o.edgeSeed}" result="edgeNoise"/>
<feDisplacementMap in="SourceGraphic" in2="edgeNoise" scale="${f(o.edgeScale)}" xChannelSelector="R" yChannelSelector="G" result="rough"/>
<feTurbulence type="fractalNoise" baseFrequency="${f(o.grainFreq)}" numOctaves="3" seed="${o.grainSeed}" result="grain"/>
<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.62" result="grainAlpha"/>
<feTurbulence type="fractalNoise" baseFrequency="${f(o.driftFreq)}" numOctaves="2" seed="${o.driftSeed}" result="drift"/>
<feColorMatrix in="drift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.55 1.24" result="driftAlpha"/>
<feComposite in="rough" in2="grainAlpha" operator="in" result="grained"/>
<feComposite in="grained" in2="driftAlpha" operator="in"/>
</filter>
<filter id="${id}-dust" ${region}><feGaussianBlur stdDeviation="${f(sw * 0.35)}"/></filter>`;
  const particles = o.particles.map((p) => `<circle cx="${f(p.cx)}" cy="${f(p.cy)}" r="${f(p.r)}" opacity="${f(p.o)}"/>`).join('');
  return `${head}<defs>${filter}</defs>${bg}
<g fill="none" stroke="${POWDER}" stroke-width="${f(sw * 1.9)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.11" filter="url(#${id}-dust)">${paths}</g>
<g filter="url(#${id}-powder)"><g fill="none" stroke="${POWDER}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><g fill="${POWDER}">${dots}</g></g>
<g fill="${POWDER}">${particles}</g></svg>`;
}
