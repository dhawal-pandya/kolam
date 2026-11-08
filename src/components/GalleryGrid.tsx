'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { generateKolam } from '@/engine';
import { renderSvg } from '@/render/organic';
import { GALLERY, entryHref } from '@/data/gallery';
import Floor from './Floor';

/** Curated designs, each regenerated in the browser from its stored configuration. */
export default function GalleryGrid() {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    // Generate progressively so the page stays responsive.
    let cancelled = false;
    let i = 0;
    const next = () => {
      if (cancelled || i >= GALLERY.length) return;
      const e = GALLERY[i++];
      let svg = '';
      try {
        svg = renderSvg(generateKolam(e.config), { style: 'clean', idPrefix: `g${i}` });
      } catch {
        svg = '';
      }
      setThumbs((t) => ({ ...t, [e.id]: svg }));
      window.setTimeout(next, 0);
    };
    next();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="gallery">
      <Floor />
      <header>
        <nav className="page-nav">
          <Link href="/" className="quiet-link">
            ← Studio
          </Link>
          <Link href="/sheet/" className="quiet-link">
            Study sheet →
          </Link>
        </nav>
        <h1>Gallery</h1>
        <p>Selected kolams. Each is rebuilt from its configuration, so what you see is exactly what the link opens.</p>
      </header>
      {[
        { title: 'Kolams', entries: GALLERY.filter((e) => e.config.family !== 'yantra') },
        { title: 'Yantras', entries: GALLERY.filter((e) => e.config.family === 'yantra') },
      ]
        .filter((sec) => sec.entries.length)
        .map((sec) => (
      <section key={sec.title}>
      <h2>{sec.title}</h2>
      <ul>
        {sec.entries.map((e) => (
          <li key={e.id}>
            <Link href={entryHref(e)}>
              <div className="thumb" dangerouslySetInnerHTML={{ __html: thumbs[e.id] ?? '' }} />
              <div className="meta">
                <strong>{e.title}</strong>
                {e.description && <span>{e.description}</span>}
                <code>{e.id}</code>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      </section>
        ))}
    </main>
  );
}
