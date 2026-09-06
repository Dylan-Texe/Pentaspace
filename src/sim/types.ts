import { Mat5 } from "../math/mat5";
import { Vec5 } from "../math/vec5";

export type ObjectKind =
  | "sphere"
  | "hypersphere"
  | "cube"
  | "hypercube"
  | "penteract"
  | "plane"
  | "grid"
  | "particle"
  | "corridor"
  | "room"
  | "door"
  | "portal"
  | "creature"
  | "wall"
  | "gravity-source"
  | "goal";

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  name: string;
  pos: Vec5;
  vel: Vec5;
  acc: Vec5;
  mass: number;
  /** Balls: radius on each axis (usually uniform). Boxes: half-extents. */
  size: Vec5;
  rotation: Mat5;
  color: number;
  emissive: number;
  opacity: number;
  kinematic: boolean;
  collidable: boolean;
  selectable: boolean;
  pickupable: boolean;
  restitution: number;
  /** Linked portal id. */
  portalPairId?: string;
  /** Creature / notes. */
  note: string;
  /** Spin in 5D (plane rotations per second). */
  spinPlanes: Array<{ plane: "XW" | "YW" | "ZW" | "XV" | "YV" | "ZV" | "WV" | "XY" | "XZ" | "YZ"; speed: number }>;
  /** If set, this is a compound child offset in local 5D. */
  parentId?: string;
  localOffset?: Vec5;
  /** Particle count for particle systems. */
  particleCount?: number;
  /** Label for HUD. */
  exactMath: boolean;
}

export interface PlayerState {
  pos: Vec5;
  vel: Vec5;
  yaw: number;
  pitch: number;
  radius: number;
  eyeHeight: number;
  speed: number;
  wSpeed: number;
  heldId: string | null;
  noclip: boolean;
}

export function createPlayer(): PlayerState {
  return {
    pos: new Vec5(0, 1.7, 8, 0, 0),
    vel: new Vec5(),
    yaw: 0,
    pitch: 0,
    radius: 0.38,
    eyeHeight: 0,
    speed: 7.5,
    wSpeed: 3.2,
    heldId: null,
    noclip: false,
  };
}

let nextId = 1;
export function newId(prefix = "obj"): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

export function resetIds(): void {
  nextId = 1;
}

export function makeObject(partial: Partial<WorldObject> & Pick<WorldObject, "kind" | "name">): WorldObject {
  return {
    id: partial.id ?? newId(partial.kind),
    kind: partial.kind,
    name: partial.name,
    pos: partial.pos?.clone() ?? new Vec5(),
    vel: partial.vel?.clone() ?? new Vec5(),
    acc: partial.acc?.clone() ?? new Vec5(),
    mass: partial.mass ?? 1,
    size: partial.size?.clone() ?? new Vec5(1, 1, 1, 1, 1),
    rotation: partial.rotation?.clone() ?? Mat5.identity(),
    color: partial.color ?? 0x7ec8e3,
    emissive: partial.emissive ?? 0x102030,
    opacity: partial.opacity ?? 0.92,
    kinematic: partial.kinematic ?? true,
    collidable: partial.collidable ?? true,
    selectable: partial.selectable ?? true,
    pickupable: partial.pickupable ?? false,
    restitution: partial.restitution ?? 0.35,
    portalPairId: partial.portalPairId,
    note: partial.note ?? "",
    spinPlanes: partial.spinPlanes ? [...partial.spinPlanes] : [],
    parentId: partial.parentId,
    localOffset: partial.localOffset?.clone(),
    particleCount: partial.particleCount,
    exactMath: partial.exactMath ?? true,
  };
}
