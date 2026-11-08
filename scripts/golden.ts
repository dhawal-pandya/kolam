/**
 * Regenerate tests/golden-v1.json. Only legitimate before version 1 is
 * published, or when adding samples; changing an existing fingerprint means
 * version-1 designs changed and the change belongs in a new version.
 */
import { writeFileSync } from 'node:fs';
import { SAMPLES, fingerprint } from '../tests/helpers';
writeFileSync('tests/golden-v1.json', JSON.stringify(Object.fromEntries(SAMPLES.map((s, i) => [i, fingerprint(s)])), null, 2) + '\n');
console.log('written');
