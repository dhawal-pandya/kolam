'use client';

/**
 * Visual test sheet: a representative spread of families, arrangements,
 * symmetries and complexities, re-seedable, in either render style. Used to
 * inspect actual output (CLAUDE.md §13) — not linked from the gallery UI.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { generateKolam, KolamConfig, toQueryString } from '@/engine';
import { renderSvg } from '@/render/organic';

const SPECS: (Partial<KolamConfig> & { label: string })[] = [
  { label: 'Simple bilateral sikku', family: 'sikku', symmetry: 'bilateral-v', arrangement: 'square', complexity: 2 },
  { label: 'Sikku · square · R4', family: 'sikku', symmetry: 'rotational', symmetryCount: 4, arrangement: 'square', complexity: 6 },
  { label: 'Sikku · diamond · R4', family: 'sikku', symmetry: 'rotational', symmetryCount: 4, arrangement: 'diamond', complexity: 5 },
  { label: 'Sikku · hexagonal · R6', family: 'sikku', symmetry: 'rotational', symmetryCount: 6, arrangement: 'hexagonal', complexity: 5 },
  { label: 'Sikku · 15×15 cloth', family: 'sikku', symmetry: 'four-way', arrangement: 'square', complexity: 9 },
  { label: 'Medium kambi', family: 'kambi', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 5 },
  { label: 'Intricate kambi', family: 'kambi', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 8 },
  { label: 'Kambi · diamond · R4', family: 'kambi', symmetry: 'rotational', symmetryCount: 4, arrangement: 'diamond', complexity: 6 },
  { label: 'Kambi · hexagonal · D6', family: 'kambi', symmetry: 'dihedral', symmetryCount: 6, arrangement: 'hexagonal', complexity: 6 },
  { label: 'Kambi · rings · D12', family: 'kambi', symmetry: 'dihedral', symmetryCount: 12, arrangement: 'radial', complexity: 5 },
  { label: 'Simple radial pulli', family: 'pulli', symmetry: 'dihedral', symmetryCount: 8, arrangement: 'radial', complexity: 2 },
  { label: 'Medium pulli', family: 'pulli', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'square', complexity: 4 },
  { label: 'Intricate pulli', family: 'pulli', symmetry: 'dihedral', symmetryCount: 4, arrangement: 'diamond', complexity: 7 },
  { label: 'Pulli · rings · R10', family: 'pulli', symmetry: 'rotational', symmetryCount: 10, arrangement: 'radial', complexity: 6 },
  { label: 'Pulli · hexagonal · R6', family: 'pulli', symmetry: 'rotational', symmetryCount: 6, arrangement: 'hexagonal', complexity: 5 },
  { label: 'Pulli · rings · D16', family: 'pulli', symmetry: 'dihedral', symmetryCount: 16, arrangement: 'radial', complexity: 4 },
  { label: 'Yantra · Ganapati', family: 'yantra', yantra: 'ganapati' },
  { label: 'Yantra · Sri Chakra', family: 'yantra', yantra: 'sri-chakra' },
  { label: 'Yantra · Shatkona', family: 'yantra', yantra: 'shatkona' },
  { label: 'Yantra · Kubera kolam', family: 'yantra', yantra: 'kubera' },
];

function Cell({ spec, seed, organic, i }: { spec: (typeof SPECS)[number]; seed: number; organic: boolean; i: number }) {
  let html = '';
  let caption = '';
  let href = '/';
  try {
    const d = generateKolam({ ...spec, seed, render: organic ? 'organic' : 'clean' });
    html = renderSvg(d, { idPrefix: `c${i}` });
    caption = `${d.fullId} · ${d.stats.dots} dots${d.stats.loops ? ` · ${d.stats.loops} line${d.stats.loops > 1 ? 's' : ''}` : ''}`;
    href = `/${toQueryString(d.config)}`;
  } catch (e) {
    html = `<p style="color:#ffb4a0;font-size:12px">${(e as Error).message}</p>`;
  }
  return (
    <Link href={href} className="sheet-cell">
      <div className="thumb" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="meta">
        <strong>{spec.label}</strong>
        <code>{caption}</code>
      </div>
    </Link>
  );
}

export default function StudySheet() {
  const [base, setBase] = useState<number | null>(null);
  const [organic, setOrganic] = useState(false);
  useEffect(() => setBase(108), []);
  const reseed = () => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    setBase(a[0] % 1000000);
  };
  return (
    <main className="gallery sheet">
      <header>
        <nav className="page-nav">
          <Link href="/" className="quiet-link">
            ← Studio
          </Link>
          <Link href="/gallery/" className="quiet-link">
            ← Gallery
          </Link>
        </nav>
        <h1>Study sheet</h1>
        <p>Every family, arrangement and symmetry side by side. Re-seed to inspect the generator; click a cell to open it full size.</p>
        <div className="sheet-bar">
          <button className="pill" onClick={reseed}>
            New seeds
          </button>
          <label className="check">
            <input type="checkbox" checked={organic} onChange={(e) => setOrganic(e.target.checked)} /> Organic rendering
          </label>
          <span className="note">base seed {base}</span>
        </div>
      </header>
      {base !== null && (
        <ul>
          {SPECS.map((s, i) => (
            <li key={i}>
              <Cell i={i} spec={s} seed={(base + i * 7919) % 1000000} organic={organic} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
