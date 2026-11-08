import { describe, expect, it } from 'vitest';
import { fromSearchParams, fullId, generateKolam, normalizeConfig, shortId, toQueryString, YANTRAS } from '../src/engine';
import { KUBERA_SQUARE, SRI_APEX, SRI_LINES, SRI_TRIM } from '../src/engine/yantra/yantras';
import { renderSvg } from '../src/render/organic';
import { fingerprint } from './helpers';

describe('named yantras', () => {
  it.each(YANTRAS)('%s is valid, exactly symmetric and identified', (name) => {
    const d = generateKolam({ family: 'yantra', yantra: name, seed: 1 });
    expect(d.validation.ok, d.validation.errors.join()).toBe(true);
    expect(d.id).toMatch(/^KLM-000001-[A-Z]{1,2}\d?-5-Y[A-Z]-1$/);
  });

  it('geometry is canonical: the seed changes only the organic texture', () => {
    for (const yantra of YANTRAS) {
      expect(fingerprint({ family: 'yantra', yantra, seed: 1 })).toBe(fingerprint({ family: 'yantra', yantra, seed: 999 }));
      const a = renderSvg(generateKolam({ family: 'yantra', yantra, seed: 1, render: 'organic' }));
      const b = renderSvg(generateKolam({ family: 'yantra', yantra, seed: 2, render: 'organic' }));
      expect(a).not.toBe(b);
    }
  });

  it('every yantra has a distinct identity and round-trips through its URL', () => {
    const ids = new Set<string>();
    for (const yantra of YANTRAS) {
      const c = normalizeConfig({ family: 'yantra', yantra, seed: 108 });
      ids.add(shortId(c));
      const back = fromSearchParams(new URLSearchParams(toQueryString(c)));
      expect(back).toEqual(c);
      expect(fullId(back)).toBe(fullId(c));
    }
    expect(ids.size).toBe(YANTRAS.length);
  });

  it('Sri Chakra follows the classical 48-unit construction: 5 downward, 4 upward triangles', () => {
    expect(SRI_LINES).toEqual([6, 12, 17, 20, 23, 27, 30, 36, 42]);
    expect(SRI_TRIM).toEqual([3, 5, 0, 16, 18, 16, 0, 4, 3]);
    const down = SRI_LINES.filter((y, i) => SRI_APEX[i] > y).length;
    const up = SRI_LINES.filter((y, i) => SRI_APEX[i] < y).length;
    expect([down, up]).toEqual([5, 4]);
    // Untrimmed lines end on the circle; apexes 0 and 48 lie on the circle.
    expect(SRI_TRIM[2]).toBe(0);
    expect(SRI_TRIM[6]).toBe(0);
    expect(SRI_APEX[2]).toBe(48);
    expect(SRI_APEX[6]).toBe(0);
  });

  it('the Kubera square is magic with sum 72 over 20…28', () => {
    const rows = KUBERA_SQUARE.map((r) => r.reduce((a, b) => a + b));
    const cols = [0, 1, 2].map((c) => KUBERA_SQUARE.reduce((a, r) => a + r[c], 0));
    const diag = [0, 1, 2].reduce((a, i) => a + KUBERA_SQUARE[i][i], 0);
    const anti = [0, 1, 2].reduce((a, i) => a + KUBERA_SQUARE[i][2 - i], 0);
    expect(new Set([...rows, ...cols, diag, anti])).toEqual(new Set([72]));
    expect(KUBERA_SQUARE.flat().sort()).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28]);
  });

  it('inscribes the bija only in the Ganapati yantra, and numerals in the Kubera kolam', () => {
    expect(generateKolam({ family: 'yantra', yantra: 'ganapati' }).fills.length).toBeGreaterThan(0);
    expect(generateKolam({ family: 'yantra', yantra: 'kubera' }).fills.length).toBeGreaterThan(9);
    // Sri Chakra and Shatkona carry only the bindu.
    expect(generateKolam({ family: 'yantra', yantra: 'sri-chakra' }).fills.length).toBe(1);
    expect(generateKolam({ family: 'yantra', yantra: 'shatkona' }).fills.length).toBe(1);
  });

  it('rejects unknown yantras', () => {
    expect(() => normalizeConfig({ family: 'yantra', yantra: 'nonsense' as never })).toThrow();
    expect(() => fromSearchParams(new URLSearchParams('id=KLM-000001-BV-5-YZ-1'))).toThrow();
  });
});
