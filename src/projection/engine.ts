import { Vec5 } from "../math/vec5";

export type ProjectionMode = "perspective" | "orthographic" | "slice" | "combined";

export interface ProjectionSettings {
  mode: ProjectionMode;
  /** Perspective vanishing distance along W (4D→3D step). */
  distanceW: number;
  /** Perspective vanishing distance along V (5D→4D step). */
  distanceV: number;
  /** Half-thickness of the W slice (exact 3-flat has measure zero). */
  thicknessW: number;
  /** Half-thickness of the V slice. */
  thicknessV: number;
  /**
   * Artistic: faint XYZ shear from W/V in orthographic/combined views.
   * Not a claim about 5D vision — a diagrammatic overlay.
   */
  artisticShear: boolean;
  shearW: number;
  shearV: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
  /** Perspective scale factor (1 for ortho/slice). */
  scale: number;
  /** Distance in the hidden dimensions, for fading. */
  hiddenDist: number;
  dw: number;
  dv: number;
  visible: boolean;
}

function clampScale(s: number): number {
  if (!Number.isFinite(s)) return 8;
  return Math.min(8, Math.max(-8, s));
}

function perspectivePair(rel: Vec5, dW: number, dV: number): { x: number; y: number; z: number; scale: number } {
  const denomV = dV - rel.v;
  const sV = Math.abs(denomV) < 0.08 ? Math.sign(denomV || 1) * 12 : dV / denomV;
  const x4 = rel.x * sV;
  const y4 = rel.y * sV;
  const z4 = rel.z * sV;
  const w4 = rel.w * sV;
  const denomW = dW - w4;
  const sW = Math.abs(denomW) < 0.08 ? Math.sign(denomW || 1) * 12 : dW / denomW;
  const scale = clampScale(sV * sW);
  return {
    x: x4 * sW,
    y: y4 * sW,
    z: z4 * sW,
    scale,
  };
}

/**
 * Maps a 5D point (relative to the observer) into camera 3-space.
 * This is a visualization map, not "what a 5D retina would see".
 */
export function projectRelative(rel: Vec5, settings: ProjectionSettings): ProjectedPoint {
  const dw = rel.w;
  const dv = rel.v;
  const hiddenDist = Math.hypot(dw, dv);
  const inSlice =
    Math.abs(dw) <= settings.thicknessW && Math.abs(dv) <= settings.thicknessV;

  if (settings.mode === "slice") {
    return {
      x: rel.x,
      y: rel.y,
      z: rel.z,
      scale: 1,
      hiddenDist,
      dw,
      dv,
      visible: inSlice,
    };
  }

  if (settings.mode === "orthographic") {
    let x = rel.x;
    let y = rel.y;
    let z = rel.z;
    if (settings.artisticShear) {
      x += dw * settings.shearW + dv * settings.shearV;
      z += dw * settings.shearW * 0.35 - dv * settings.shearV * 0.5;
    }
    return { x, y, z, scale: 1, hiddenDist, dw, dv, visible: true };
  }

  const persp = perspectivePair(rel, settings.distanceW, settings.distanceV);

  if (settings.mode === "combined") {
    const fade = inSlice ? 1 : Math.max(0.12, 1 - hiddenDist / 8);
    return {
      x: persp.x,
      y: persp.y,
      z: persp.z,
      scale: persp.scale * (0.55 + 0.45 * fade),
      hiddenDist,
      dw,
      dv,
      visible: true,
    };
  }

  return {
    x: persp.x,
    y: persp.y,
    z: persp.z,
    scale: persp.scale,
    hiddenDist,
    dw,
    dv,
    visible: true,
  };
}

export function sliceWeight(dw: number, dv: number, settings: ProjectionSettings): number {
  const nw = 1 - Math.min(1, Math.abs(dw) / Math.max(settings.thicknessW, 1e-4));
  const nv = 1 - Math.min(1, Math.abs(dv) / Math.max(settings.thicknessV, 1e-4));
  if (settings.mode === "slice") return Math.max(0, nw) * Math.max(0, nv);
  if (settings.mode === "combined") {
    const hard = Math.max(0, nw) * Math.max(0, nv);
    return 0.25 + 0.75 * hard;
  }
  return 1;
}

export function defaultProjection(): ProjectionSettings {
  return {
    mode: "combined",
    distanceW: 3.2,
    distanceV: 3.2,
    thicknessW: 0.85,
    thicknessV: 0.85,
    artisticShear: false,
    shearW: 0.22,
    shearV: 0.16,
  };
}
