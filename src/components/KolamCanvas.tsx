'use client';

/**
 * Artwork view with zoom and pan.
 *
 * The SVG markup is inserted once per design; the camera then changes only
 * the SVG viewBox, so zooming never touches geometry, seed or texture.
 * During a gesture the committed view is moved with a cheap CSS transform;
 * ~140 ms after the gesture settles the camera is committed to the viewBox
 * and the browser re-rasterises crisply at the new scale.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

export interface CanvasHandle {
  zoomBy(factor: number): void;
  fit(): void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Camera {
  s: number;
  cx: number;
  cy: number;
}

const KolamCanvas = forwardRef<CanvasHandle, { svg: string; maxZoom: number; onZoomChange?: (s: number) => void }>(
  function KolamCanvas({ svg, maxZoom, onZoomChange }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const svgEl = useRef<SVGSVGElement | null>(null);
    const base = useRef<Box>({ x: 0, y: 0, w: 1, h: 1 });
    const cam = useRef<Camera>({ s: 1, cx: 0, cy: 0 });
    const committed = useRef<Camera>({ s: 1, cx: 0, cy: 0 });
    const timer = useRef<number | undefined>(undefined);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const lastPinch = useRef<{ d: number; mx: number; my: number } | null>(null);

    /** Screen pixels per design unit at zoom s = 1. */
    const k0 = () => {
      const el = host.current!;
      return Math.min(el.clientWidth / base.current.w, el.clientHeight / base.current.h);
    };

    const clamp = (c: Camera): Camera => {
      const s = Math.max(1, Math.min(maxZoom, c.s));
      const b = base.current;
      const cx = Math.max(b.x, Math.min(b.x + b.w, c.cx));
      const cy = Math.max(b.y, Math.min(b.y + b.h, c.cy));
      return { s, cx, cy };
    };

    const commit = useCallback(() => {
      const el = svgEl.current;
      if (!el) return;
      const c = cam.current;
      const b = base.current;
      const w = b.w / c.s;
      const h = b.h / c.s;
      el.setAttribute('viewBox', `${c.cx - w / 2} ${c.cy - h / 2} ${w} ${h}`);
      el.style.transform = '';
      committed.current = { ...c };
    }, []);

    const preview = useCallback(() => {
      const el = svgEl.current;
      if (!el) return;
      const c = cam.current;
      const c0 = committed.current;
      const m = c.s / c0.s;
      const k = k0() * c0.s * m;
      const tx = (c0.cx - c.cx) * k;
      const ty = (c0.cy - c.cy) * k;
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${m})`;
      onZoomChange?.(c.s);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(commit, 140);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [commit, onZoomChange]);

    const setCam = useCallback(
      (c: Camera, immediate = false) => {
        cam.current = clamp(c);
        if (immediate) {
          commit();
          onZoomChange?.(cam.current.s);
        } else preview();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [commit, preview, maxZoom],
    );

    /** Design-space point under a client (screen) position, for the current camera. */
    const toDesign = (clientX: number, clientY: number) => {
      const el = host.current!;
      const r = el.getBoundingClientRect();
      const k = k0() * cam.current.s;
      return {
        x: cam.current.cx + (clientX - (r.left + r.width / 2)) / k,
        y: cam.current.cy + (clientY - (r.top + r.height / 2)) / k,
      };
    };

    const zoomAt = useCallback(
      (factor: number, clientX?: number, clientY?: number) => {
        const c = cam.current;
        const s2 = Math.max(1, Math.min(maxZoom, c.s * factor));
        if (clientX === undefined || clientY === undefined) {
          setCam({ ...c, s: s2 });
          return;
        }
        const p = toDesign(clientX, clientY);
        const f = c.s / s2;
        setCam({ s: s2, cx: p.x + (c.cx - p.x) * f, cy: p.y + (c.cy - p.y) * f });
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [maxZoom, setCam],
    );

    useImperativeHandle(ref, () => ({
      zoomBy: (f) => zoomAt(f),
      fit: () => setCam({ s: 1, cx: base.current.x + base.current.w / 2, cy: base.current.y + base.current.h / 2 }, true),
    }));

    // Insert new artwork; the initial view always fits the whole design.
    useEffect(() => {
      const el = host.current;
      if (!el) return;
      el.innerHTML = svg;
      const s = el.querySelector('svg');
      svgEl.current = s;
      if (!s) return;
      const vb = s.viewBox.baseVal;
      base.current = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
      cam.current = { s: 1, cx: vb.x + vb.width / 2, cy: vb.y + vb.height / 2 };
      committed.current = { ...cam.current };
      onZoomChange?.(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [svg]);

    useEffect(() => {
      const el = host.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022));
        zoomAt(factor, e.clientX, e.clientY);
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [zoomAt]);

    const onPointerDown = (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastPinch.current = null;
    };
    const onPointerMove = (e: React.PointerEvent) => {
      const pts = pointers.current;
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        const k = k0() * cam.current.s;
        const c = cam.current;
        setCam({ ...c, cx: c.cx - (e.clientX - prev.x) / k, cy: c.cy - (e.clientY - prev.y) / k });
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const lp = lastPinch.current;
        if (lp) {
          const k = k0() * cam.current.s;
          const c = cam.current;
          setCam({ ...c, cx: c.cx - (mx - lp.mx) / k, cy: c.cy - (my - lp.my) / k });
          zoomAt(d / lp.d, mx, my);
        }
        lastPinch.current = { d, mx, my };
      }
    };
    const onPointerUp = (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      lastPinch.current = null;
    };

    return (
      <div
        ref={host}
        className="canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => zoomAt(cam.current.s >= maxZoom * 0.99 ? 1 / maxZoom : 2, e.clientX, e.clientY)}
      />
    );
  },
);

export default KolamCanvas;
