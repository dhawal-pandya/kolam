/**
 * Public entry point of the generation engine. Pure TypeScript: no React, no
 * DOM, no clock, no Math.random.
 *
 *   generateKolam(config) → KolamDesign
 *
 * Pipeline:
 *   config → dot arrangement (plane graph) → symmetry group realised as dot
 *   permutations → family strategy chooses one construction decision per
 *   orbit → geometry → construction-specific validation.
 */

import { KolamConfig, normalizeConfig } from './config';
import { Path } from './geometry/bezier';
import { Vec } from './geometry/vec';
import { buildArrangement } from './lattice/arrangements';
import { DotGraph } from './lattice/graph';
import { buildMedial, medialGeometry, traceLoops, EdgeState, CROSS, SPLIT, JOIN } from './medial';
import { generateSikku } from './families/sikku';
import { generateKambi } from './families/kambi';
import { generatePulli, linkPaths, PulliLink } from './families/pulli';
import { rootRng } from './rng';
import { GraphSymmetry, makeGroup, realise } from './symmetry';
import { ValidationReport, validateDesign } from './validate';
import { fullId, shortId } from './identity';
import { buildYantra } from './yantra/yantras';
import { validateYantra } from './validate';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface KolamDesign {
  config: KolamConfig;
  id: string;
  fullId: string;
  dots: Vec[];
  paths: Path[];
  /** Filled shapes drawn in powder: a yantra's bija, numerals or bindu. Empty for kolams. */
  fills: Path[];
  /** Lattice spacing in design units. */
  unit: number;
  /** Bounds of the dots and path control polygons. */
  bounds: Bounds;
  /** Smallest clear gap between strands (design units); renderers size strokes from it. */
  strandGap: number;
  stats: {
    family: KolamConfig['family'];
    dots: number;
    strokes: number;
    loops: number;
    crossings: number;
    attempts: number;
  };
  validation: ValidationReport;
}

export class GenerationError extends Error {}

function boundsOf(dots: Vec[], paths: Path[]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const addP = (p: Vec) => {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  };
  dots.forEach(addP);
  paths.forEach((p) => p.segs.forEach((s) => s.forEach(addP)));
  return b;
}

/** The region a design may occupy: the dots' hull grown by one lattice unit. */
function regionOf(graph: DotGraph): Bounds {
  const b = boundsOf(graph.dots, []);
  const m = graph.unit * 1.0;
  return { minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m };
}

export interface Construction {
  graph: DotGraph;
  sym: GraphSymmetry;
  states?: EdgeState[];
  links?: PulliLink[];
}

export interface GenerateOptions {
  /** Diagnostics only: return geometry even if validation fails. */
  skipValidationErrors?: boolean;
}

export function generateKolam(input: Partial<KolamConfig>, options: GenerateOptions = {}): KolamDesign {
  const config = normalizeConfig(input);
  if (config.family === 'yantra') return generateYantra(config, options);
  const graph = buildArrangement(config.arrangement, config.grid, config.symmetryCount);
  const sym = realise(graph, makeGroup(config.symmetry, config.symmetryCount));
  const rng = rootRng(config.seed, config.version).fork(`${config.family}|${config.arrangement}|${config.grid.w}x${config.grid.h}|${config.symmetry}${config.symmetryCount}|${config.complexity}|${config.density}|${config.ornamentation}`);
  const curvature = config.curvature / 10;

  let paths: Path[];
  let crossings: Vec[] = [];
  let loops = 0;
  let attempts = 0;
  let strokes = 0;

  if (config.family === 'pulli') {
    const res = generatePulli(graph, sym, rng.fork('pulli'), {
      complexity: config.complexity,
      ornamentation: config.ornamentation,
      curvature,
    });
    paths = res.links.flatMap((l) => linkPaths(graph, l));
    attempts = res.attempts;
    strokes = res.links.length;
  } else {
    const medial = buildMedial(graph);
    const res =
      config.family === 'sikku'
        ? generateSikku(graph, medial, sym, rng.fork('sikku'), config)
        : generateKambi(graph, medial, sym, rng.fork('kambi'), config);
    const traced = traceLoops(medial, res.states);
    const geo = medialGeometry(medial, res.states, traced, { curvature });
    paths = geo.paths;
    crossings = geo.crossings;
    loops = traced.length;
    attempts = res.attempts;
    strokes = traced.length;
  }

  const validation = validateDesign({
    family: config.family,
    paths,
    dots: graph.dots,
    unit: graph.unit,
    sym,
    crossings,
    region: regionOf(graph),
    loops,
  });
  if (!validation.ok && !options.skipValidationErrors) {
    throw new GenerationError(`${shortId(config)} failed validation: ${validation.errors.join('; ')}`);
  }

  return {
    config,
    id: shortId(config),
    fullId: fullId(config),
    dots: graph.dots,
    paths,
    fills: [],
    unit: graph.unit,
    bounds: boundsOf(graph.dots, paths),
    strandGap: validation.minStrandGap,
    stats: {
      family: config.family,
      dots: graph.dots.length,
      strokes,
      loops,
      crossings: crossings.length,
      attempts,
    },
    validation,
  };
}

/**
 * Named yantras: one canonical form each (see yantra/yantras.ts). The seed
 * plays no part in the geometry; it only seeds the organic powder texture.
 */
function generateYantra(config: KolamConfig, options: GenerateOptions): KolamDesign {
  const geo = buildYantra(config.yantra!);
  const group = makeGroup(config.symmetry, config.symmetryCount);
  const validation = validateYantra({ paths: geo.paths, symmetricFills: geo.symmetricFills, fills: geo.fills, group, unit: 1 });
  if (!validation.ok && !options.skipValidationErrors) {
    throw new GenerationError(`${shortId(config)} failed validation: ${validation.errors.join('; ')}`);
  }
  const fills = [...geo.symmetricFills, ...geo.fills];
  return {
    config,
    id: shortId(config),
    fullId: fullId(config),
    dots: [],
    paths: geo.paths,
    fills,
    unit: 1,
    bounds: boundsOf([], [...geo.paths, ...fills]),
    strandGap: Infinity,
    stats: { family: 'yantra', dots: 0, strokes: geo.paths.length, loops: 0, crossings: 0, attempts: 1 },
    validation,
  };
}

export { CROSS, SPLIT, JOIN };
export * from './config';
export * from './identity';
