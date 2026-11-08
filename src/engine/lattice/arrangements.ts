/**
 * Dot arrangements ("pulli" layouts). Every arrangement is centred on the
 * origin so the symmetry group acts about (0, 0).
 *
 *  square      n × n orthogonal grid (neer pulli). Lines run diagonally.
 *  rectangle   w × h orthogonal grid.
 *  diamond     |x| + |y| ≤ r on the orthogonal grid: rows 1-3-5-…-5-3-1.
 *  hexagonal   triangular lattice clipped to a regular hexagon of radius r
 *              (each dot has six neighbours).
 *  radial      a central dot and r concentric rings. Ring k holds N·m_k dots
 *              (N = symmetry order, m_k chosen so neighbouring dots stay
 *              roughly one unit apart); neighbours across rings are dots whose
 *              angular cells overlap, which keeps the graph planar and
 *              N-fold symmetric by construction.
 */

import { Arrangement, GridSpec } from '../config';
import { Vec, v } from '../geometry/vec';
import { DotGraph, buildGraph } from './graph';

export function buildArrangement(arr: Arrangement, grid: GridSpec, radialCount: number): DotGraph {
  switch (arr) {
    case 'square':
      return rectGrid(grid.w, grid.w);
    case 'rectangle':
      return rectGrid(grid.w, grid.h);
    case 'diamond':
      return diamond(grid.w);
    case 'hexagonal':
      return hexagon(grid.w);
    case 'radial':
      return radial(grid.w, radialCount);
  }
}

function rectGrid(w: number, h: number): DotGraph {
  const dots: Vec[] = [];
  const band: number[] = [];
  const id = (i: number, j: number) => j * w + i;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      dots.push(v(i - (w - 1) / 2, j - (h - 1) / 2));
      band.push(Math.min(i, j, w - 1 - i, h - 1 - j));
    }
  const pairs: [number, number][] = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (i + 1 < w) pairs.push([id(i, j), id(i + 1, j)]);
      if (j + 1 < h) pairs.push([id(i, j), id(i, j + 1)]);
    }
  return buildGraph(dots, band, pairs);
}

function diamond(r: number): DotGraph {
  const dots: Vec[] = [];
  const band: number[] = [];
  const index = new Map<string, number>();
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const s = Math.abs(x) + Math.abs(y);
      if (s > r) continue;
      index.set(`${x},${y}`, dots.length);
      dots.push(v(x, y));
      // Two Manhattan layers form one closed staircase ring.
      band.push(Math.floor((r - s) / 2));
    }
  const pairs: [number, number][] = [];
  for (const [k, i] of index) {
    const [x, y] = k.split(',').map(Number);
    const right = index.get(`${x + 1},${y}`);
    const up = index.get(`${x},${y + 1}`);
    if (right !== undefined) pairs.push([i, right]);
    if (up !== undefined) pairs.push([i, up]);
  }
  return buildGraph(dots, band, pairs);
}

function hexagon(r: number): DotGraph {
  const dots: Vec[] = [];
  const band: number[] = [];
  const index = new Map<string, number>();
  const h = Math.sqrt(3) / 2;
  for (let s = -r; s <= r; s++)
    for (let q = -r; q <= r; q++) {
      const d = Math.max(Math.abs(q), Math.abs(s), Math.abs(q + s));
      if (d > r) continue;
      index.set(`${q},${s}`, dots.length);
      dots.push(v(q + s / 2, s * h));
      band.push(r - d);
    }
  const pairs: [number, number][] = [];
  for (const [k, i] of index) {
    const [q, s] = k.split(',').map(Number);
    for (const [dq, ds] of [
      [1, 0],
      [0, 1],
      [-1, 1],
    ]) {
      const j = index.get(`${q + dq},${s + ds}`);
      if (j !== undefined) pairs.push([i, j]);
    }
  }
  return buildGraph(dots, band, pairs);
}

export function radialRingCounts(rings: number, n: number): { radius: number[]; count: number[] } {
  const r1 = Math.max(1, (0.85 * n) / (2 * Math.PI));
  const radius: number[] = [];
  const count: number[] = [];
  for (let k = 1; k <= rings; k++) {
    const r = r1 + (k - 1);
    const m = Math.max(1, Math.round((2 * Math.PI * r) / n / 1.0));
    radius.push(r);
    count.push(n * m);
  }
  return { radius, count };
}

function radial(rings: number, n: number): DotGraph {
  const dots: Vec[] = [v(0, 0)];
  const band: number[] = [rings];
  const { radius, count } = radialRingCounts(rings, n);
  const ringIds: number[][] = [];
  for (let k = 0; k < rings; k++) {
    const ids: number[] = [];
    for (let j = 0; j < count[k]; j++) {
      const t = (2 * Math.PI * j) / count[k];
      ids.push(dots.length);
      dots.push(v(radius[k] * Math.cos(t), radius[k] * Math.sin(t)));
      band.push(rings - 1 - k);
    }
    ringIds.push(ids);
  }
  const pairs: [number, number][] = [];
  for (const id of ringIds[0]) pairs.push([0, id]);
  for (let k = 0; k < rings; k++) {
    const ids = ringIds[k];
    for (let j = 0; j < ids.length; j++) pairs.push([ids[j], ids[(j + 1) % ids.length]]);
    if (k + 1 < rings) {
      // Join dots whose angular cells overlap with positive measure.
      const a = count[k];
      const b = count[k + 1];
      // Integer arithmetic in units of 1/(2ab) turn: inner cell i is centred
      // at 2ib with half-width b, outer cell j at 2ja with half-width a.
      const total = 2 * a * b;
      for (let i = 0; i < a; i++)
        for (let j = 0; j < b; j++) {
          let diff = (((2 * i * b - 2 * j * a) % total) + total) % total;
          if (diff > total / 2) diff = total - diff;
          if (a + b - diff > 0) pairs.push([ringIds[k][i], ringIds[k + 1][j]]);
        }
    }
  }
  return buildGraph(dots, band, pairs);
}
