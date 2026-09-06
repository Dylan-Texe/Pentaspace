import { Mat5 } from "./mat5";
import { Vec5 } from "./vec5";

export type Edge = [number, number];
export type Quad = [number, number, number, number];

function bit(i: number, b: number): boolean {
  return (i & (1 << b)) !== 0;
}

/** 2^n vertices of an n-cube centred at the origin with half-extent `s`. */
export function hypercubeVertices(dimensions: 4 | 5, s: number): Vec5[] {
  const count = 1 << dimensions;
  const verts: Vec5[] = [];
  for (let i = 0; i < count; i++) {
    verts.push(
      new Vec5(
        bit(i, 0) ? s : -s,
        bit(i, 1) ? s : -s,
        bit(i, 2) ? s : -s,
        bit(i, 3) ? s : -s,
        dimensions === 5 ? (bit(i, 4) ? s : -s) : 0,
      ),
    );
  }
  return verts;
}

export function hypercubeEdges(dimensions: 4 | 5): Edge[] {
  const count = 1 << dimensions;
  const edges: Edge[] = [];
  for (let i = 0; i < count; i++) {
    for (let b = 0; b < dimensions; b++) {
      const j = i | (1 << b);
      if (j !== i) edges.push([i, j]);
    }
  }
  return edges;
}

/** 2-faces (squares) of an n-cube. */
export function hypercubeSquares(dimensions: 4 | 5): Quad[] {
  const count = 1 << dimensions;
  const squares: Quad[] = [];
  for (let b1 = 0; b1 < dimensions; b1++) {
    for (let b2 = b1 + 1; b2 < dimensions; b2++) {
      const mask = (1 << b1) | (1 << b2);
      for (let i = 0; i < count; i++) {
        if ((i & mask) !== 0) continue;
        squares.push([i, i | (1 << b1), i | (1 << b1) | (1 << b2), i | (1 << b2)]);
      }
    }
  }
  return squares;
}

export const PENTERACT_EDGES = hypercubeEdges(5);
export const PENTERACT_SQUARES = hypercubeSquares(5);
export const TESSERACT_EDGES = hypercubeEdges(4);
export const TESSERACT_SQUARES = hypercubeSquares(4);

export function transformPoints(points: Vec5[], rotation: Mat5, origin: Vec5): Vec5[] {
  return points.map((p) => {
    const t = rotation.multiplyVec(p);
    t.add(origin);
    return t;
  });
}

function coord(p: Vec5, axis: 3 | 4): number {
  return axis === 3 ? p.w : p.v;
}

function addUnique(map: Map<string, number>, verts: Vec5[], p: Vec5): number {
  const key = p
    .toArray()
    .map((n) => n.toFixed(5))
    .join(",");
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const idx = verts.length;
  verts.push(p.clone());
  map.set(key, idx);
  return idx;
}

function intersectEdge(
  a: Vec5,
  b: Vec5,
  axis: 3 | 4,
  value: number,
  map: Map<string, number>,
  verts: Vec5[],
  eps: number,
): number | null {
  const va = coord(a, axis);
  const vb = coord(b, axis);
  if (Math.abs(va - value) <= eps && Math.abs(vb - value) <= eps) {
    return null;
  }
  if (Math.abs(va - value) <= eps) return addUnique(map, verts, a);
  if (Math.abs(vb - value) <= eps) return addUnique(map, verts, b);
  if ((va - value) * (vb - value) < 0) {
    const t = (value - va) / (vb - va);
    return addUnique(map, verts, new Vec5().lerpVectors(a, b, t));
  }
  return null;
}

/**
 * Exact hyperplane slice of a convex polytope given square faces.
 * Intersecting with W=const or V=const drops one dimension.
 */
export function sliceByHyperplane(
  verts: Vec5[],
  squares: Quad[],
  axis: 3 | 4,
  value: number,
  eps = 1e-7,
): { verts: Vec5[]; edges: Edge[] } {
  const outVerts: Vec5[] = [];
  const map = new Map<string, number>();
  const outEdges: Edge[] = [];
  const seen = new Set<string>();

  const pushEdge = (i: number, j: number) => {
    if (i === j) return;
    const lo = Math.min(i, j);
    const hi = Math.max(i, j);
    const k = `${lo}:${hi}`;
    if (seen.has(k)) return;
    seen.add(k);
    outEdges.push([lo, hi]);
  };

  for (const sq of squares) {
    const hits: number[] = [];
    const pairs: Array<[number, number]> = [
      [sq[0], sq[1]],
      [sq[1], sq[2]],
      [sq[2], sq[3]],
      [sq[3], sq[0]],
    ];
    for (const [ia, ib] of pairs) {
      const pa = verts[ia];
      const pb = verts[ib];
      if (!pa || !pb) continue;
      const id = intersectEdge(pa, pb, axis, value, map, outVerts, eps);
      if (id !== null) hits.push(id);
    }
    const uniq = [...new Set(hits)];
    if (uniq.length === 2) {
      pushEdge(uniq[0]!, uniq[1]!);
    } else if (uniq.length > 2) {
      for (let i = 0; i < uniq.length; i++) {
        pushEdge(uniq[i]!, uniq[(i + 1) % uniq.length]!);
      }
    }
  }

  return { verts: outVerts, edges: outEdges };
}

export interface Slice3 {
  points: Vec5[];
  edges: Array<[Vec5, Vec5]>;
}

function intersectEdgesAtV(verts: Vec5[], edges: Edge[], sliceV: number, eps = 1e-7): Slice3 {
  const points: Vec5[] = [];
  const map = new Map<string, number>();
  const sliceEdges: Array<[Vec5, Vec5]> = [];

  for (const [i, j] of edges) {
    const a = verts[i];
    const b = verts[j];
    if (!a || !b) continue;
    const va = a.v;
    const vb = b.v;
    if (Math.abs(va - sliceV) <= eps && Math.abs(vb - sliceV) <= eps) {
      addUnique(map, points, a);
      addUnique(map, points, b);
      sliceEdges.push([a.clone(), b.clone()]);
      continue;
    }
    if ((va - sliceV) * (vb - sliceV) < 0) {
      const t = (sliceV - va) / (vb - va);
      addUnique(map, points, new Vec5().lerpVectors(a, b, t));
    } else if (Math.abs(va - sliceV) <= eps) {
      addUnique(map, points, a);
    } else if (Math.abs(vb - sliceV) <= eps) {
      addUnique(map, points, b);
    }
  }

  return { points, edges: sliceEdges };
}

/**
 * Exact 3D cross-section of a 4-cube or 5-cube at the observer's (W, V).
 * Tesseract: slice W (V is identically 0).
 * Penteract: slice W, then V.
 */
export function sliceHypercubeTo3D(
  dimensions: 4 | 5,
  half: number,
  rotation: Mat5,
  origin: Vec5,
  sliceW: number,
  sliceV: number,
): Slice3 {
  const verts = transformPoints(hypercubeVertices(dimensions, half), rotation, origin);
  const squares = dimensions === 5 ? PENTERACT_SQUARES : TESSERACT_SQUARES;
  const afterW = sliceByHyperplane(verts, squares, 3, sliceW);
  if (dimensions === 4) {
    return {
      points: afterW.verts,
      edges: afterW.edges.map(([i, j]) => [afterW.verts[i]!, afterW.verts[j]!]),
    };
  }
  return intersectEdgesAtV(afterW.verts, afterW.edges, sliceV);
}

/**
 * 3-ball radius of the W=const, V=const slice of a 4-sphere (hypersphere in R^5).
 * Exact: r³ = sqrt(R² − Δw² − Δv²), or 0 if the 3-flat misses the 5-ball.
 */
export function hypersphereSliceRadius(radius: number, dw: number, dv: number): number {
  const r2 = radius * radius - dw * dw - dv * dv;
  return r2 > 1e-8 ? Math.sqrt(r2) : 0;
}

export function closestPointAabb(p: Vec5, min: Vec5, max: Vec5, target = new Vec5()): Vec5 {
  target.x = Math.min(Math.max(p.x, min.x), max.x);
  target.y = Math.min(Math.max(p.y, min.y), max.y);
  target.z = Math.min(Math.max(p.z, min.z), max.z);
  target.w = Math.min(Math.max(p.w, min.w), max.w);
  target.v = Math.min(Math.max(p.v, min.v), max.v);
  return target;
}

export function aabbContains(p: Vec5, min: Vec5, max: Vec5, pad = 0): boolean {
  return (
    p.x >= min.x - pad &&
    p.x <= max.x + pad &&
    p.y >= min.y - pad &&
    p.y <= max.y + pad &&
    p.z >= min.z - pad &&
    p.z <= max.z + pad &&
    p.w >= min.w - pad &&
    p.w <= max.w + pad &&
    p.v >= min.v - pad &&
    p.v <= max.v + pad
  );
}

export function aabbIntersectsSlice(
  min: Vec5,
  max: Vec5,
  sliceW: number,
  sliceV: number,
  thicknessW: number,
  thicknessV: number,
): boolean {
  return (
    sliceW + thicknessW >= min.w &&
    sliceW - thicknessW <= max.w &&
    sliceV + thicknessV >= min.v &&
    sliceV - thicknessV <= max.v
  );
}

export function boxMinMax(center: Vec5, half: Vec5): { min: Vec5; max: Vec5 } {
  return {
    min: new Vec5(center.x - half.x, center.y - half.y, center.z - half.z, center.w - half.w, center.v - half.v),
    max: new Vec5(center.x + half.x, center.y + half.y, center.z + half.z, center.w + half.w, center.v + half.v),
  };
}
