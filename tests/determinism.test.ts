import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { generateKolam, normalizeConfig, ConfigError } from '../src/engine';
import { Rng, rootRng } from '../src/engine/rng';
import { renderSvg } from '../src/render/organic';
import { sceneData } from '../src/render/svg';
import { SAMPLES, fingerprint } from './helpers';

describe('seeded PRNG', () => {
  it('produces a frozen Mulberry32 sequence', () => {
    const r = new Rng(12345);
    expect([r.nextU32(), r.nextU32(), r.nextU32()]).toEqual([4207900869, 1317490944, 2079646450]);
  });
  it('named forks are independent of call order', () => {
    const a = rootRng(1, 1);
    const b = rootRng(1, 1);
    b.next();
    b.next();
    expect(a.fork('x').next()).toBe(b.fork('x').next());
  });
});

describe('determinism', () => {
  it.each(SAMPLES.map((s) => [`${s.family} ${s.arrangement} ${s.symmetry}${s.symmetryCount}`, s]))(
    'same config gives identical geometry: %s',
    (_, cfg) => {
      expect(fingerprint(cfg)).toBe(fingerprint(cfg));
    },
  );

  it('different seeds give different designs for every family', () => {
    for (const family of ['pulli', 'kambi', 'sikku'] as const) {
      const base = { family, symmetry: 'rotational' as const, symmetryCount: 4, arrangement: 'square' as const, complexity: 6 };
      const prints = new Set([1, 2, 3, 4, 5].map((seed) => fingerprint({ ...base, seed })));
      expect(prints.size, family).toBeGreaterThanOrEqual(4);
    }
  });

  it('organic rendering is deterministic and shares geometry with clean rendering', () => {
    const d1 = generateKolam({ ...SAMPLES[0], render: 'organic' });
    const d2 = generateKolam({ ...SAMPLES[0], render: 'organic' });
    expect(renderSvg(d1)).toBe(renderSvg(d2));
    const clean = generateKolam({ ...SAMPLES[0], render: 'clean' });
    expect(sceneData(clean).paths).toEqual(sceneData(d1).paths);
    // every clean path appears verbatim in the organic document
    const organic = renderSvg(d1);
    for (const p of sceneData(clean).paths) expect(organic.includes(`d="${p}"`)).toBe(true);
  });

  it('never uses Math.random in engine or renderers', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const files = [...walk('src/engine'), ...walk('src/render')];
    // Strip comments (which document the rule) before looking for calls.
    const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const f of files) expect(code(f), f).not.toMatch(/Math\.random/);
  });
});

describe('generator versioning', () => {
  /**
   * Golden fingerprints for generator version 1. If any of these change, the
   * appearance of existing version-1 designs changed: implement the change as
   * a new generator version instead.
   */
  const GOLDEN: Record<number, string> = JSON.parse(readFileSync(path.join(__dirname, 'golden-v1.json'), 'utf8'));
  it.each(SAMPLES.map((s, i) => [i, s]))('sample %i matches its v1 fingerprint', (i, cfg) => {
    expect(fingerprint(cfg)).toBe(GOLDEN[i]);
  });

  it('rejects unknown generator versions instead of guessing', () => {
    expect(() => normalizeConfig({ version: 2 as never })).toThrow(ConfigError);
  });
});
