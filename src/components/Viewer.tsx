'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ARRANGEMENT_LABEL,
  FAMILY_LABEL,
  KolamConfig,
  SYMMETRY_LABEL,
  YANTRA_INFO,
  fromSearchParams,
  generateKolam,
  toQueryString,
} from '@/engine';
import { renderSvg } from '@/render/organic';
import { featuredConfig } from '@/data/gallery';
import Floor from './Floor';
import Footer from './Footer';
import KolamCanvas, { CanvasHandle } from './KolamCanvas';
import SettingsModal from './SettingsModal';
import { IconFit, IconMinus, IconPlus, IconSettings } from './icons';

/** Seed choice for a *new* design. Uses the platform CSPRNG; the design itself is then fully determined by the seed. */
function freshSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % 1000000;
}

function readUrl(): { config: KolamConfig | null; error: string | null } {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('id')) return { config: null, error: null };
  try {
    return { config: fromSearchParams(params), error: null };
  } catch (e) {
    return { config: null, error: (e as Error).message };
  }
}

function describe(c: KolamConfig): string {
  if (c.family === 'yantra') return `${YANTRA_INFO[c.yantra!].label} · canonical form`;
  const sym = c.symmetry === 'rotational' || c.symmetry === 'dihedral' ? `${SYMMETRY_LABEL[c.symmetry]} ${c.symmetryCount}` : SYMMETRY_LABEL[c.symmetry];
  const grid = c.arrangement === 'square' || c.arrangement === 'rectangle' ? `${c.grid.w}×${c.grid.h}` : `${c.grid.w} rings`;
  return `${FAMILY_LABEL[c.family]} · ${ARRANGEMENT_LABEL[c.arrangement].split(' (')[0].toLowerCase()} ${grid} · ${sym.toLowerCase()}`;
}

/**
 * Gallery mode: after `ms` without mouse, touch, wheel or key activity, only
 * the kolam stays on screen. Never idles while `paused` (settings open) or
 * while the pointer rests on one of the controls.
 */
function useIdle(ms: number, paused: boolean): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (paused) {
      setIdle(false);
      return;
    }
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.querySelector('.controls:hover, .identity:hover, .top:hover, .credit:hover')) arm();
        else setIdle(true);
      }, ms);
    };
    const wake = () => {
      setIdle(false);
      arm();
    };
    const events = ['mousemove', 'pointerdown', 'wheel', 'keydown', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms, paused]);
  return idle;
}

export default function Viewer() {
  const [config, setConfig] = useState<KolamConfig | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const canvas = useRef<CanvasHandle>(null);
  const idle = useIdle(3000, settingsOpen);

  // Load from URL (direct navigation, refresh, shared link, back/forward).
  useEffect(() => {
    const load = () => {
      const { config: c, error } = readUrl();
      setUrlError(error);
      if (c) setConfig(c);
      else {
        const f = featuredConfig();
        setConfig(f);
        if (!error) window.history.replaceState(null, '', toQueryString(f));
      }
    };
    load();
    window.addEventListener('popstate', load);
    return () => window.removeEventListener('popstate', load);
  }, []);

  const show = useCallback((c: KolamConfig) => {
    setConfig(c);
    setUrlError(null);
    window.history.pushState(null, '', toQueryString(c));
  }, []);

  const result = useMemo(() => {
    if (!config) return null;
    try {
      const design = generateKolam(config);
      return { design, svg: renderSvg(design, { idPrefix: 'art', className: 'art' }), error: null };
    } catch (e) {
      return { design: null, svg: '', error: (e as Error).message };
    }
  }, [config]);

  // Last kolam shown, so "New kolam" from a yantra returns to those settings.
  const lastKolam = useRef<KolamConfig | null>(null);
  useEffect(() => {
    if (config && config.family !== 'yantra') lastKolam.current = config;
  }, [config]);

  const generate = useCallback(() => {
    if (!config) return;
    // A named yantra has one form; Generate returns to kolam generation.
    const base = config.family === 'yantra' ? (lastKolam.current ?? featuredConfig()) : config;
    show({ ...base, render: config.render, seed: freshSeed() });
  }, [config, show]);

  // Keyboard: G/space generate, +/- zoom, 0 fit, S settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest('input,select,textarea,dialog')) return;
      if (e.key === 'g' || e.key === ' ') {
        e.preventDefault();
        generate();
      } else if (e.key === '+' || e.key === '=') canvas.current?.zoomBy(1.5);
      else if (e.key === '-') canvas.current?.zoomBy(1 / 1.5);
      else if (e.key === '0') canvas.current?.fit();
      else if (e.key === 's') setSettingsOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generate, settingsOpen]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable: the URL bar already holds the canonical link */
    }
  };

  const design = result?.design;
  const maxZoom = design ? Math.max(3, Math.min(14, Math.sqrt(design.stats.dots) * 0.9)) : 4;

  return (
    <main className={idle ? 'viewer idle' : 'viewer'}>
      <Floor />
      {result?.svg && <KolamCanvas key={design!.fullId} ref={canvas} svg={result.svg} maxZoom={maxZoom} onZoomChange={setZoom} />}
      {(result?.error || urlError) && (
        <div className="error" role="alert">
          <p>{urlError ? `This link does not name a valid kolam: ${urlError}` : result?.error}</p>
          <button className="pill" onClick={generate}>
            Generate another
          </button>
        </div>
      )}

      <Footer variant="overlay" />

      <nav className="top">
        <Link href="/gallery/" className="quiet-link">
          Gallery
        </Link>
      </nav>

      {config && (
        <button className="identity" onClick={copyLink} title="Copy link to this kolam">
          <span className="id">
            {design ? design.id : '—'}
            {design && <span className="hash">.{design.fullId.split('.')[1]}</span>}
          </span>
          <span className="desc">{copied ? 'Link copied' : describe(config)}</span>
        </button>
      )}

      <div className="controls">
        <div className="zoom" role="group" aria-label="Zoom">
          <button className="icon-btn" aria-label="Zoom out" onClick={() => canvas.current?.zoomBy(1 / 1.5)} disabled={zoom <= 1.001}>
            <IconMinus />
          </button>
          <button className="icon-btn" aria-label="Fit to screen" onClick={() => canvas.current?.fit()} disabled={zoom <= 1.001}>
            <IconFit />
          </button>
          <button className="icon-btn" aria-label="Zoom in" onClick={() => canvas.current?.zoomBy(1.5)} disabled={zoom >= maxZoom - 0.001}>
            <IconPlus />
          </button>
        </div>
        <button className="icon-btn solo" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <IconSettings />
        </button>
        <button className="pill generate" onClick={generate}>
          {config?.family === 'yantra' ? 'New kolam' : 'Generate'}
        </button>
      </div>

      {config && (
        <SettingsModal
          open={settingsOpen}
          current={config}
          onClose={() => setSettingsOpen(false)}
          onGenerate={(c, random) => {
            setSettingsOpen(false);
            show(random ? { ...c, seed: freshSeed() } : c);
          }}
        />
      )}
    </main>
  );
}
