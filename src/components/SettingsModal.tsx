'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_FAMILIES,
  ARRANGEMENT_LABEL,
  Arrangement,
  DEFAULT_CONFIG,
  YANTRAS,
  YANTRA_INFO,
  COMPLEXITY_TIERS,
  Density,
  FAMILY_LABEL,
  Family,
  KolamConfig,
  SYMMETRY_LABEL,
  SymmetryType,
  arrangementsFor,
  autoGrid,
  complexityLabel,
  familySymmetries,
  fullId,
  gridLimits,
  normalizeConfig,
} from '@/engine';

const SYMMETRY_TYPES: SymmetryType[] = ['bilateral-h', 'bilateral-v', 'four-way', 'rotational', 'dihedral'];

const FAMILY_NOTE: Record<Family, string> = {
  pulli: 'Strokes join the dots: petals, arcs and lines meeting only at dots.',
  kambi: 'Closed wire loops bent around rows of dots; lines never cross.',
  sikku: 'One continuous interlaced line weaving around every dot.',
  yantra: 'Named yantras drawn in one documented canonical form; only the rendering varies.',
};

export interface Draft {
  config: KolamConfig;
  autoGrid: boolean;
  /** Empty = choose a fresh seed on Generate. */
  seedText: string;
}

function symOptions(family: Family) {
  // Every (type, count) the family supports on at least one arrangement.
  const seen = new Map<string, { type: SymmetryType; count: number }>();
  for (const a of arrangementsFor(family)) for (const o of familySymmetries(family, a)) seen.set(`${o.type}${o.count}`, o);
  return [...seen.values()];
}

export default function SettingsModal({
  open,
  current,
  onClose,
  onGenerate,
}: {
  open: boolean;
  current: KolamConfig;
  onClose(): void;
  onGenerate(cfg: KolamConfig, randomSeed: boolean): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>({ config: current, autoGrid: true, seedText: '' });
  // Last kolam settings, restored when switching back from a yantra.
  const lastKolam = useRef<KolamConfig>(current.family === 'yantra' ? DEFAULT_CONFIG : current);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      if (current.family !== 'yantra') lastKolam.current = current;
      const auto = autoGrid(current.arrangement, current.complexity, current.density);
      setDraft({ config: current, autoGrid: auto.w === current.grid.w && auto.h === current.grid.h, seedText: '' });
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, current]);

  const cfg = draft.config;
  const syms = useMemo(() => symOptions(cfg.family), [cfg.family]);
  const countsFor = (t: SymmetryType) => syms.filter((o) => o.type === t).map((o) => o.count).sort((a, b) => a - b);
  const arrangements = arrangementsFor(cfg.family).filter((a) =>
    familySymmetries(cfg.family, a).some((o) => o.type === cfg.symmetry && o.count === cfg.symmetryCount),
  );

  /** Update the draft and re-normalise so it always names a valid design. */
  const update = (patch: Partial<KolamConfig>, opts: { autoGrid?: boolean } = {}) => {
    setDraft((d) => {
      const useAuto = opts.autoGrid ?? d.autoGrid;
      if ((patch.family ?? d.config.family) === 'yantra') {
        if (d.config.family !== 'yantra') lastKolam.current = d.config;
        const yantra = patch.yantra ?? d.config.yantra ?? 'ganapati';
        return { ...d, config: normalizeConfig({ ...d.config, ...patch, family: 'yantra', yantra }) };
      }
      const from = d.config.family === 'yantra' ? { ...lastKolam.current, render: d.config.render } : d.config;
      let next: KolamConfig = { ...from, ...patch };
      delete next.yantra;
      // Keep the symmetry when switching family if possible; otherwise pick the closest.
      const fs = symOptions(next.family);
      if (!fs.some((o) => o.type === next.symmetry && o.count === next.symmetryCount)) {
        const same = fs.filter((o) => o.type === next.symmetry);
        const pick = same[0] ?? fs.find((o) => o.type === 'rotational') ?? fs[0];
        next = { ...next, symmetry: pick.type, symmetryCount: pick.count };
      }
      if (!arrangementsFor(next.family).some((a) => a === next.arrangement && familySymmetries(next.family, a).some((o) => o.type === next.symmetry && o.count === next.symmetryCount))) {
        const alt = arrangementsFor(next.family).find((a) => familySymmetries(next.family, a).some((o) => o.type === next.symmetry && o.count === next.symmetryCount));
        if (alt) next.arrangement = alt;
      }
      if (useAuto) next.grid = autoGrid(next.arrangement, next.complexity, next.density);
      return { ...d, autoGrid: useAuto, config: normalizeConfig(next) };
    });
  };

  const seedValid = draft.seedText === '' || /^\d{1,6}$/.test(draft.seedText);
  const preview = normalizeConfig({ ...cfg, seed: draft.seedText === '' ? cfg.seed : Number(draft.seedText) });
  const lim = gridLimits(cfg.arrangement);
  const radiusBased = cfg.arrangement !== 'square' && cfg.arrangement !== 'rectangle';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedValid) return;
    onGenerate(preview, draft.seedText === '');
  };

  return (
    <dialog ref={dialog} className="settings" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <form onSubmit={submit}>
        <header>
          <h2>Settings</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <fieldset>
          <legend>Kolam family</legend>
          <div className="seg">
            {ALL_FAMILIES.map((f) => (
              <button type="button" key={f} aria-pressed={cfg.family === f} onClick={() => update({ family: f })}>
                {FAMILY_LABEL[f]}
              </button>
            ))}
          </div>
          <p className="note">{FAMILY_NOTE[cfg.family]}</p>
        </fieldset>

        {cfg.family === 'yantra' && (
          <fieldset>
            <legend>Yantra</legend>
            <div className="seg wrap">
              {YANTRAS.map((y) => (
                <button type="button" key={y} aria-pressed={cfg.yantra === y} onClick={() => update({ yantra: y })}>
                  {YANTRA_INFO[y].label}
                </button>
              ))}
            </div>
            <p className="note">{YANTRA_INFO[cfg.yantra!].note}</p>
          </fieldset>
        )}

        {cfg.family !== 'yantra' && (
        <>
        <fieldset>
          <legend>Symmetry</legend>
          <div className="seg wrap">
            {SYMMETRY_TYPES.map((t) => {
              const counts = countsFor(t);
              return (
                <button
                  type="button"
                  key={t}
                  disabled={counts.length === 0}
                  aria-pressed={cfg.symmetry === t}
                  title={counts.length === 0 ? `Not possible for ${FAMILY_LABEL[cfg.family]} (see notes)` : undefined}
                  onClick={() => update({ symmetry: t, symmetryCount: counts.includes(cfg.symmetryCount) ? cfg.symmetryCount : counts[0] })}
                >
                  {SYMMETRY_LABEL[t]}
                </button>
              );
            })}
          </div>
          {(cfg.symmetry === 'rotational' || cfg.symmetry === 'dihedral') && (
            <div className="seg small">
              {countsFor(cfg.symmetry).map((n) => (
                <button type="button" key={n} aria-pressed={cfg.symmetryCount === n} onClick={() => update({ symmetryCount: n })}>
                  {n}-fold
                </button>
              ))}
            </div>
          )}
          {cfg.family === 'sikku' && (
            <p className="note">A single interlaced line cannot be mirrored through its own dots, so Sikku offers no dihedral symmetry.</p>
          )}
        </fieldset>

        <fieldset>
          <legend>
            Complexity <span className="val">{complexityLabel(cfg.complexity)} · {cfg.complexity}</span>
          </legend>
          <div className="seg">
            {COMPLEXITY_TIERS.map((t) => (
              <button type="button" key={t.label} aria-pressed={complexityLabel(cfg.complexity) === t.label} onClick={() => update({ complexity: t.value })}>
                {t.label}
              </button>
            ))}
          </div>
          <input type="range" min={1} max={9} value={cfg.complexity} onChange={(e) => update({ complexity: Number(e.target.value) })} aria-label="Complexity" />
        </fieldset>

        </>
        )}

        <fieldset>
          <legend>Rendering</legend>
          <div className="seg">
            <button type="button" aria-pressed={cfg.render === 'clean'} onClick={() => update({ render: 'clean' })}>
              Mathematical
            </button>
            <button type="button" aria-pressed={cfg.render === 'organic'} onClick={() => update({ render: 'organic' })}>
              Organic
            </button>
          </div>
        </fieldset>

        {cfg.family !== 'yantra' && (
        <details className="more">
          <summary>More controls</summary>

          <fieldset>
            <legend>Dot arrangement</legend>
            <select value={cfg.arrangement} onChange={(e) => update({ arrangement: e.target.value as Arrangement })}>
              {arrangements.map((a) => (
                <option key={a} value={a}>
                  {ARRANGEMENT_LABEL[a]}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset>
            <legend>Dot density</legend>
            <div className="seg small">
              {(['sparse', 'standard', 'dense'] as Density[]).map((d) => (
                <button type="button" key={d} aria-pressed={cfg.density === d} onClick={() => update({ density: d })}>
                  {d[0].toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>
              Grid <span className="val">{radiusBased ? `${cfg.grid.w} rings` : `${cfg.grid.w} × ${cfg.grid.h}`}</span>
            </legend>
            <label className="check">
              <input type="checkbox" checked={draft.autoGrid} onChange={(e) => update({}, { autoGrid: e.target.checked })} /> From complexity and density
            </label>
            {!draft.autoGrid && (
              <div className="grid-inputs">
                <input
                  type="range"
                  min={lim.min}
                  max={lim.max}
                  value={cfg.grid.w}
                  aria-label={radiusBased ? 'Radius' : 'Columns'}
                  onChange={(e) => update({ grid: { ...cfg.grid, w: Number(e.target.value), h: cfg.arrangement === 'rectangle' ? cfg.grid.h : Number(e.target.value) } })}
                />
                {cfg.arrangement === 'rectangle' && (
                  <input type="range" min={lim.min} max={lim.max} value={cfg.grid.h} aria-label="Rows" onChange={(e) => update({ grid: { ...cfg.grid, h: Number(e.target.value) } })} />
                )}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>
              Curvature <span className="val">{cfg.curvature}</span>
            </legend>
            <input type="range" min={0} max={10} value={cfg.curvature} onChange={(e) => update({ curvature: Number(e.target.value) })} aria-label="Curvature" />
          </fieldset>

          <fieldset>
            <legend>
              Ornamentation <span className="val">{cfg.ornamentation}</span>
            </legend>
            <input type="range" min={0} max={10} value={cfg.ornamentation} onChange={(e) => update({ ornamentation: Number(e.target.value) })} aria-label="Ornamentation" />
          </fieldset>

          <fieldset>
            <legend>Seed</legend>
            <div className="seed-row">
              <input
                type="text"
                inputMode="numeric"
                placeholder="New random seed"
                value={draft.seedText}
                aria-invalid={!seedValid}
                onChange={(e) => setDraft((d) => ({ ...d, seedText: e.target.value.trim() }))}
              />
              <button type="button" className="ghost" onClick={() => setDraft((d) => ({ ...d, seedText: String(current.seed) }))}>
                Keep current
              </button>
            </div>
          </fieldset>
        </details>
        )}

        <footer>
          <div className="identity-preview">
            <span>{draft.seedText === '' ? 'New design' : 'Design'}</span>
            <code>{draft.seedText === '' ? fullId(preview).replace(/^KLM-\d{6}/, 'KLM-······') : fullId(preview)}</code>
          </div>
          <button type="submit" className="primary" disabled={!seedValid}>
            Generate
          </button>
        </footer>
      </form>
    </dialog>
  );
}
