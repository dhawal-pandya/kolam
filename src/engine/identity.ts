/**
 * Deterministic identity and canonical URL encoding.
 *
 * Short identity:  KLM-<seed:6>-<symmetry>-<complexity>-<family>-<version>
 *   symmetry codes: BH bilateral (horizontal mirror line), BV bilateral
 *                   (vertical mirror line), FW four-way, R<n> rotational,
 *                   D<n> dihedral
 *   family codes:   P pulli, K kambi, S sikku; named yantras Y + form:
 *                   YG Ganapati, YS Sri Chakra, YH Shatkona, YK Kubera kolam
 *   e.g. KLM-839172-D4-7-S-1, KLM-000108-BV-5-YS-1
 *
 * Full identity:   <short>.<hash>  where <hash> is 4 base-36 characters of a
 *   32-bit hash over every geometry- and render-affecting field, so two
 *   designs that differ only in grid or arrangement never share an identity.
 *
 * Canonical URL (query string on the gallery root, so a static host needs no
 * rewrite rules):
 *   /?id=KLM-839172-D4-7-S-1&arr=square&grid=15x15&dens=standard&curve=5&orn=5&render=organic
 */

import { YANTRAS, YANTRA_INFO } from './yantra/yantras';
import {
  Arrangement,
  ConfigError,
  Density,
  Family,
  KolamConfig,
  RenderStyle,
  SymmetryType,
  normalizeConfig,
} from './config';
import { hashString } from './rng';

const FAMILY_CODE: Record<Exclude<Family, 'yantra'>, string> = { pulli: 'P', kambi: 'K', sikku: 'S' };
const CODE_FAMILY: Record<string, Family> = { P: 'pulli', K: 'kambi', S: 'sikku' };

function familyCode(c: KolamConfig): string {
  if (c.family === 'yantra') return `Y${YANTRA_INFO[c.yantra!].code}`;
  return FAMILY_CODE[c.family];
}

export function symmetryCode(type: SymmetryType, count: number): string {
  switch (type) {
    case 'bilateral-h':
      return 'BH';
    case 'bilateral-v':
      return 'BV';
    case 'four-way':
      return 'FW';
    case 'rotational':
      return `R${count}`;
    case 'dihedral':
      return `D${count}`;
  }
}

function parseSymmetryCode(code: string): { type: SymmetryType; count: number } {
  if (code === 'BH') return { type: 'bilateral-h', count: 1 };
  if (code === 'BV') return { type: 'bilateral-v', count: 1 };
  if (code === 'FW') return { type: 'four-way', count: 2 };
  const m = /^([RD])(\d{1,2})$/.exec(code);
  if (!m) throw new ConfigError(`Unknown symmetry code "${code}"`);
  return { type: m[1] === 'R' ? 'rotational' : 'dihedral', count: Number(m[2]) };
}

export function shortId(c: KolamConfig): string {
  return [
    'KLM',
    String(c.seed).padStart(6, '0'),
    symmetryCode(c.symmetry, c.symmetryCount),
    c.complexity,
    familyCode(c),
    c.version,
  ].join('-');
}

/** Canonical, order-fixed serialisation of every field. */
export function canonicalString(c: KolamConfig): string {
  const base = `${shortId(c)}|${c.arrangement}|${c.grid.w}x${c.grid.h}|${c.density}|${c.curvature}|${c.ornamentation}|${c.render}`;
  return c.family === 'yantra' ? `${base}|${c.yantra}` : base;
}

export function configHash(c: KolamConfig): string {
  return (hashString(canonicalString(c)) % 1679616).toString(36).toUpperCase().padStart(4, '0');
}

export function fullId(c: KolamConfig): string {
  return `${shortId(c)}.${configHash(c)}`;
}

export function parseShortId(id: string): Pick<KolamConfig, 'seed' | 'symmetry' | 'symmetryCount' | 'complexity' | 'family' | 'version' | 'yantra'> {
  const clean = id.trim().toUpperCase().split('.')[0];
  const m = /^KLM-(\d{1,6})-([A-Z]{1,2}\d{0,2})-(\d)-([PKS]|Y[A-Z])-(\d+)$/.exec(clean);
  if (!m) throw new ConfigError(`"${id}" is not a kolam identity`);
  const sym = parseSymmetryCode(m[2]);
  let family: Family;
  let yantra: KolamConfig['yantra'];
  if (m[4][0] === 'Y') {
    family = 'yantra';
    yantra = YANTRAS.find((y) => YANTRA_INFO[y].code === m[4][1]);
    if (!yantra) throw new ConfigError(`Unknown yantra code "${m[4]}"`);
  } else family = CODE_FAMILY[m[4]];
  return {
    seed: Number(m[1]),
    symmetry: sym.type,
    symmetryCount: sym.count,
    complexity: Number(m[3]),
    family,
    version: Number(m[5]) as KolamConfig['version'],
    ...(yantra ? { yantra } : {}),
  };
}

export function toSearchParams(c: KolamConfig): URLSearchParams {
  const p = new URLSearchParams();
  p.set('id', shortId(c));
  if (c.family === 'yantra') {
    // A named yantra is fully named by its identity; only rendering varies.
    p.set('render', c.render);
    return p;
  }
  p.set('arr', c.arrangement);
  p.set('grid', c.arrangement === 'rectangle' || c.arrangement === 'square' ? `${c.grid.w}x${c.grid.h}` : String(c.grid.w));
  p.set('dens', c.density);
  p.set('curve', String(c.curvature));
  p.set('orn', String(c.ornamentation));
  p.set('render', c.render);
  return p;
}

export function toQueryString(c: KolamConfig): string {
  return `?${toSearchParams(c).toString()}`;
}

/**
 * Rebuild a config from URL parameters. Throws `ConfigError` when the identity
 * is malformed; missing optional fields fall back to documented defaults.
 */
export function fromSearchParams(params: URLSearchParams): KolamConfig {
  const id = params.get('id');
  if (!id) throw new ConfigError('Missing kolam identity');
  const base = parseShortId(id);
  const gridRaw = params.get('grid');
  let grid: KolamConfig['grid'] | undefined;
  if (gridRaw) {
    const m = /^(\d{1,2})(?:x(\d{1,2}))?$/.exec(gridRaw);
    if (!m) throw new ConfigError(`Bad grid "${gridRaw}"`);
    grid = { w: Number(m[1]), h: Number(m[2] ?? m[1]) };
  }
  const cfg = normalizeConfig({
    ...base,
    arrangement: (params.get('arr') ?? undefined) as Arrangement | undefined,
    grid,
    density: (params.get('dens') ?? undefined) as Density | undefined,
    curvature: params.has('curve') ? Number(params.get('curve')) : undefined,
    ornamentation: params.has('orn') ? Number(params.get('orn')) : undefined,
    render: (params.get('render') ?? undefined) as RenderStyle | undefined,
  });
  // Refuse URLs whose identity would be silently rewritten by normalisation.
  if (shortId(cfg) !== shortId({ ...cfg, ...base })) {
    throw new ConfigError(`"${id}" names an unsupported combination`);
  }
  return cfg;
}
