import { boxMinMax, closestPointAabb, hypersphereSliceRadius } from "../math/geometry5";
import { Mat5, PLANE_INDICES } from "../math/mat5";
import { Vec5 } from "../math/vec5";
import type { PlayerState, WorldObject } from "./types";

const closest = new Vec5();
const delta = new Vec5();
const push = new Vec5();

export function isBall(kind: WorldObject["kind"]): boolean {
  return (
    kind === "sphere" ||
    kind === "hypersphere" ||
    kind === "creature" ||
    kind === "goal" ||
    kind === "particle"
  );
}

export function isSolidBox(kind: WorldObject["kind"]): boolean {
  return (
    kind === "cube" ||
    kind === "plane" ||
    kind === "corridor" ||
    kind === "room" ||
    kind === "door" ||
    kind === "wall"
  );
}

export function sphereRadius(obj: WorldObject): number {
  return Math.max(obj.size.x, obj.size.y, obj.size.z, obj.size.w, obj.size.v);
}

function aabbInterior(p: Vec5, min: Vec5, max: Vec5): boolean {
  return (
    p.x > min.x &&
    p.x < max.x &&
    p.y > min.y &&
    p.y < max.y &&
    p.z > min.z &&
    p.z < max.z &&
    p.w > min.w &&
    p.w < max.w &&
    p.v > min.v &&
    p.v < max.v
  );
}

function escapeAabb(pos: Vec5, min: Vec5, max: Vec5, radius: number): void {
  const gaps: Array<{ axis: number; dir: number; dist: number }> = [
    { axis: 0, dir: -1, dist: pos.x - min.x },
    { axis: 0, dir: 1, dist: max.x - pos.x },
    { axis: 1, dir: -1, dist: pos.y - min.y },
    { axis: 1, dir: 1, dist: max.y - pos.y },
    { axis: 2, dir: -1, dist: pos.z - min.z },
    { axis: 2, dir: 1, dist: max.z - pos.z },
    { axis: 3, dir: -1, dist: pos.w - min.w },
    { axis: 3, dir: 1, dist: max.w - pos.w },
    { axis: 4, dir: -1, dist: pos.v - min.v },
    { axis: 4, dir: 1, dist: max.v - pos.v },
  ];
  let best = gaps[0]!;
  for (const g of gaps) {
    if (g.dist < best.dist) best = g;
  }
  pos.setComponent(best.axis, pos.component(best.axis) + best.dir * (best.dist + radius + 1e-4));
}

export function resolveSphereAabb(pos: Vec5, radius: number, min: Vec5, max: Vec5): boolean {
  closestPointAabb(pos, min, max, closest);
  delta.copy(pos).sub(closest);
  const d2 = delta.lengthSq();
  if (d2 < 1e-12) {
    if (aabbInterior(pos, min, max)) {
      escapeAabb(pos, min, max, radius);
      return true;
    }
    return false;
  }
  if (d2 >= radius * radius) return false;
  const d = Math.sqrt(d2);
  push.copy(delta).scale((radius - d) / d);
  pos.add(push);
  return true;
}

function bounceNormal(vel: Vec5, normal: Vec5, restitution: number): void {
  const vn = vel.dot(normal);
  if (vn < 0) vel.addScaled(normal, -(1 + restitution) * vn);
}

export function collidePlayer(player: PlayerState, objects: WorldObject[]): void {
  if (player.noclip) return;
  for (const obj of objects) {
    if (!obj.collidable || obj.id === player.heldId) continue;
    if (obj.kind === "portal" || obj.kind === "grid" || obj.kind === "gravity-source") continue;
    if (isBall(obj.kind)) {
      const r = sphereRadius(obj) + player.radius;
      delta.copy(player.pos).sub(obj.pos);
      const d = delta.length();
      if (d > 1e-8 && d < r) {
        delta.scale((r - d) / d);
        player.pos.add(delta);
      }
    } else if (isSolidBox(obj.kind)) {
      const { min, max } = boxMinMax(obj.pos, obj.size);
      resolveSphereAabb(player.pos, player.radius, min, max);
    }
  }
}

export function collideObjects(objects: WorldObject[]): void {
  for (let i = 0; i < objects.length; i++) {
    const a = objects[i]!;
    if (a.kinematic || !a.collidable) continue;
    for (let j = 0; j < objects.length; j++) {
      if (i === j) continue;
      const b = objects[j]!;
      if (!b.collidable) continue;
      if (isBall(a.kind) && isBall(b.kind)) {
        const r = sphereRadius(a) + sphereRadius(b);
        delta.copy(a.pos).sub(b.pos);
        const d = delta.length();
        if (d > 1e-8 && d < r) {
          const n = delta.scale(1 / d);
          const pen = r - d;
          if (b.kinematic) {
            a.pos.addScaled(n, pen);
            bounceNormal(a.vel, n, a.restitution);
          } else {
            a.pos.addScaled(n, pen * 0.5);
            b.pos.addScaled(n, -pen * 0.5);
          }
        }
      } else if (isBall(a.kind) && isSolidBox(b.kind)) {
        const { min, max } = boxMinMax(b.pos, b.size);
        const before = a.pos.clone();
        if (resolveSphereAabb(a.pos, sphereRadius(a), min, max)) {
          delta.copy(a.pos).sub(before);
          if (delta.lengthSq() > 1e-10) bounceNormal(a.vel, delta.normalize(), a.restitution);
        }
      }
    }
  }
}

export function integrate(obj: WorldObject, gravity: Vec5, dt: number): void {
  if (obj.kinematic) return;
  obj.acc.copy(gravity);
  obj.vel.addScaled(obj.acc, dt);
  obj.vel.scale(Math.max(0, 1 - 0.12 * dt));
  obj.pos.addScaled(obj.vel, dt);
}

export function applyGravitySources(objects: WorldObject[], target: WorldObject, dt: number): void {
  if (target.kinematic) return;
  for (const src of objects) {
    if (src.kind !== "gravity-source") continue;
    delta.copy(src.pos).sub(target.pos);
    const d2 = Math.max(delta.lengthSq(), 0.35);
    const g = (src.mass * 8) / d2;
    delta.normalize().scale(g * dt);
    target.vel.add(delta);
  }
}

export function spinObject(obj: WorldObject, dt: number): void {
  for (const spin of obj.spinPlanes) {
    const [i, j] = PLANE_INDICES[spin.plane];
    obj.rotation.premultiply(Mat5.planeRotation(i, j, spin.speed * dt));
  }
}

export function ballSliceRadius(obj: WorldObject, observer: Vec5): number {
  return hypersphereSliceRadius(sphereRadius(obj), obj.pos.w - observer.w, obj.pos.v - observer.v);
}
