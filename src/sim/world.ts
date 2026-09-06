import { aabbContains } from "../math/geometry5";
import { Vec5 } from "../math/vec5";
import {
  applyGravitySources,
  collideObjects,
  collidePlayer,
  integrate,
  spinObject,
} from "./physics";
import { createPlayer, type PlayerState, type WorldObject } from "./types";

export interface SimParticle {
  pos: Vec5;
  vel: Vec5;
  life: number;
  hue: number;
}

export class World {
  objects: WorldObject[] = [];
  particles: SimParticle[] = [];
  gravity = new Vec5(0, -9.81, 0, 0, 0);
  time = 0;
  paused = false;
  speed = 1;
  experimentId = "room";
  note = "";
  objective = "";
  mathNote = "";
  portalLock = 0;

  add(obj: WorldObject): WorldObject {
    this.objects.push(obj);
    return obj;
  }

  clear(): void {
    this.objects = [];
    this.particles = [];
    this.time = 0;
    this.portalLock = 0;
    this.gravity.set(0, -9.81, 0, 0, 0);
  }

  get(id: string): WorldObject | undefined {
    return this.objects.find((o) => o.id === id);
  }

  remove(id: string): void {
    this.objects = this.objects.filter((o) => o.id !== id && o.parentId !== id);
  }

  step(dt: number, player: PlayerState): void {
    if (this.paused) return;
    const t = dt * this.speed;
    this.time += t;
    this.portalLock = Math.max(0, this.portalLock - t);

    for (const obj of this.objects) {
      if (obj.parentId && obj.localOffset) {
        const parent = this.get(obj.parentId);
        if (parent) {
          obj.pos.copy(parent.pos).add(parent.rotation.multiplyVec(obj.localOffset));
        }
      }
      spinObject(obj, t);
      if (obj.id === player.heldId) continue;
      applyGravitySources(this.objects, obj, t);
      integrate(obj, this.gravity, t);
    }

    collideObjects(this.objects);
    this.stepParticles(t);
    this.tickPortals(player);
  }

  stepParticles(t: number): void {
    for (const p of this.particles) {
      p.vel.addScaled(this.gravity, t * 0.15);
      p.pos.addScaled(p.vel, t);
      p.life -= t;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 220) this.particles.length = 220;
  }

  emit(pos: Vec5, vel: Vec5, life: number, hue: number): void {
    this.particles.push({ pos: pos.clone(), vel: vel.clone(), life, hue });
  }

  tickPortals(player: PlayerState): void {
    if (this.portalLock > 0) return;
    for (const portal of this.objects) {
      if (portal.kind !== "portal" || !portal.portalPairId) continue;
      const other = this.get(portal.portalPairId);
      if (!other) continue;
      const reach = Math.max(portal.size.x, 1.2);
      if (player.pos.distanceTo(portal.pos) < reach) {
        const dir = other.pos.clone().sub(portal.pos);
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1.5, 0, 0);
        dir.normalize();
        player.pos.copy(other.pos).addScaled(dir, 2.2);
        this.portalLock = 1.1;
        for (let i = 0; i < 24; i++) {
          const jitter = new Vec5(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
          );
          this.emit(other.pos, jitter, 1.2, 0.55);
        }
        break;
      }
    }
  }

  inside(pos: Vec5, obj: WorldObject): boolean {
    const min = new Vec5(
      obj.pos.x - obj.size.x,
      obj.pos.y - obj.size.y,
      obj.pos.z - obj.size.z,
      obj.pos.w - obj.size.w,
      obj.pos.v - obj.size.v,
    );
    const max = new Vec5(
      obj.pos.x + obj.size.x,
      obj.pos.y + obj.size.y,
      obj.pos.z + obj.size.z,
      obj.pos.w + obj.size.w,
      obj.pos.v + obj.size.v,
    );
    return aabbContains(pos, min, max);
  }
}

export function collideAndMove(world: World, player: PlayerState): void {
  collidePlayer(player, world.objects);
}

export { createPlayer };
