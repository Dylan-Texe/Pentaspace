import { Vec5 } from "./vec5";

/** 5×5 real matrix, column-major. Used for linear 5D transforms (rotations, scales). */
export class Mat5 {
  readonly e: Float64Array;

  constructor(values?: ArrayLike<number>) {
    this.e = new Float64Array(25);
    if (values) {
      this.e.set(values);
    } else {
      this.identity();
    }
  }

  static identity(): Mat5 {
    return new Mat5().identity();
  }

  identity(): this {
    this.e.fill(0);
    this.e[0] = 1;
    this.e[6] = 1;
    this.e[12] = 1;
    this.e[18] = 1;
    this.e[24] = 1;
    return this;
  }

  clone(): Mat5 {
    return new Mat5(this.e);
  }

  copy(m: Mat5): this {
    this.e.set(m.e);
    return this;
  }

  /**
   * Rotation in the plane spanned by unit axes i and j (0=X … 4=V).
   * There are C(5,2)=10 independent rotation planes in 5D.
   */
  static planeRotation(i: number, j: number, angle: number): Mat5 {
    const m = Mat5.identity();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m.set(i, i, c);
    m.set(j, j, c);
    m.set(i, j, -s);
    m.set(j, i, s);
    return m;
  }

  get(row: number, col: number): number {
    return this.e[col * 5 + row] ?? 0;
  }

  set(row: number, col: number, value: number): this {
    this.e[col * 5 + row] = value;
    return this;
  }

  multiply(b: Mat5): this {
    const a = this.e;
    const c = b.e;
    const out = new Float64Array(25);
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        let sum = 0;
        for (let k = 0; k < 5; k++) {
          sum += a[k * 5 + row]! * c[col * 5 + k]!;
        }
        out[col * 5 + row] = sum;
      }
    }
    this.e.set(out);
    return this;
  }

  premultiply(a: Mat5): this {
    const result = a.clone().multiply(this);
    this.e.set(result.e);
    return this;
  }

  multiplyVec(v: Vec5, target = new Vec5()): Vec5 {
    const x = v.x;
    const y = v.y;
    const z = v.z;
    const w = v.w;
    const vv = v.v;
    const e = this.e;
    target.x = e[0]! * x + e[5]! * y + e[10]! * z + e[15]! * w + e[20]! * vv;
    target.y = e[1]! * x + e[6]! * y + e[11]! * z + e[16]! * w + e[21]! * vv;
    target.z = e[2]! * x + e[7]! * y + e[12]! * z + e[17]! * w + e[22]! * vv;
    target.w = e[3]! * x + e[8]! * y + e[13]! * z + e[18]! * w + e[23]! * vv;
    target.v = e[4]! * x + e[9]! * y + e[14]! * z + e[19]! * w + e[24]! * vv;
    return target;
  }

  transpose(): this {
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        const a = this.get(i, j);
        this.set(i, j, this.get(j, i));
        this.set(j, i, a);
      }
    }
    return this;
  }

  /** Inverse of a rotation matrix is its transpose. */
  invertRotation(): this {
    return this.transpose();
  }
}

export const PLANE_NAMES = [
  "XY",
  "XZ",
  "XW",
  "XV",
  "YZ",
  "YW",
  "YV",
  "ZW",
  "ZV",
  "WV",
] as const;

export const PLANE_INDICES: Record<(typeof PLANE_NAMES)[number], [number, number]> = {
  XY: [0, 1],
  XZ: [0, 2],
  XW: [0, 3],
  XV: [0, 4],
  YZ: [1, 2],
  YW: [1, 3],
  YV: [1, 4],
  ZW: [2, 3],
  ZV: [2, 4],
  WV: [3, 4],
};
