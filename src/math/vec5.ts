/** 5-dimensional Euclidean vector. Core mathematical type — not a render object. */
export class Vec5 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
    public w = 0,
    public v = 0,
  ) {}

  static fromArray(a: ArrayLike<number>): Vec5 {
    return new Vec5(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0, a[4] ?? 0);
  }

  static readonly ZERO = new Vec5(0, 0, 0, 0, 0);

  clone(): Vec5 {
    return new Vec5(this.x, this.y, this.z, this.w, this.v);
  }

  set(x: number, y: number, z: number, w: number, v: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    this.v = v;
    return this;
  }

  copy(o: Vec5): this {
    this.x = o.x;
    this.y = o.y;
    this.z = o.z;
    this.w = o.w;
    this.v = o.v;
    return this;
  }

  add(o: Vec5): this {
    this.x += o.x;
    this.y += o.y;
    this.z += o.z;
    this.w += o.w;
    this.v += o.v;
    return this;
  }

  sub(o: Vec5): this {
    this.x -= o.x;
    this.y -= o.y;
    this.z -= o.z;
    this.w -= o.w;
    this.v -= o.v;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    this.w *= s;
    this.v *= s;
    return this;
  }

  addScaled(o: Vec5, s: number): this {
    this.x += o.x * s;
    this.y += o.y * s;
    this.z += o.z * s;
    this.w += o.w * s;
    this.v += o.v * s;
    return this;
  }

  dot(o: Vec5): number {
    return this.x * o.x + this.y * o.y + this.z * o.z + this.w * o.w + this.v * o.v;
  }

  lengthSq(): number {
    return this.dot(this);
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  normalize(): this {
    const len = this.length();
    if (len > 1e-12) this.scale(1 / len);
    return this;
  }

  distanceTo(o: Vec5): number {
    return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z, this.w - o.w, this.v - o.v);
  }

  lerp(o: Vec5, t: number): this {
    this.x += (o.x - this.x) * t;
    this.y += (o.y - this.y) * t;
    this.z += (o.z - this.z) * t;
    this.w += (o.w - this.w) * t;
    this.v += (o.v - this.v) * t;
    return this;
  }

  lerpVectors(a: Vec5, b: Vec5, t: number): this {
    this.x = a.x + (b.x - a.x) * t;
    this.y = a.y + (b.y - a.y) * t;
    this.z = a.z + (b.z - a.z) * t;
    this.w = a.w + (b.w - a.w) * t;
    this.v = a.v + (b.v - a.v) * t;
    return this;
  }

  min(o: Vec5): this {
    this.x = Math.min(this.x, o.x);
    this.y = Math.min(this.y, o.y);
    this.z = Math.min(this.z, o.z);
    this.w = Math.min(this.w, o.w);
    this.v = Math.min(this.v, o.v);
    return this;
  }

  max(o: Vec5): this {
    this.x = Math.max(this.x, o.x);
    this.y = Math.max(this.y, o.y);
    this.z = Math.max(this.z, o.z);
    this.w = Math.max(this.w, o.w);
    this.v = Math.max(this.v, o.v);
    return this;
  }

  abs(): this {
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);
    this.z = Math.abs(this.z);
    this.w = Math.abs(this.w);
    this.v = Math.abs(this.v);
    return this;
  }

  component(i: number): number {
    switch (i) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      case 3:
        return this.w;
      case 4:
        return this.v;
      default:
        return 0;
    }
  }

  setComponent(i: number, value: number): this {
    switch (i) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      case 3:
        this.w = value;
        break;
      case 4:
        this.v = value;
        break;
    }
    return this;
  }

  toArray(): [number, number, number, number, number] {
    return [this.x, this.y, this.z, this.w, this.v];
  }

  equals(o: Vec5, eps = 1e-9): boolean {
    return (
      Math.abs(this.x - o.x) <= eps &&
      Math.abs(this.y - o.y) <= eps &&
      Math.abs(this.z - o.z) <= eps &&
      Math.abs(this.w - o.w) <= eps &&
      Math.abs(this.v - o.v) <= eps
    );
  }

  format(digits = 2): string {
    return this.toArray()
      .map((n) => n.toFixed(digits))
      .join("  ");
  }
}

export const AXES = ["X", "Y", "Z", "W", "V"] as const;
export type AxisName = (typeof AXES)[number];
