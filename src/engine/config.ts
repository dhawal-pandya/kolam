/**
 * Configuration schema (generator version 1).
 *
 * A `KolamConfig` is the complete, serialisable description of a design.
 * Same config + same generator version ⇒ identical geometry and rendering.
 * Every field that affects output lives here; nothing is read from the
 * environment, the clock or the viewport.
 */

import { YANTRAS, YANTRA_INFO, YantraName } from './yantra/yantras';

export const GENERATOR_VERSION = 1 as const;
export const SUPPORTED_VERSIONS = [1] as const;
export type GeneratorVersion = (typeof SUPPORTED_VERSIONS)[number];

/** Kolam families are generated; 'yantra' draws named canonical forms. */
export type Family = 'pulli' | 'kambi' | 'sikku' | 'yantra';
export type { YantraName };
export type SymmetryType = 'bilateral-h' | 'bilateral-v' | 'four-way' | 'rotational' | 'dihedral';
export type Arrangement = 'square' | 'rectangle' | 'diamond' | 'hexagonal' | 'radial';
export type RenderStyle = 'clean' | 'organic';
export type Density = 'sparse' | 'standard' | 'dense';

export interface GridSpec {
  /** Columns (square/rectangle) or radius / ring count (diamond, hexagonal, radial). */
  w: number;
  /** Rows (square/rectangle). Equal to `w` for radius-based arrangements. */
  h: number;
}

export interface KolamConfig {
  version: GeneratorVersion;
  /** 0 … 999 999 */
  seed: number;
  family: Family;
  symmetry: SymmetryType;
  /** 1 for bilateral, 2 for four-way, n for rotational / dihedral. */
  symmetryCount: number;
  /** 1 … 9 */
  complexity: number;
  arrangement: Arrangement;
  grid: GridSpec;
  density: Density;
  /** 0 … 10: how round the turns are. */
  curvature: number;
  /** 0 … 10: how many optional motifs are added on top of the required structure. */
  ornamentation: number;
  render: RenderStyle;
  /** Which named yantra (family 'yantra' only). */
  yantra?: YantraName;
}

/** The generated (seed-driven) kolam families. */
export const FAMILIES: Family[] = ['pulli', 'kambi', 'sikku'];
export const ALL_FAMILIES: Family[] = [...FAMILIES, 'yantra'];
export { YANTRAS, YANTRA_INFO };
export const ARRANGEMENTS: Arrangement[] = ['square', 'rectangle', 'diamond', 'hexagonal', 'radial'];
export const DENSITIES: Density[] = ['sparse', 'standard', 'dense'];
export const RENDER_STYLES: RenderStyle[] = ['clean', 'organic'];
export const RADIAL_COUNTS = [6, 8, 10, 12, 16];

export const FAMILY_LABEL: Record<Family, string> = { pulli: 'Pulli', kambi: 'Kambi', sikku: 'Sikku', yantra: 'Yantra' };
export const ARRANGEMENT_LABEL: Record<Arrangement, string> = {
  square: 'Square grid',
  rectangle: 'Rectangular grid',
  diamond: 'Diamond (1-3-5-3-1)',
  hexagonal: 'Hexagonal (triangular lattice)',
  radial: 'Concentric rings',
};
export const SYMMETRY_LABEL: Record<SymmetryType, string> = {
  'bilateral-h': 'Bilateral horizontal',
  'bilateral-v': 'Bilateral vertical',
  'four-way': 'Four-way',
  rotational: 'Rotational',
  dihedral: 'Dihedral',
};
export const COMPLEXITY_TIERS = [
  { label: 'Simple', value: 2 },
  { label: 'Moderate', value: 4 },
  { label: 'Intricate', value: 6 },
  { label: 'Very intricate', value: 8 },
];
export function complexityLabel(c: number): string {
  if (c <= 2) return 'Simple';
  if (c <= 4) return 'Moderate';
  if (c <= 6) return 'Intricate';
  return 'Very intricate';
}

export interface SymmetryOption {
  type: SymmetryType;
  count: number;
}

/**
 * Which symmetry groups each dot arrangement admits. These are exactly the
 * isometries that map the dot set onto itself (verified at generation time),
 * so e.g. a square lattice can never carry 6- or 8-fold rotation
 * (crystallographic restriction) and a non-square rectangle never 4-fold.
 */
export function symmetriesFor(arr: Arrangement): SymmetryOption[] {
  const bil: SymmetryOption[] = [
    { type: 'bilateral-h', count: 1 },
    { type: 'bilateral-v', count: 1 },
    { type: 'four-way', count: 2 },
    { type: 'rotational', count: 2 },
  ];
  switch (arr) {
    case 'square':
    case 'diamond':
      return [...bil, { type: 'rotational', count: 4 }, { type: 'dihedral', count: 4 }];
    case 'rectangle':
      return bil;
    case 'hexagonal':
      return [
        ...bil,
        { type: 'rotational', count: 3 },
        { type: 'rotational', count: 6 },
        { type: 'dihedral', count: 3 },
        { type: 'dihedral', count: 6 },
      ];
    case 'radial':
      return RADIAL_COUNTS.flatMap((n) => [
        { type: 'rotational' as const, count: n },
        { type: 'dihedral' as const, count: n },
      ]);
  }
}

/** Which arrangements each family is constructed on. */
export function arrangementsFor(family: Family): Arrangement[] {
  switch (family) {
    case 'pulli':
      return ['square', 'rectangle', 'diamond', 'hexagonal', 'radial'];
    case 'kambi':
      return ['square', 'rectangle', 'diamond', 'hexagonal', 'radial'];
    case 'sikku':
      return ['square', 'rectangle', 'diamond', 'hexagonal'];
    case 'yantra':
      return []; // not built on a dot arrangement
  }
}

/**
 * Symmetries a family can carry on an arrangement.
 *
 * Sikku excludes every mirror line that passes *through* dots between lattice
 * directions (the square lattice's diagonal mirrors, the hexagonal lattice's
 * mirrors perpendicular to its rows). Such a mirror bisects the corner of
 * each dot it passes through, so the line must cross the mirror at right
 * angles twice per dot — 2n fixed points — but one closed curve has at most
 * two points fixed by a reflection. A dihedral sikku on n × n dots would need
 * at least n separate lines, which breaks the continuous-line rule. (Proof in
 * docs/CONSTRUCTION.md.)
 */
export function familySymmetries(family: Family, arr: Arrangement): SymmetryOption[] {
  if (family === 'yantra') return [];
  const all = symmetriesFor(arr);
  if (family !== 'sikku') return all;
  return all.filter((o) => {
    if (arr === 'square' || arr === 'diamond') return o.type !== 'dihedral';
    if (arr === 'hexagonal') return o.type !== 'bilateral-v' && o.type !== 'four-way' && !(o.type === 'dihedral' && o.count === 6);
    return true;
  });
}

export function isSupported(family: Family, arr: Arrangement, sym: SymmetryType, count: number): boolean {
  if (!arrangementsFor(family).includes(arr)) return false;
  return familySymmetries(family, arr).some((o) => o.type === sym && o.count === count);
}

/** Valid grid size range per arrangement (dot-count limits). */
export function gridLimits(arr: Arrangement): { min: number; max: number } {
  switch (arr) {
    case 'square':
    case 'rectangle':
      return { min: 3, max: 17 };
    case 'diamond':
      return { min: 1, max: 10 };
    case 'hexagonal':
      return { min: 1, max: 8 };
    case 'radial':
      return { min: 1, max: 7 };
  }
}

/**
 * Grid size implied by complexity and density. Complexity 9 on a square grid
 * is the traditional 15 × 15 (225-dot) "woven cloth" scale.
 */
export function autoGrid(arr: Arrangement, complexity: number, density: Density): GridSpec {
  const shift = density === 'sparse' ? -1 : density === 'dense' ? 1 : 0;
  const tier = Math.max(0, Math.min(9, complexity - 1 + shift));
  switch (arr) {
    case 'square': {
      const n = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17][tier];
      return { w: n, h: n };
    }
    case 'rectangle': {
      const w = [4, 5, 6, 7, 9, 11, 13, 15, 17, 17][tier];
      const h = Math.max(3, Math.round(w * 0.62));
      return { w, h };
    }
    case 'diamond': {
      const r = [1, 2, 3, 3, 4, 5, 6, 7, 9, 10][tier];
      return { w: r, h: r };
    }
    case 'hexagonal': {
      const r = [1, 2, 2, 3, 3, 4, 5, 6, 7, 8][tier];
      return { w: r, h: r };
    }
    case 'radial': {
      const r = [1, 1, 2, 2, 3, 3, 4, 5, 6, 7][tier];
      return { w: r, h: r };
    }
  }
}

export const DEFAULT_CONFIG: KolamConfig = {
  version: GENERATOR_VERSION,
  seed: 108,
  family: 'sikku',
  symmetry: 'dihedral',
  symmetryCount: 4,
  complexity: 5,
  arrangement: 'square',
  grid: autoGrid('square', 5, 'standard'),
  density: 'standard',
  curvature: 5,
  ornamentation: 5,
  render: 'organic',
};

const clampInt = (x: unknown, lo: number, hi: number, dflt: number): number => {
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};

export class ConfigError extends Error {}

/**
 * Coerce an untrusted partial config into a valid one. Unsupported
 * combinations are corrected to the closest valid alternative rather than
 * generating something the construction rules do not allow.
 */
export function normalizeConfig(input: Partial<KolamConfig>): KolamConfig {
  const version = (input.version ?? GENERATOR_VERSION) as GeneratorVersion;
  if (!SUPPORTED_VERSIONS.includes(version)) throw new ConfigError(`Unsupported generator version ${input.version}`);
  const family: Family = ALL_FAMILIES.includes(input.family as Family) ? (input.family as Family) : DEFAULT_CONFIG.family;
  if (family === 'yantra') return normalizeYantra(input, version);
  const complexity = clampInt(input.complexity, 1, 9, DEFAULT_CONFIG.complexity);
  const density: Density = DENSITIES.includes(input.density as Density) ? (input.density as Density) : 'standard';

  let arrangement: Arrangement = ARRANGEMENTS.includes(input.arrangement as Arrangement)
    ? (input.arrangement as Arrangement)
    : DEFAULT_CONFIG.arrangement;
  let symmetry = (input.symmetry ?? DEFAULT_CONFIG.symmetry) as SymmetryType;
  let symmetryCount = clampInt(input.symmetryCount, 1, 16, 4);
  if (symmetry === 'bilateral-h' || symmetry === 'bilateral-v') symmetryCount = 1;
  if (symmetry === 'four-way') symmetryCount = 2;

  if (!arrangementsFor(family).includes(arrangement)) arrangement = arrangementsFor(family)[0];
  if (!isSupported(family, arrangement, symmetry, symmetryCount)) {
    // Prefer keeping the symmetry and finding an arrangement that carries it.
    const alt = arrangementsFor(family).find((a) => isSupported(family, a, symmetry, symmetryCount));
    if (alt) arrangement = alt;
    else {
      const opts = familySymmetries(family, arrangement);
      const best = opts.find((o) => o.type === symmetry) ?? opts[opts.length - 1];
      symmetry = best.type;
      symmetryCount = best.count;
    }
  }

  const lim = gridLimits(arrangement);
  const auto = autoGrid(arrangement, complexity, density);
  let w = clampInt(input.grid?.w, lim.min, lim.max, auto.w);
  let h = clampInt(input.grid?.h, lim.min, lim.max, auto.h);
  if (arrangement === 'square' || arrangement === 'diamond' || arrangement === 'hexagonal' || arrangement === 'radial') h = w;
  if (arrangement === 'rectangle' && w === h) w = Math.min(lim.max, w + 1);
  // A single-line sikku with a half-turn symmetry is impossible when both
  // grid dimensions are even (exhaustively verified; see docs): the centre
  // is then a cell, and the line splits into two congruent halves.
  const halfTurn = symmetry === 'four-way' || (symmetry === 'rotational' && symmetryCount % 2 === 0);
  if (family === 'sikku' && halfTurn && (arrangement === 'square' || arrangement === 'rectangle') && w % 2 === 0 && h % 2 === 0) {
    w = w + 1 <= lim.max ? w + 1 : w - 1;
    if (arrangement === 'square') h = w;
  }
  // A square-ish symmetry needs a square dot set; a rectangle offering
  // only bilateral/four-way symmetry is already enforced above.

  return {
    version,
    seed: clampInt(input.seed, 0, 999999, DEFAULT_CONFIG.seed),
    family,
    symmetry,
    symmetryCount,
    complexity,
    arrangement,
    grid: { w, h },
    density,
    curvature: clampInt(input.curvature, 0, 10, 5),
    ornamentation: clampInt(input.ornamentation, 0, 10, 5),
    render: RENDER_STYLES.includes(input.render as RenderStyle) ? (input.render as RenderStyle) : 'organic',
  };
}

/**
 * A named yantra has one canonical form: its symmetry is that of the form,
 * and the kolam-only fields are fixed to canonical placeholder values so the
 * identity of each yantra is unique. The seed varies only the powder texture.
 */
function normalizeYantra(input: Partial<KolamConfig>, version: GeneratorVersion): KolamConfig {
  if (!YANTRAS.includes(input.yantra as YantraName)) throw new ConfigError(`Unknown yantra "${input.yantra}"`);
  const yantra = input.yantra as YantraName;
  const info = YANTRA_INFO[yantra];
  return {
    version,
    seed: clampInt(input.seed, 0, 999999, DEFAULT_CONFIG.seed),
    family: 'yantra',
    yantra,
    symmetry: info.symmetry,
    symmetryCount: info.count,
    complexity: 5,
    arrangement: 'square',
    grid: { w: 3, h: 3 },
    density: 'standard',
    curvature: 5,
    ornamentation: 5,
    render: RENDER_STYLES.includes(input.render as RenderStyle) ? (input.render as RenderStyle) : 'organic',
  };
}

/** Fields that change geometry (render style deliberately excluded). */
export function geometryKey(c: KolamConfig): string {
  return [
    c.version,
    c.seed,
    c.family,
    c.symmetry,
    c.symmetryCount,
    c.complexity,
    c.arrangement,
    `${c.grid.w}x${c.grid.h}`,
    c.density,
    c.curvature,
    c.ornamentation,
    c.yantra ?? '',
  ].join('|');
}
