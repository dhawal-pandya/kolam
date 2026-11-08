import { generateKolam, KolamConfig } from '../src/engine';
import { pathData } from '../src/render/svg';
import { hashString } from '../src/engine/rng';

/** Stable fingerprint of a design's complete geometry. */
export function fingerprint(cfg: Partial<KolamConfig>): string {
  const d = generateKolam(cfg);
  let body = d.paths.map(pathData).join('|') + '#' + d.dots.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).join(';');
  if (d.fills.length) body += '#' + d.fills.map(pathData).join('|');
  return hashString(body).toString(16).padStart(8, '0');
}

export const SAMPLES: Partial<KolamConfig>[] = [
  { family: 'sikku', symmetry: 'rotational', symmetryCount: 4, arrangement: 'square', complexity: 6, seed: 108 },
  { family: 'sikku', symmetry: 'bilateral-v', symmetryCount: 1, arrangement: 'square', complexity: 2, seed: 11 },
  { family: 'sikku', symmetry: 'four-way', symmetryCount: 2, arrangement: 'rectangle', complexity: 5, seed: 7 },
  { family: 'sikku', symmetry: 'rotational', symmetryCount: 4, arrangement: 'diamond', complexity: 5, seed: 8027 },
  { family: 'sikku', symmetry: 'rotational', symmetryCount: 6, arrangement: 'hexagonal', complexity: 5, seed: 20 },
  { family: 'sikku', symmetry: 'dihedral', symmetryCount: 3, arrangement: 'hexagonal', complexity: 4, seed: 21 },
  { family: 'kambi', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 7, seed: 31784 },
  { family: 'kambi', symmetry: 'rotational', symmetryCount: 4, arrangement: 'diamond', complexity: 6, seed: 39703 },
  { family: 'kambi', symmetry: 'dihedral', symmetryCount: 6, arrangement: 'hexagonal', complexity: 6, seed: 47622 },
  { family: 'kambi', symmetry: 'dihedral', symmetryCount: 8, arrangement: 'radial', complexity: 5, seed: 55541 },
  { family: 'kambi', symmetry: 'bilateral-h', symmetryCount: 1, arrangement: 'rectangle', complexity: 4, seed: 3 },
  { family: 'pulli', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 4, seed: 13 },
  { family: 'pulli', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'diamond', complexity: 7, seed: 14 },
  { family: 'pulli', symmetry: 'rotational', symmetryCount: 10, arrangement: 'radial', complexity: 6, seed: 22 },
  { family: 'pulli', symmetry: 'dihedral', symmetryCount: 16, arrangement: 'radial', complexity: 5, seed: 99 },
  { family: 'yantra', yantra: 'ganapati', seed: 108 },
  { family: 'yantra', yantra: 'sri-chakra', seed: 108 },
  { family: 'yantra', yantra: 'shatkona', seed: 108 },
  { family: 'yantra', yantra: 'kubera', seed: 108 },
];
