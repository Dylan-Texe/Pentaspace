import "./style.css";
import { loadExperiment } from "./experiments";
import { Controls } from "./input/controls";
import { Vec5 } from "./math/vec5";
import { defaultProjection, type ProjectionMode, type ProjectionSettings } from "./projection/engine";
import { LabRenderer } from "./render/view";
import { applyLook, lookVector, movePlayer } from "./sim/move";
import { makeObject, type WorldObject } from "./sim/types";
import { collideAndMove, createPlayer, World } from "./sim/world";
import { Hud } from "./ui/hud";

const canvas = document.querySelector<HTMLCanvasElement>("#viewport");
const hudRoot = document.querySelector<HTMLElement>("#hud");
if (!canvas || !hudRoot) throw new Error("Missing viewport or HUD root");

const world = new World();
const player = createPlayer();
const projection: ProjectionSettings = defaultProjection();
const view = new LabRenderer(canvas);
const look = new Vec5();
let selectedId: string | null = null;
let fps = 60;
let last = performance.now();
let frames = 0;
let fpsT = 0;
const dimFlash = { w: 0, v: 0 };
let pendingPortal: WorldObject | null = null;

function spawnAtLook(kind: string): void {
  lookVector(player, look);
  const pos = player.pos.clone().addScaled(look, 3.2);
  pos.y = Math.max(pos.y, 0.6);
  if (kind === "cube") {
    world.add(
      makeObject({
        kind: "cube",
        name: "Spawned 5D cube",
        pos,
        size: new Vec5(0.45, 0.45, 0.45, 0.45, 0.45),
        color: 0x7ef0ff,
        kinematic: false,
        pickupable: true,
        mass: 1,
        note: "AABB in R⁵.",
      }),
    );
  } else if (kind === "sphere") {
    world.add(
      makeObject({
        kind: "hypersphere",
        name: "Spawned 5-ball",
        pos,
        size: new Vec5(0.5, 0.5, 0.5, 0.5, 0.5),
        color: 0xff7ad9,
        kinematic: false,
        pickupable: true,
        note: "4-sphere in R⁵.",
      }),
    );
  } else if (kind === "penteract") {
    world.add(
      makeObject({
        kind: "penteract",
        name: "Spawned penteract",
        pos,
        size: new Vec5(0.7, 0.7, 0.7, 0.7, 0.7),
        color: 0xe2a6ff,
        kinematic: true,
        pickupable: true,
        spinPlanes: [{ plane: "XW", speed: 0.4 }],
        note: "5-cube.",
      }),
    );
  } else if (kind === "portal") {
    const a = makeObject({
      kind: "portal",
      name: "Sandbox portal A",
      pos,
      size: new Vec5(1.2, 1.2, 1.2, 1.2, 1.2),
      color: 0x3cf0ff,
      collidable: false,
      note: "Place a second portal with U.",
    });
    if (pendingPortal) {
      a.portalPairId = pendingPortal.id;
      pendingPortal.portalPairId = a.id;
      pendingPortal = null;
    } else {
      pendingPortal = a;
    }
    world.add(a);
  } else if (kind === "wall") {
    world.add(
      makeObject({
        kind: "wall",
        name: "Spawned wall",
        pos,
        size: new Vec5(2, 1.5, 0.15, 0.5, 0.5),
        color: 0x2c3d52,
      }),
    );
  } else if (kind === "gravity") {
    world.add(
      makeObject({
        kind: "gravity-source",
        name: "Spawned attractor",
        pos,
        size: new Vec5(0.4, 0.4, 0.4, 0.4, 0.4),
        color: 0xffffff,
        emissive: 0x8866ff,
        mass: 12,
        collidable: false,
        kinematic: true,
        pickupable: true,
        note: "Point mass in R⁵.",
      }),
    );
  } else if (kind === "particles") {
    for (let i = 0; i < 40; i++) {
      world.emit(
        pos.clone().add(
          new Vec5(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
          ),
        ),
        new Vec5(
          (Math.random() - 0.5) * 3,
          Math.random() * 2,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
        ),
        4 + Math.random() * 3,
        Math.random(),
      );
    }
  }
}

function grab(): void {
  if (player.heldId) {
    drop();
    return;
  }
  const id = selectedId ?? view.pickId();
  if (!id) return;
  const obj = world.get(id);
  if (!obj?.pickupable) return;
  player.heldId = id;
  obj.kinematic = true;
  obj.vel.set(0, 0, 0, 0, 0);
}

function drop(): void {
  const obj = player.heldId ? world.get(player.heldId) : undefined;
  player.heldId = null;
  if (obj && obj.kind !== "penteract" && obj.kind !== "hypercube" && obj.kind !== "portal") {
    obj.kinematic = false;
  }
}

function throwHeld(): void {
  const obj = player.heldId ? world.get(player.heldId) : undefined;
  if (!obj) {
    selectedId = view.pickId();
    return;
  }
  lookVector(player, look);
  obj.kinematic = false;
  obj.vel.copy(look).scale(14);
  player.heldId = null;
}

function holdTick(): void {
  const obj = player.heldId ? world.get(player.heldId) : undefined;
  if (!obj) return;
  lookVector(player, look);
  obj.pos.copy(player.pos).addScaled(look, 2.4);
  obj.vel.set(0, 0, 0, 0, 0);
}

const hud = new Hud(hudRoot, {
  setMode: (m) => {
    projection.mode = m;
  },
  setExperiment: (id) => {
    selectedId = null;
    pendingPortal = null;
    loadExperiment(id, world, player);
    view.clear();
  },
  togglePause: () => {
    world.paused = !world.paused;
  },
  setSpeed: (s) => {
    world.speed = s;
  },
  setGravity: (axis, value) => {
    world.gravity.setComponent(axis, value);
  },
  setProj: (key, value) => {
    (projection[key] as number | boolean | ProjectionMode) = value as never;
  },
  reset: () => {
    loadExperiment(world.experimentId, world, player);
    view.clear();
  },
  spawn: spawnAtLook,
});

const controls = new Controls(canvas, (action) => {
  if (action === "select") {
    selectedId = view.pickId();
    const obj = selectedId ? world.get(selectedId) : undefined;
    if (obj?.pickupable && player.heldId !== obj.id) {
      /* select only; T to grab */
    }
  } else if (action.startsWith("look:")) {
    const parts = action.split(":");
    applyLook(player, Number(parts[1]), Number(parts[2]), controls.sensitivity);
  } else if (action === "throw") throwHeld();
  else if (action === "menu") {
    document.exitPointerLock();
    hud.toggleMenu();
  }
  else if (action === "pause") world.paused = !world.paused;
  else if (action.startsWith("mode:")) projection.mode = action.slice(5) as ProjectionMode;
  else if (action === "grab") grab();
  else if (action === "drop") drop();
  else if (action === "gravity-panel") {
    document.exitPointerLock();
    hud.toggleGrav();
  } else if (action === "help") {
    document.exitPointerLock();
    hud.toggleHelp();
  }
  else if (action === "axes") view.showAxes = !view.showAxes;
  else if (action === "inspect") hud.inspectOpen = !hud.inspectOpen;
  else if (action === "delete" && selectedId) {
    if (player.heldId === selectedId) player.heldId = null;
    world.remove(selectedId);
    selectedId = null;
  } else if (action === "noclip") player.noclip = !player.noclip;
  else if (action === "reset") {
    loadExperiment(world.experimentId, world, player);
    view.clear();
  } else if (action === "speed-up") world.speed = Math.min(3, world.speed + 0.1);
  else if (action === "speed-down") world.speed = Math.max(0, world.speed - 0.1);
  else if (action === "create-cube") spawnAtLook("cube");
  else if (action === "create-sphere") spawnAtLook("sphere");
  else if (action === "create-penteract") spawnAtLook("penteract");
  else if (action === "create-portal") spawnAtLook("portal");
});

canvas.addEventListener("click", () => hud.hideEntry());
hudRoot.querySelector("#entry-overlay")?.addEventListener("click", () => hud.hideEntry());

function resize(): void {
  view.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

loadExperiment("room", world, player);

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames += 1;
  fpsT += dt;
  if (fpsT >= 0.4) {
    fps = frames / fpsT;
    frames = 0;
    fpsT = 0;
  }

  const moved = movePlayer(player, controls.input, dt);
  dimFlash.w = Math.max(0, dimFlash.w - dt * 3) + (Math.abs(moved.w) > 0 ? 1 : 0);
  dimFlash.v = Math.max(0, dimFlash.v - dt * 3) + (Math.abs(moved.v) > 0 ? 1 : 0);
  world.step(dt, player);
  holdTick();
  collideAndMove(world, player);
  view.sync(world, player, projection, selectedId);
  view.render();
  hud.update(player, world, projection, selectedId ? world.get(selectedId) ?? null : null, fps, dimFlash);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
