/**
 * Symmetry engine.
 *
 * A symmetry is a finite group of orthogonal maps about the origin. Instead of
 * drawing a whole design and hoping it is symmetric, every construction
 * decision is made once per *orbit* (an equivalence class of dots / edges /
 * motifs under the group) and is therefore replicated by every group element
 * exactly. The canonical representative of each orbit is the element lying in
 * the fundamental region (the smallest id among its images), which is where
 * the random choice is made.
 *
 * Conventions:
 *   bilateral-h  mirror line is horizontal (top ↔ bottom)        group D1
 *   bilateral-v  mirror line is vertical   (left ↔ right)        group D1
 *   four-way     both mirror lines (and the half turn)          group D2
 *   rotational n rotations by 2πk/n                             group Cn
 *   dihedral n   rotations by 2πk/n and n mirror lines          group Dn
 */

import { SymmetryType } from './config';
import { Mat2, Vec, apply, reflection, rotation, det } from './geometry/vec';
import { DotGraph } from './lattice/graph';

export interface SymmetryGroup {
  type: SymmetryType;
  count: number;
  elements: Mat2[];
}

export function makeGroup(type: SymmetryType, count: number): SymmetryGroup {
  const I = rotation(0);
  let elements: Mat2[];
  switch (type) {
    case 'bilateral-h':
      elements = [I, reflection(0)];
      break;
    case 'bilateral-v':
      elements = [I, reflection(Math.PI / 2)];
      break;
    case 'four-way':
      elements = [I, reflection(0), reflection(Math.PI / 2), rotation(Math.PI)];
      break;
    case 'rotational':
      elements = Array.from({ length: count }, (_, k) => rotation((2 * Math.PI * k) / count));
      break;
    case 'dihedral':
      elements = [
        ...Array.from({ length: count }, (_, k) => rotation((2 * Math.PI * k) / count)),
        ...Array.from({ length: count }, (_, k) => reflection((Math.PI * k) / count)),
      ];
      break;
  }
  return { type, count, elements };
}

export const isReflection = (m: Mat2) => det(m) < 0;

export class SymmetryError extends Error {}

/**
 * The group realised as permutations of the dot graph. Construction fails if
 * any element does not map the dot set (and edge set) onto itself — that is
 * how unsupported arrangement/symmetry pairs are rejected.
 */
export interface GraphSymmetry {
  group: SymmetryGroup;
  /** dotPerm[g][d] = image of dot d under element g. */
  dotPerm: number[][];
  /** edgePerm[g][e] = image of edge e under element g. */
  edgePerm: number[][];
  /** Whether element g reverses an edge's a→b orientation, per edge. */
  edgeFlip: boolean[][];
  edgeOrbits: number[][];
  edgeOrbitOf: number[];
  dotOrbits: number[][];
  dotOrbitOf: number[];
  map(g: number, p: Vec): Vec;
}

export function realise(graph: DotGraph, group: SymmetryGroup): GraphSymmetry {
  const dotPerm = group.elements.map((m) =>
    graph.dots.map((p, i) => {
      const img = graph.dotAt(apply(m, p));
      if (img === undefined) throw new SymmetryError(`symmetry does not preserve dot ${i}`);
      return img;
    }),
  );
  const edgePerm: number[][] = [];
  const edgeFlip: boolean[][] = [];
  dotPerm.forEach((perm) => {
    const ep: number[] = [];
    const ef: boolean[] = [];
    graph.edges.forEach((e, i) => {
      const a = perm[e.a];
      const b = perm[e.b];
      const img = graph.edgeBetween(a, b);
      if (img === undefined) throw new SymmetryError(`symmetry does not preserve edge ${i}`);
      ep.push(img);
      ef.push(graph.edges[img].a !== a);
    });
    edgePerm.push(ep);
    edgeFlip.push(ef);
  });
  const orbits = (n: number, perms: number[][]) => {
    const of = new Array(n).fill(-1);
    const list: number[][] = [];
    for (let i = 0; i < n; i++) {
      if (of[i] >= 0) continue;
      const orb = new Set<number>();
      for (const p of perms) orb.add(p[i]);
      const arr = [...orb].sort((x, y) => x - y);
      for (const j of arr) of[j] = list.length;
      list.push(arr);
    }
    return { of, list };
  };
  const eo = orbits(graph.edges.length, edgePerm);
  const dO = orbits(graph.dots.length, dotPerm);
  return {
    group,
    dotPerm,
    edgePerm,
    edgeFlip,
    edgeOrbits: eo.list,
    edgeOrbitOf: eo.of,
    dotOrbits: dO.list,
    dotOrbitOf: dO.of,
    map: (g, p) => apply(group.elements[g], p),
  };
}
