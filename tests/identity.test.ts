import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  fromSearchParams,
  fullId,
  generateKolam,
  normalizeConfig,
  parseShortId,
  shortId,
  toQueryString,
  toSearchParams,
} from '../src/engine';
import gallery from '../src/data/gallery.json';
import { SAMPLES, fingerprint } from './helpers';

describe('identity', () => {
  it('formats the short identity', () => {
    const c = normalizeConfig({ seed: 839172, family: 'sikku', symmetry: 'rotational', symmetryCount: 4, complexity: 7, arrangement: 'square' });
    expect(shortId(c)).toBe('KLM-839172-R4-7-S-1');
    expect(parseShortId('KLM-839172-R4-7-S-1')).toMatchObject({ seed: 839172, symmetry: 'rotational', symmetryCount: 4, complexity: 7, family: 'sikku', version: 1 });
  });

  it('full identity distinguishes every generation-affecting parameter', () => {
    const base = normalizeConfig({ seed: 5, family: 'kambi', symmetry: 'four-way', symmetryCount: 2, complexity: 5, arrangement: 'square' });
    const variants = [
      base,
      normalizeConfig({ ...base, arrangement: 'diamond' }),
      normalizeConfig({ ...base, grid: { w: 11, h: 11 } }),
      normalizeConfig({ ...base, density: 'dense' }),
      normalizeConfig({ ...base, curvature: 2 }),
      normalizeConfig({ ...base, ornamentation: 9 }),
      normalizeConfig({ ...base, render: 'clean' }),
    ];
    expect(new Set(variants.map(shortId)).size).toBe(1);
    expect(new Set(variants.map(fullId)).size).toBe(variants.length);
  });
});

describe('canonical URL', () => {
  it.each(SAMPLES.map((s, i) => [i, s]))('round-trips sample %i and reproduces the same design', (_, cfg) => {
    const c = normalizeConfig(cfg);
    const back = fromSearchParams(new URLSearchParams(toQueryString(c)));
    expect(back).toEqual(c);
    expect(fingerprint(back)).toBe(fingerprint(c));
  });

  it('contains the complete configuration', () => {
    const c = normalizeConfig(SAMPLES[0]);
    const keys = [...toSearchParams(c).keys()].sort();
    expect(keys).toEqual(['arr', 'curve', 'dens', 'grid', 'id', 'orn', 'render']);
  });

  it('refuses malformed or unsupported identities', () => {
    expect(() => fromSearchParams(new URLSearchParams('id=nonsense'))).toThrow(ConfigError);
    expect(() => fromSearchParams(new URLSearchParams('id=KLM-000001-D4-5-S-1&arr=square'))).toThrow(ConfigError);
    expect(() => fromSearchParams(new URLSearchParams('id=KLM-000001-R4-5-S-9'))).toThrow(ConfigError);
  });
});

describe('gallery', () => {
  it('stores configurations whose identities are current and valid', () => {
    for (const e of gallery as { id: string; title: string; config: Parameters<typeof normalizeConfig>[0] }[]) {
      const c = normalizeConfig(e.config);
      expect(fullId(c), e.title).toBe(e.id);
      expect(generateKolam(c).validation.ok).toBe(true);
    }
  });
});
