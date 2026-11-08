/**
 * Visual test sheet: renders a representative collection of designs to an
 * HTML page (and, via headless Chrome, a PNG) for manual inspection.
 *
 *   npx tsx scripts/visual-sheet.ts [name] [json-list-of-configs]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { generateKolam, KolamConfig } from '../src/engine';
import { renderSvg } from '../src/render/organic';

type Spec = Partial<KolamConfig> & { label?: string };

const DEFAULT: Spec[] = [
  { label: 'Simple bilateral sikku', family: 'sikku', symmetry: 'bilateral-v', arrangement: 'square', complexity: 2, seed: 11 },
  { label: 'Simple radial pulli', family: 'pulli', symmetry: 'dihedral', symmetryCount: 8, arrangement: 'radial', complexity: 2, seed: 12 },
  { label: 'Medium pulli', family: 'pulli', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 4, seed: 13 },
  { label: 'Intricate pulli', family: 'pulli', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'diamond', complexity: 7, seed: 14 },
  { label: 'Medium kambi', family: 'kambi', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 4, seed: 15 },
  { label: 'Intricate kambi', family: 'kambi', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 8, seed: 16 },
  { label: 'Sikku D4 9x9', family: 'sikku', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 6, seed: 17 },
  { label: 'Sikku diamond', family: 'sikku', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'diamond', complexity: 5, seed: 18 },
  { label: 'Sikku 15x15', family: 'sikku', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 9, seed: 19 },
  { label: 'Sikku hex D6', family: 'sikku', symmetry: 'dihedral', symmetryCount: 6, arrangement: 'hexagonal', complexity: 5, seed: 20 },
  { label: 'Kambi radial 12', family: 'kambi', symmetry: 'dihedral', symmetryCount: 12, arrangement: 'radial', complexity: 5, seed: 21 },
  { label: 'Pulli radial R10', family: 'pulli', symmetry: 'rotational', symmetryCount: 10, arrangement: 'radial', complexity: 6, seed: 22 },
];

const name = process.argv[2] ?? 'sheet';
const specs: Spec[] = process.argv[3] ? JSON.parse(process.argv[3]) : DEFAULT;
const outDir = path.resolve('visual');
mkdirSync(outDir, { recursive: true });

const cells = specs.map((spec, i) => {
  const t0 = performance.now();
  try {
    const d = generateKolam(spec, { skipValidationErrors: process.env.NOVALIDATE === '1' });
    const ms = (performance.now() - t0).toFixed(0);
    const svg = renderSvg(d, { idPrefix: `k${i}`, background: '#5a3626' });
    return `<figure>${svg}<figcaption><b>${spec.label ?? ''}</b><br>${d.fullId} · ${d.config.arrangement} ${d.config.grid.w}×${d.config.grid.h} · dots ${d.stats.dots} · loops ${d.stats.loops} · ${ms}ms · try ${d.stats.attempts} · gap ${d.strandGap.toFixed(3)}${d.validation.ok ? '' : ' · INVALID: ' + d.validation.errors.join('; ')}</figcaption></figure>`;
  } catch (e) {
    return `<figure class="err"><div>${String((e as Error).message)}</div><figcaption>${spec.label ?? ''}</figcaption></figure>`;
  }
});

const cols = Math.min(4, specs.length);
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#2b1d16;color:#e8dccb;font:12px/1.4 ui-monospace,monospace}
main{display:grid;grid-template-columns:repeat(${cols},480px);gap:10px;padding:10px}
figure{margin:0;background:#5a3626;padding:10px}
svg{display:block;width:460px;height:460px}
.err div{height:460px;color:#ffb4a0;padding:8px}
</style><main>${cells.join('')}</main>`;
const htmlPath = path.join(outDir, `${name}.html`);
writeFileSync(htmlPath, html);

const rows = Math.ceil(specs.length / cols);
const pngPath = path.join(outDir, `${name}.png`);
try {
  execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--screenshot=${pngPath}`,
    `--window-size=${cols * 490 + 20},${rows * 540 + 20}`,
    `file://${htmlPath}`,
  ], { stdio: 'ignore', timeout: 60000 });
  console.log(pngPath);
} catch (e) {
  console.log(htmlPath, '(screenshot failed)', (e as Error).message);
}
