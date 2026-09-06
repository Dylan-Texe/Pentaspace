import { Mat5, PLANE_INDICES, PLANE_NAMES } from "./mat5";

export type PlaneName = (typeof PLANE_NAMES)[number];

/** Composable 5D orientation as a product of plane rotations. */
export class Rotation5 {
  matrix = Mat5.identity();

  reset(): this {
    this.matrix.identity();
    return this;
  }

  rotate(plane: PlaneName, angle: number): this {
    const [i, j] = PLANE_INDICES[plane];
    this.matrix.premultiply(Mat5.planeRotation(i, j, angle));
    return this;
  }

  copy(other: Rotation5): this {
    this.matrix.copy(other.matrix);
    return this;
  }

  clone(): Rotation5 {
    const r = new Rotation5();
    r.matrix.copy(this.matrix);
    return r;
  }
}
