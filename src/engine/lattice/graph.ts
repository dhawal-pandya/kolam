import { Vec, angle, sub, pointKey, cross } from '../geometry/vec';

/**
 * A dot arrangement as a plane graph: dots are vertices, and edges join dots
 * that are lattice neighbours (the pairs a kolam line may pass between or
 * join). The rotation system (edges sorted counter-clockwise around each dot)
 * determines the faces and the medial graph used by the line families.
 */
export interface Edge {
  a: number;
  b: number;
}

export interface DotGraph {
  dots: Vec[];
  /** Concentric layer index: 0 on the outer boundary, increasing inward. */
  band: number[];
  edges: Edge[];
  /** Per dot, incident edge ids sorted counter-clockwise by direction. */
  rot: number[][];
  /** Face to the left / right of each edge oriented a→b (-1 = outer face). */
  leftFace: number[];
  rightFace: number[];
  /** Interior faces as dot cycles (counter-clockwise). */
  faces: number[][];
  /** Lattice spacing (nearest-neighbour distance, ~1). */
  unit: number;
  /** Lookup a dot id by exact position. */
  dotAt(p: Vec): number | undefined;
  edgeBetween(a: number, b: number): number | undefined;
}

export function other(e: Edge, d: number): number {
  return e.a === d ? e.b : e.a;
}

export function buildGraph(dots: Vec[], band: number[], pairs: [number, number][], unit = 1): DotGraph {
  const keyToDot = new Map<string, number>();
  dots.forEach((p, i) => {
    const k = pointKey(p);
    if (keyToDot.has(k)) throw new Error(`duplicate dot at ${k}`);
    keyToDot.set(k, i);
  });
  const edges: Edge[] = [];
  const edgeKey = new Map<string, number>();
  for (const [x, y] of pairs) {
    const a = Math.min(x, y);
    const b = Math.max(x, y);
    const k = `${a}:${b}`;
    if (a === b || edgeKey.has(k)) continue;
    edgeKey.set(k, edges.length);
    edges.push({ a, b });
  }
  const rot: number[][] = dots.map(() => []);
  edges.forEach((e, i) => {
    rot[e.a].push(i);
    rot[e.b].push(i);
  });
  rot.forEach((list, d) => {
    list.sort((e1, e2) => {
      const t1 = angle(sub(dots[other(edges[e1], d)], dots[d]));
      const t2 = angle(sub(dots[other(edges[e2], d)], dots[d]));
      return t1 - t2;
    });
  });

  // Face traversal over half-edges. Half-edge h = 2e (a→b) or 2e+1 (b→a).
  const leftFace = new Array(edges.length).fill(-2);
  const rightFace = new Array(edges.length).fill(-2);
  const visited = new Uint8Array(edges.length * 2);
  const faces: number[][] = [];
  const tail = (h: number) => (h & 1 ? edges[h >> 1].b : edges[h >> 1].a);
  const head = (h: number) => (h & 1 ? edges[h >> 1].a : edges[h >> 1].b);
  const nextInFace = (h: number): number => {
    // Arriving at v = head(h); leave along the edge immediately clockwise of v→tail(h).
    const vtx = head(h);
    const list = rot[vtx];
    const idx = list.indexOf(h >> 1);
    const nxtEdge = list[(idx - 1 + list.length) % list.length];
    return edges[nxtEdge].a === vtx ? nxtEdge * 2 : nxtEdge * 2 + 1;
  };
  for (let h0 = 0; h0 < edges.length * 2; h0++) {
    if (visited[h0]) continue;
    const cycle: number[] = [];
    const hs: number[] = [];
    let h = h0;
    let guard = 0;
    while (!visited[h]) {
      visited[h] = 1;
      hs.push(h);
      cycle.push(tail(h));
      h = nextInFace(h);
      if (++guard > edges.length * 2 + 2) throw new Error('face traversal did not close');
    }
    let area = 0;
    for (let i = 0; i < cycle.length; i++) area += cross(dots[cycle[i]], dots[cycle[(i + 1) % cycle.length]]);
    const fid = area > 1e-9 ? faces.length : -1;
    if (fid >= 0) faces.push(cycle);
    for (const hh of hs) {
      if (hh & 1) rightFace[hh >> 1] = fid;
      else leftFace[hh >> 1] = fid;
    }
  }

  return {
    dots,
    band,
    edges,
    rot,
    leftFace,
    rightFace,
    faces,
    unit,
    dotAt: (p) => keyToDot.get(pointKey(p)),
    edgeBetween: (a, b) => edgeKey.get(`${Math.min(a, b)}:${Math.max(a, b)}`),
  };
}
