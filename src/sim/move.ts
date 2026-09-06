import { InputState } from "../input/controls";
import { Vec5 } from "../math/vec5";
import type { PlayerState } from "./types";

export function lookVector(player: PlayerState, target = new Vec5()): Vec5 {
  const cy = Math.cos(player.pitch);
  return target.set(
    Math.sin(player.yaw) * cy,
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * cy,
    0,
    0,
  );
}

export function applyLook(player: PlayerState, dx: number, dy: number, sensitivity: number): void {
  player.yaw -= dx * sensitivity;
  player.pitch -= dy * sensitivity;
  const lim = Math.PI / 2 - 0.05;
  player.pitch = Math.min(lim, Math.max(-lim, player.pitch));
}

export function movePlayer(player: PlayerState, input: InputState, dt: number): Vec5 {
  const speed = player.speed * (input.sprint ? 1.7 : 1);
  const fx = Math.sin(player.yaw);
  const fz = -Math.cos(player.yaw);
  const rx = Math.cos(player.yaw);
  const rz = Math.sin(player.yaw);
  let mx = 0;
  let mz = 0;
  if (input.forward) {
    mx += fx;
    mz += fz;
  }
  if (input.back) {
    mx -= fx;
    mz -= fz;
  }
  if (input.right) {
    mx += rx;
    mz += rz;
  }
  if (input.left) {
    mx -= rx;
    mz -= rz;
  }
  const len = Math.hypot(mx, mz);
  if (len > 1e-6) {
    mx = (mx / len) * speed * dt;
    mz = (mz / len) * speed * dt;
  }
  player.pos.x += mx;
  player.pos.z += mz;
  if (input.up) player.pos.y += speed * dt;
  if (input.down) player.pos.y -= speed * dt;
  const dw = (Number(input.wPos) - Number(input.wNeg)) * player.wSpeed * dt;
  const dv = (Number(input.vPos) - Number(input.vNeg)) * player.wSpeed * dt;
  player.pos.w += dw;
  player.pos.v += dv;
  return new Vec5(mx, 0, mz, dw, dv);
}
