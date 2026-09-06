import { Vec5 } from "../math/vec5";
import { makeObject, type ObjectKind, type WorldObject } from "../sim/types";
import type { World } from "../sim/world";

export function addBox(
  world: World,
  name: string,
  pos: Vec5,
  half: Vec5,
  color: number,
  extra: Partial<WorldObject> = {},
): WorldObject {
  return world.add(
    makeObject({
      kind: extra.kind ?? "wall",
      name,
      pos,
      size: half,
      color,
      emissive: extra.emissive ?? 0x071018,
      kinematic: extra.kinematic ?? true,
      collidable: extra.collidable ?? true,
      selectable: extra.selectable ?? true,
      pickupable: extra.pickupable ?? false,
      opacity: extra.opacity ?? 0.94,
      note: extra.note ?? "",
      exactMath: extra.exactMath ?? true,
      ...extra,
    }),
  );
}

export function addBall(
  world: World,
  name: string,
  pos: Vec5,
  radius: number,
  color: number,
  extra: Partial<WorldObject> = {},
): WorldObject {
  const r = new Vec5(radius, radius, radius, radius, radius);
  return world.add(
    makeObject({
      kind: extra.kind ?? "hypersphere",
      name,
      pos,
      size: r,
      color,
      emissive: extra.emissive ?? 0x102028,
      kinematic: extra.kinematic ?? false,
      collidable: extra.collidable ?? true,
      pickupable: extra.pickupable ?? true,
      mass: extra.mass ?? 1.2,
      note: extra.note ?? "4-sphere in R⁵. 3D slice radius is √(R²−Δw²−Δv²).",
      exactMath: true,
      ...extra,
    }),
  );
}

export function addPenteract(
  world: World,
  name: string,
  pos: Vec5,
  half: number,
  color: number,
  extra: Partial<WorldObject> = {},
): WorldObject {
  return world.add(
    makeObject({
      kind: "penteract",
      name,
      pos,
      size: new Vec5(half, half, half, half, half),
      color,
      emissive: extra.emissive ?? 0x201030,
      kinematic: extra.kinematic ?? true,
      collidable: extra.collidable ?? false,
      pickupable: extra.pickupable ?? true,
      spinPlanes: extra.spinPlanes ?? [],
      note: extra.note ?? "5-cube (32 vertices, 80 edges). Wireframe uses exact vertex projection; solid uses exact W then V slices.",
      exactMath: true,
      ...extra,
    }),
  );
}

export function addTesseract(
  world: World,
  name: string,
  pos: Vec5,
  half: number,
  color: number,
  extra: Partial<WorldObject> = {},
): WorldObject {
  return world.add(
    makeObject({
      kind: "hypercube",
      name,
      pos,
      size: new Vec5(half, half, half, half, 0.02),
      color,
      emissive: extra.emissive ?? 0x102018,
      kinematic: extra.kinematic ?? true,
      collidable: extra.collidable ?? false,
      pickupable: extra.pickupable ?? true,
      spinPlanes: extra.spinPlanes ?? [{ plane: "XW", speed: 0.35 }],
      note: extra.note ?? "4-cube (tesseract) embedded in 5D with near-zero V extent.",
      exactMath: true,
      ...extra,
    }),
  );
}

export function addPortalPair(world: World, a: Vec5, b: Vec5, nameA = "Portal A", nameB = "Portal B"): void {
  const p1 = makeObject({
    kind: "portal",
    name: nameA,
    pos: a,
    size: new Vec5(1.25, 1.25, 1.25, 1.25, 1.25),
    color: 0x3cf0ff,
    emissive: 0x0a5a70,
    collidable: false,
    kinematic: true,
    pickupable: false,
    note: "Identifies two points of 5D space. Crossing A sets player position to B. Exact teleport, artistic ring.",
    exactMath: true,
  });
  const p2 = makeObject({
    kind: "portal",
    name: nameB,
    pos: b,
    size: new Vec5(1.25, 1.25, 1.25, 1.25, 1.25),
    color: 0xff5ad5,
    emissive: 0x5a1050,
    collidable: false,
    kinematic: true,
    pickupable: false,
    note: "Portal exit. 5D destination of Portal A.",
    exactMath: true,
  });
  p1.portalPairId = p2.id;
  p2.portalPairId = p1.id;
  world.add(p1);
  world.add(p2);
}

export function addGrid(world: World): void {
  world.add(
    makeObject({
      kind: "grid",
      name: "5D lattice",
      pos: new Vec5(),
      size: new Vec5(24, 24, 24, 6, 6),
      color: 0x1e3a4a,
      collidable: false,
      selectable: false,
      kinematic: true,
      note: "Diagrammatic lattice. XYZ lines at several W slices; not a physical 5-manifold mesh.",
      exactMath: false,
    }),
  );
}

const FLOOR = 0x2a3544;
const WALL = 0x4a627c;
const WALL_W = 0x3a2450;
const WALL_V = 0x4a3820;
const TRIM = 0x2c3d52;

export function shell(
  world: World,
  c: Vec5,
  half: Vec5,
  t: number,
  color = WALL,
  kind: ObjectKind = "room",
): void {
  const { x, y, z, w, v } = c;
  addBox(world, "floor", new Vec5(x, y - half.y, z, w, v), new Vec5(half.x, t, half.z, half.w, half.v), FLOOR, { kind });
  addBox(world, "ceiling", new Vec5(x, y + half.y, z, w, v), new Vec5(half.x, t, half.z, half.w, half.v), TRIM, { kind });
  addBox(world, "wall −Z", new Vec5(x, y, z - half.z, w, v), new Vec5(half.x, half.y, t, half.w, half.v), color, { kind });
  addBox(world, "wall +Z", new Vec5(x, y, z + half.z, w, v), new Vec5(half.x, half.y, t, half.w, half.v), color, { kind });
  addBox(world, "wall −X", new Vec5(x - half.x, y, z, w, v), new Vec5(t, half.y, half.z, half.w, half.v), color, { kind });
  addBox(world, "wall +X", new Vec5(x + half.x, y, z, w, v), new Vec5(t, half.y, half.z, half.w, half.v), color, { kind });
}

export function doorwayNorth(
  world: World,
  c: Vec5,
  half: Vec5,
  t: number,
  doorHalfW: number,
  color = WALL,
): void {
  const y = c.y;
  const wallZ = c.z - half.z;
  const side = (half.x - doorHalfW) / 2;
  addBox(
    world,
    "door-left",
    new Vec5(c.x - doorHalfW - side, y, wallZ, c.w, c.v),
    new Vec5(side, half.y, t, half.w, half.v),
    color,
    { kind: "door" },
  );
  addBox(
    world,
    "door-right",
    new Vec5(c.x + doorHalfW + side, y, wallZ, c.w, c.v),
    new Vec5(side, half.y, t, half.w, half.v),
    color,
    { kind: "door" },
  );
  addBox(
    world,
    "door-lintel",
    new Vec5(c.x, y + half.y - 0.6, wallZ, c.w, c.v),
    new Vec5(doorHalfW, 0.6, t, half.w, half.v),
    color,
    { kind: "door" },
  );
}

export { FLOOR, WALL, WALL_W, WALL_V, TRIM };
