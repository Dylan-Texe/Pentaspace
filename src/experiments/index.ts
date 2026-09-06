import { Vec5 } from "../math/vec5";
import { makeObject, resetIds, type PlayerState } from "../sim/types";
import type { World } from "../sim/world";
import {
  addBall,
  addBox,
  addGrid,
  addPenteract,
  addPortalPair,
  addTesseract,
  doorwayNorth,
  shell,
  WALL,
  WALL_V,
  WALL_W,
} from "./spawn";

export interface ExperimentDef {
  id: string;
  title: string;
  blurb: string;
  load: (world: World, player: PlayerState) => void;
}

function resetActor(player: PlayerState, pos: Vec5, yaw = 0): void {
  player.pos.copy(pos);
  player.vel.set(0, 0, 0, 0, 0);
  player.yaw = yaw;
  player.pitch = 0;
  player.heldId = null;
  player.noclip = false;
}

function creature(world: World, origin: Vec5): void {
  const core = world.add(
    makeObject({
      kind: "creature",
      name: "Pentaform core",
      pos: origin.clone(),
      size: new Vec5(0.55, 0.55, 0.55, 0.55, 0.55),
      color: 0x7dffc3,
      emissive: 0x0a3020,
      kinematic: true,
      pickupable: false,
      spinPlanes: [{ plane: "WV", speed: 0.6 }],
      note: "5D creature. Body parts sit at different (W,V). Slice to see organs; project to see the whole as overlapping ghosts.",
      exactMath: true,
    }),
  );
  const parts: Array<[string, Vec5, number, number]> = [
    ["cranial lobe (W+)", new Vec5(0, 0.85, 0.15, 1.6, 0), 0.32, 0xff7ad9],
    ["caudal lobe (W−)", new Vec5(0, 0.2, -0.4, -1.5, 0), 0.28, 0x88a0ff],
    ["dexter arm (V+)", new Vec5(0.9, 0.1, 0, 0, 1.7), 0.26, 0xffc857],
    ["sinister arm (V−)", new Vec5(-0.9, 0.1, 0, 0, -1.7), 0.26, 0xffc857],
    ["WV node", new Vec5(0, 0.4, 0.2, 1.1, 1.1), 0.22, 0xffffff],
  ];
  for (const [name, off, r, col] of parts) {
    world.add(
      makeObject({
        kind: "creature",
        name,
        pos: origin.clone().add(off),
        size: new Vec5(r, r, r, r, r),
        color: col,
        emissive: 0x111111,
        kinematic: true,
        parentId: core.id,
        localOffset: off,
        pickupable: false,
        note: "Creature part offset in 5D from the core.",
        exactMath: true,
      }),
    );
  }
}

function loadTesseract(world: World, player: PlayerState): void {
  world.objective = "Walk around the 4-cube. Press E/Q to move in W — the projected wireframe shears and the slice solid changes.";
  world.mathNote = "Exact: 16 vertices of [-s,s]⁴, rotated in 5D, then perspective  W→3D or a W-slice. V is near zero.";
  addGrid(world);
  addTesseract(world, "Tesseract", new Vec5(0, 2.2, 0, 0, 0), 2.1, 0x7ef0ff, {
    spinPlanes: [
      { plane: "XW", speed: 0.4 },
      { plane: "YZ", speed: 0.12 },
    ],
  });
  addBall(world, "Marker sphere (W=1.5)", new Vec5(0, 2.2, 0, 1.5, 0), 0.45, 0xff79c7, {
    kinematic: true,
    pickupable: true,
  });
  resetActor(player, new Vec5(0, 1.7, 9, 0, 0));
}

function loadPenteract(world: World, player: PlayerState): void {
  world.objective = "A 5-cube has 32 vertices. Rotate your W and V. Combined mode shows projected skeleton + solid slice.";
  world.mathNote = "Exact: 2⁵ vertices, 80 edges. Solid = hyperplane slice W then V of the rotated 5-cube.";
  addGrid(world);
  addPenteract(world, "Penteract", new Vec5(0, 2.4, 0, 0, 0), 2.0, 0xe2a6ff, {
    spinPlanes: [
      { plane: "XW", speed: 0.28 },
      { plane: "YV", speed: 0.22 },
      { plane: "ZW", speed: 0.08 },
    ],
  });
  addPenteract(world, "Small 5-cube", new Vec5(6, 1.4, -3, 0.8, -0.6), 0.8, 0x5ce1e6, {
    spinPlanes: [{ plane: "WV", speed: 0.7 }],
    pickupable: true,
  });
  resetActor(player, new Vec5(0, 1.7, 10, 0, 0));
}

function loadSphere(world: World, player: PlayerState): void {
  world.objective = "A 4-sphere in R⁵ meets a 3-flat in a 3-ball whose radius shrinks as you leave its (W,V). Walk through it.";
  world.mathNote = "Exact slice: r = √(R² − (w−w₀)² − (v−v₀)²). Empty if the 3-flat misses the 5-ball.";
  addGrid(world);
  addBall(world, "Hypersphere R=3.2", new Vec5(0, 2, 0, 0, 0), 3.2, 0x6ad2ff, {
    kinematic: true,
    opacity: 0.45,
    emissive: 0x042030,
  });
  addBall(world, "Companion (W=2.5)", new Vec5(4, 1.5, 0, 2.5, 0), 1.1, 0xff7ad9, { kinematic: true });
  addBall(world, "Companion (V=2.5)", new Vec5(-4, 1.5, 0, 0, 2.5), 1.1, 0xffc857, { kinematic: true });
  addBall(world, "Handheld 5-ball", new Vec5(0, 1.2, 4, 0, 0), 0.45, 0xb8ff9a, {
    kinematic: false,
    mass: 0.8,
  });
  resetActor(player, new Vec5(0, 1.7, 9, 0, 0));
}

function loadRoom(world: World, player: PlayerState): void {
  world.objective = "Start in an ordinary room. Move W with E/Q, then V with R/F. Walls, doors, and interiors are different 5D slabs.";
  world.mathNote = "Each wall is a 5D AABB. Collision and visibility use all five coordinates. No fake slider — your body has a W and V.";
  addGrid(world);
  const t = 0.28;
  const h = new Vec5(11, 3.4, 11, 0.55, 0.55);
  shell(world, new Vec5(0, 3.4, 0, 0, 0), h, t, WALL, "room");
  addBox(
    world,
    "solid north wall (W≈0)",
    new Vec5(0, 3.4, -11, 0, 0),
    new Vec5(11, 3.4, t, 0.55, 0.55),
    0x2a3548,
    { kind: "door", note: "Sealed at W≈0. At W≈2 this slab is gone and a doorway slab exists instead." },
  );
  addBox(world, "table", new Vec5(0, 1.05, 2, 0, 0), new Vec5(1.6, 0.12, 1.0, 0.4, 0.4), 0x5a4638, {
    kind: "cube",
    pickupable: false,
  });
  addBox(world, "pedestal", new Vec5(0, 0.5, 2, 0, 0), new Vec5(0.35, 0.5, 0.35, 0.4, 0.4), 0x3a322c, { kind: "cube" });
  addBall(world, "Chamber sphere", new Vec5(0, 1.55, 2, 0, 0), 0.38, 0x7ef0ff, { kinematic: true, mass: 0.5 });

  const h2 = new Vec5(11, 3.4, 11, 0.7, 0.55);
  addBox(world, "floor W2", new Vec5(0, 0, 0, 2.1, 0), new Vec5(11, t, 11, 0.7, 0.55), 0x1a1224, { kind: "room" });
  addBox(world, "ceiling W2", new Vec5(0, 6.8, 0, 2.1, 0), new Vec5(11, t, 11, 0.7, 0.55), 0x24182e, { kind: "room" });
  addBox(world, "wall +Z W2", new Vec5(0, 3.4, 11, 2.1, 0), new Vec5(11, 3.4, t, 0.7, 0.55), WALL_W, { kind: "room" });
  addBox(world, "wall −X W2", new Vec5(-11, 3.4, 0, 2.1, 0), new Vec5(t, 3.4, 11, 0.7, 0.55), WALL_W, { kind: "room" });
  addBox(world, "wall +X W2", new Vec5(11, 3.4, 0, 2.1, 0), new Vec5(t, 3.4, 11, 0.7, 0.55), WALL_W, { kind: "room" });
  doorwayNorth(world, new Vec5(0, 3.4, 0, 2.1, 0), h2, t, 1.6, WALL_W);

  shell(world, new Vec5(0, 3.4, -22, 2.1, 0), new Vec5(7, 3.4, 7, 0.7, 0.55), t, 0x4a3060, "room");
  addBall(world, "Hidden annex sphere", new Vec5(0, 1.4, -22, 2.1, 0), 0.7, 0xff79c7, { kinematic: true });

  addBox(world, "nested room floor", new Vec5(0, 0.2, 0, 2.1, 0), new Vec5(3.2, 0.12, 3.2, 0.55, 0.4), 0x2a1838, {
    kind: "room",
  });
  addBox(world, "nested −X", new Vec5(-3.2, 1.8, 0, 2.1, 0), new Vec5(0.12, 1.6, 3.2, 0.55, 0.4), 0x6a3a80, {
    kind: "room",
    opacity: 0.7,
  });
  addBox(world, "nested +X", new Vec5(3.2, 1.8, 0, 2.1, 0), new Vec5(0.12, 1.6, 3.2, 0.55, 0.4), 0x6a3a80, {
    kind: "room",
    opacity: 0.7,
  });
  addBox(world, "nested +Z", new Vec5(0, 1.8, 3.2, 2.1, 0), new Vec5(3.2, 1.6, 0.12, 0.55, 0.4), 0x6a3a80, {
    kind: "room",
    opacity: 0.7,
  });
  addBox(world, "nested −Z", new Vec5(0, 1.8, -3.2, 2.1, 0), new Vec5(3.2, 1.6, 0.12, 0.55, 0.4), 0x6a3a80, {
    kind: "room",
    opacity: 0.55,
    note: "A room that occupies the same XYZ as the table, but only at W≈2.",
  });

  addBox(world, "floor V2", new Vec5(0, 0, 0, 0, 2.2), new Vec5(11, t, 11, 0.55, 0.7), 0x241c10, { kind: "room" });
  addBox(world, "wall −Z V2", new Vec5(0, 3.4, -11, 0, 2.2), new Vec5(11, 3.4, t, 0.55, 0.7), WALL_V, { kind: "room" });
  addBox(world, "wall +Z V2", new Vec5(0, 3.4, 11, 0, 2.2), new Vec5(11, 3.4, t, 0.55, 0.7), WALL_V, { kind: "room" });
  addBox(world, "wall −X V2", new Vec5(-11, 3.4, 0, 0, 2.2), new Vec5(t, 3.4, 11, 0.55, 0.7), WALL_V, { kind: "room" });
  addBox(world, "east opening frame", new Vec5(11, 3.4, -6, 0, 2.2), new Vec5(t, 3.4, 5, 0.55, 0.7), WALL_V, {
    kind: "door",
  });
  addBox(world, "east opening frame 2", new Vec5(11, 3.4, 6, 0, 2.2), new Vec5(t, 3.4, 5, 0.55, 0.7), WALL_V, {
    kind: "door",
  });
  addBox(world, "V-annex floor", new Vec5(20, 0, 0, 0, 2.2), new Vec5(8, t, 5, 0.5, 0.7), 0x2a2010, { kind: "corridor" });
  addBox(world, "V-annex +Z", new Vec5(20, 3.4, 5, 0, 2.2), new Vec5(8, 3.4, t, 0.5, 0.7), WALL_V, { kind: "corridor" });
  addBox(world, "V-annex −Z", new Vec5(20, 3.4, -5, 0, 2.2), new Vec5(8, 3.4, t, 0.5, 0.7), WALL_V, { kind: "corridor" });
  creature(world, new Vec5(22, 1.4, 0, 0, 2.2));

  addPortalPair(world, new Vec5(-6, 1.6, 6, 2.1, 2.0), new Vec5(0, 1.7, 8, 0, 0), "W/V gate", "Chamber return");
  addPenteract(world, "Chamber 5-cube", new Vec5(6, 2.5, -4, 2.1, 0), 1.1, 0xd9a6ff, {
    spinPlanes: [{ plane: "XW", speed: 0.4 }],
  });
  resetActor(player, new Vec5(0, 1.7, 6, 0, 0), 0);
}

function mazeCarve(nx: number, nz: number, nw: number): boolean[][][][] {
  const walls: boolean[][][][] = [];
  for (let x = 0; x < nx; x++) {
    walls[x] = [];
    for (let z = 0; z < nz; z++) {
      walls[x]![z] = [];
      for (let w = 0; w < nw; w++) {
        walls[x]![z]![w] = [true, true, true, true, true, true];
      }
    }
  }
  const seen = new Set<string>();
  const key = (x: number, z: number, w: number) => `${x}:${z}:${w}`;
  const stack: Array<[number, number, number]> = [[0, 0, 0]];
  seen.add(key(0, 0, 0));
  const dirs: Array<[number, number, number, number, number]> = [
    [1, 0, 0, 0, 1],
    [-1, 0, 0, 1, 0],
    [0, 1, 0, 2, 3],
    [0, -1, 0, 3, 2],
    [0, 0, 1, 4, 5],
    [0, 0, -1, 5, 4],
  ];
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const options = dirs.filter(([dx, dz, dw]) => {
      const nx_ = cur[0] + dx;
      const nz_ = cur[1] + dz;
      const nw_ = cur[2] + dw;
      return nx_ >= 0 && nz_ >= 0 && nw_ >= 0 && nx_ < nx && nz_ < nz && nw_ < nw && !seen.has(key(nx_, nz_, nw_));
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [dx, dz, dw, a, b] = options[Math.floor(Math.random() * options.length)]!;
    const npos: [number, number, number] = [cur[0] + dx, cur[1] + dz, cur[2] + dw];
    walls[cur[0]]![cur[1]]![cur[2]]![a] = false;
    walls[npos[0]]![npos[1]]![npos[2]]![b] = false;
    seen.add(key(npos[0], npos[1], npos[2]));
    stack.push(npos);
  }
  return walls;
}

function loadMaze(world: World, player: PlayerState): void {
  world.objective = "Navigate the 5D maze. Some passages exist only in W (Q/E). Reach the green goal hypersphere.";
  world.mathNote = "The maze is a 3-index lattice in (X,Z,W). V is unused here so the extra axis stays readable.";
  const nx = 5;
  const nz = 5;
  const nw = 3;
  const cell = 6;
  const walls = mazeCarve(nx, nz, nw);
  const originX = -((nx - 1) * cell) / 2;
  const originZ = -((nz - 1) * cell) / 2;
  const thick = 0.18;
  const hy = 1.8;

  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      for (let iw = 0; iw < nw; iw++) {
        const x = originX + ix * cell;
        const z = originZ + iz * cell;
        const w = (iw - 1) * 2.4;
        const wc = walls[ix]![iz]![iw]!;
        addBox(
          world,
          "maze floor",
          new Vec5(x, 0, z, w, 0),
          new Vec5(cell / 2, thick, cell / 2, 0.55, 0.8),
          iw === 1 ? 0x152028 : iw === 0 ? 0x1a1428 : 0x1a2418,
          { kind: "corridor", selectable: false },
        );
        if (wc[0]) {
          addBox(
            world,
            "maze +X",
            new Vec5(x + cell / 2, hy, z, w, 0),
            new Vec5(thick, hy, cell / 2, 0.55, 0.8),
            0x2c3d52,
            { kind: "wall" },
          );
        }
        if (wc[1]) {
          addBox(
            world,
            "maze −X",
            new Vec5(x - cell / 2, hy, z, w, 0),
            new Vec5(thick, hy, cell / 2, 0.55, 0.8),
            0x2c3d52,
            { kind: "wall" },
          );
        }
        if (wc[2]) {
          addBox(
            world,
            "maze +Z",
            new Vec5(x, hy, z + cell / 2, w, 0),
            new Vec5(cell / 2, hy, thick, 0.55, 0.8),
            0x2c3d52,
            { kind: "wall" },
          );
        }
        if (wc[3]) {
          addBox(
            world,
            "maze −Z",
            new Vec5(x, hy, z - cell / 2, w, 0),
            new Vec5(cell / 2, hy, thick, 0.55, 0.8),
            0x2c3d52,
            { kind: "wall" },
          );
        }
        if (wc[4]) {
          addBox(
            world,
            "maze W+",
            new Vec5(x, hy, z, w + 1.15, 0),
            new Vec5(cell / 2 - 0.4, hy, cell / 2 - 0.4, 0.12, 0.8),
            0x5a2a70,
            { kind: "wall", opacity: 0.55, note: "Barrier in W. If missing, you can Q/E between layers." },
          );
        }
        if (wc[5]) {
          addBox(
            world,
            "maze W−",
            new Vec5(x, hy, z, w - 1.15, 0),
            new Vec5(cell / 2 - 0.4, hy, cell / 2 - 0.4, 0.12, 0.8),
            0x5a2a70,
            { kind: "wall", opacity: 0.55 },
          );
        }
        if (!wc[4] || !wc[5]) {
          addBox(
            world,
            "W-shaft mark",
            new Vec5(x, 0.08, z, w, 0),
            new Vec5(0.7, 0.05, 0.7, 0.4, 0.4),
            0xc44cff,
            { kind: "plane", collidable: false, emissive: 0x4a1070, selectable: false },
          );
        }
      }
    }
  }
  const gx = originX + (nx - 1) * cell;
  const gz = originZ + (nz - 1) * cell;
  addBall(world, "Maze goal", new Vec5(gx, 1.4, gz, 2.4, 0), 0.9, 0x7cffb2, {
    kind: "goal",
    kinematic: true,
    emissive: 0x0a4020,
    pickupable: false,
  });
  resetActor(player, new Vec5(originX, 1.7, originZ, -2.4, 0));
}

function loadCorridorW(world: World, player: PlayerState): void {
  world.objective = "The hallway dead-ends in XYZ. Hold E and travel in W through the magenta arches.";
  world.mathNote = "Arches are thin AABBs along W. Your XZY can stay fixed while W changes — a literal 5D corridor.";
  addBox(world, "hall floor", new Vec5(0, 0, -6, 0, 0), new Vec5(2.2, 0.2, 8, 0.5, 0.5), 0x1a222c, { kind: "corridor" });
  addBox(world, "hall +X", new Vec5(2.2, 2, -6, 0, 0), new Vec5(0.2, 2, 8, 0.5, 0.5), WALL, { kind: "corridor" });
  addBox(world, "hall −X", new Vec5(-2.2, 2, -6, 0, 0), new Vec5(0.2, 2, 8, 0.5, 0.5), WALL, { kind: "corridor" });
  addBox(world, "dead end", new Vec5(0, 2, -14, 0, 0), new Vec5(2.4, 2, 0.25, 0.5, 0.5), 0x8a3040, {
    kind: "wall",
    note: "Solid at W≈0. Move in W; this slab does not extend.",
  });
  addBox(world, "W-floor", new Vec5(0, 0, -14, 0, 0), new Vec5(2.2, 0.2, 2.2, 10, 0.5), 0x201428, { kind: "corridor" });
  for (let i = -8; i <= 8; i += 2) {
    addBox(world, `arch ${i}`, new Vec5(-2.1, 2, -14, i, 0), new Vec5(0.15, 2, 0.15, 0.18, 0.4), 0xc44cff, {
      kind: "corridor",
      collidable: false,
      emissive: 0x401060,
    });
    addBox(world, `arch r ${i}`, new Vec5(2.1, 2, -14, i, 0), new Vec5(0.15, 2, 0.15, 0.18, 0.4), 0xc44cff, {
      kind: "corridor",
      collidable: false,
      emissive: 0x401060,
    });
    addBox(world, `arch t ${i}`, new Vec5(0, 4.1, -14, i, 0), new Vec5(2.2, 0.12, 0.15, 0.18, 0.4), 0xc44cff, {
      kind: "corridor",
      collidable: false,
      emissive: 0x401060,
    });
  }
  addBall(world, "W-terminus", new Vec5(0, 1.3, -14, 8, 0), 0.7, 0xff79c7, { kinematic: true });
  resetActor(player, new Vec5(0, 1.7, 0, 0, 0), Math.PI);
}

function loadCorridorV(world: World, player: PlayerState): void {
  world.objective = "Same idea as the W corridor, but along V (R/F). Amber is the V channel.";
  world.mathNote = "V is a fifth independent axis, orthogonal to W. Nothing here is a colour-coded fake of W.";
  addBox(world, "hall floor", new Vec5(0, 0, -5, 0, 0), new Vec5(2.2, 0.2, 7, 0.5, 0.5), 0x1c1a14, { kind: "corridor" });
  addBox(world, "hall +X", new Vec5(2.2, 2, -5, 0, 0), new Vec5(0.2, 2, 7, 0.5, 0.5), WALL_V, { kind: "corridor" });
  addBox(world, "hall −X", new Vec5(-2.2, 2, -5, 0, 0), new Vec5(0.2, 2, 7, 0.5, 0.5), WALL_V, { kind: "corridor" });
  addBox(world, "dead end", new Vec5(0, 2, -12, 0, 0), new Vec5(2.4, 2, 0.25, 0.5, 0.5), 0x8a6030, { kind: "wall" });
  addBox(world, "V-floor", new Vec5(0, 0, -12, 0, 0), new Vec5(2.2, 0.2, 2.2, 0.5, 10), 0x2a2010, { kind: "corridor" });
  for (let i = -8; i <= 8; i += 2) {
    addBox(world, `varch ${i}`, new Vec5(-2.1, 2, -12, 0, i), new Vec5(0.15, 2, 0.15, 0.4, 0.18), 0xffc857, {
      kind: "corridor",
      collidable: false,
      emissive: 0x403010,
    });
    addBox(world, `varch r ${i}`, new Vec5(2.1, 2, -12, 0, i), new Vec5(0.15, 2, 0.15, 0.4, 0.18), 0xffc857, {
      kind: "corridor",
      collidable: false,
      emissive: 0x403010,
    });
    addBox(world, `varch t ${i}`, new Vec5(0, 4.1, -12, 0, i), new Vec5(2.2, 0.12, 0.15, 0.4, 0.18), 0xffc857, {
      kind: "corridor",
      collidable: false,
      emissive: 0x403010,
    });
  }
  addBall(world, "V-terminus", new Vec5(0, 1.3, -12, 0, 8), 0.7, 0xffc857, { kinematic: true });
  resetActor(player, new Vec5(0, 1.7, 1, 0, 0), Math.PI);
}

function loadPortal(world: World, player: PlayerState): void {
  world.objective = "Walk into the cyan ring. You are moved to a different (X,Y,Z,W,V). Look at the HUD jump.";
  world.mathNote = "Exact: if ‖p − A‖₅ < r then p ← B + 2·normalize(B−A). Rings are artistic.";
  addGrid(world);
  addPortalPair(world, new Vec5(8, 1.8, 0, 0, 0), new Vec5(-8, 1.8, 0, 4.2, 2.2));
  addBox(world, "pad A", new Vec5(8, 0.1, 0, 0, 0), new Vec5(2, 0.1, 2, 0.8, 0.8), 0x143038, { kind: "plane" });
  addBox(world, "pad B", new Vec5(-8, 0.1, 0, 4.2, 2.2), new Vec5(2, 0.1, 2, 0.8, 0.8), 0x381428, { kind: "plane" });
  addPenteract(world, "Landmark 5-cube", new Vec5(-8, 3.5, 4, 4.2, 2.2), 1.2, 0xe2a6ff, {
    spinPlanes: [{ plane: "WV", speed: 0.5 }],
  });
  resetActor(player, new Vec5(0, 1.7, 8, 0, 0));
}

function loadTopology(world: World, player: PlayerState): void {
  world.objective = "Two rooms share XYZ and differ in W. A W-detour connects doors that 3D space cannot.";
  world.mathNote = "Connectivity is in R⁵. The 3D projection can look like overlapping rooms or a dead-end.";
  const t = 0.25;
  shell(world, new Vec5(0, 2.6, 0, 0, 0), new Vec5(6, 2.6, 6, 0.5, 0.5), t, WALL, "room");
  addBox(world, "door plug W0", new Vec5(0, 2.6, -6, 0, 0), new Vec5(1.4, 2.6, t, 0.5, 0.5), 0x8a3048, { kind: "door" });
  doorwayNorth(world, new Vec5(0, 2.6, 0, 2.4, 0), new Vec5(6, 2.6, 6, 0.55, 0.5), t, 1.4, WALL_W);
  addBox(world, "W0 floor", new Vec5(0, 0, 0, 0, 0), new Vec5(6, t, 6, 0.5, 0.5), 0x121820, { kind: "room" });
  addBox(world, "alcove floor", new Vec5(0, 0, 0, 1.2, 0), new Vec5(2, t, 2, 1.4, 0.5), 0x201428, { kind: "corridor" });
  addBox(world, "W-link floor", new Vec5(0, 0, -10, 2.4, 0), new Vec5(2.2, t, 4, 0.55, 0.5), 0x201428, {
    kind: "corridor",
  });
  addBox(world, "W-link +X", new Vec5(2.2, 2.2, -10, 2.4, 0), new Vec5(t, 2.2, 4, 0.55, 0.5), WALL_W, { kind: "corridor" });
  addBox(world, "W-link −X", new Vec5(-2.2, 2.2, -10, 2.4, 0), new Vec5(t, 2.2, 4, 0.55, 0.5), WALL_W, { kind: "corridor" });
  shell(world, new Vec5(0, 2.6, -18, 2.4, 0), new Vec5(5, 2.6, 5, 0.55, 0.5), t, 0x403060, "room");
  addBox(
    world,
    "return plug",
    new Vec5(0, 2.6, 6, 0, 0),
    new Vec5(1.4, 2.6, t, 0.5, 0.5),
    0x306048,
    { kind: "door", note: "Closed in 3D at W=0. The W-path arrives at the annex instead." },
  );
  addBall(world, "Topology token", new Vec5(0, 1.2, -18, 2.4, 0), 0.5, 0x7cffb2, { kinematic: true });
  resetActor(player, new Vec5(0, 1.7, 3, 0, 0), Math.PI);
}

function loadPhysics(world: World, player: PlayerState): void {
  world.objective = "Balls integrate velocity in R⁵. Add gravity on W or V and watch slices breathe as they fall through hidden axes.";
  world.mathNote = "Euler step: v ← v + g Δt, x ← x + v Δt, with 5D sphere–AABB collisions. Gravity is a Vec5.";
  addBox(world, "lab floor", new Vec5(0, -0.2, 0, 0, 0), new Vec5(16, 0.2, 16, 8, 8), 0x161e28, { kind: "plane" });
  addBox(world, "rail +X", new Vec5(16, 2, 0, 0, 0), new Vec5(0.2, 2, 16, 8, 8), 0x243044, { kind: "wall" });
  addBox(world, "rail −X", new Vec5(-16, 2, 0, 0, 0), new Vec5(0.2, 2, 16, 8, 8), 0x243044, { kind: "wall" });
  addBox(world, "rail +Z", new Vec5(0, 2, 16, 0, 0), new Vec5(16, 2, 0.2, 8, 8), 0x243044, { kind: "wall" });
  addBox(world, "rail −Z", new Vec5(0, 2, -16, 0, 0), new Vec5(16, 2, 0.2, 8, 8), 0x243044, { kind: "wall" });
  const cols = [0x6ad2ff, 0xff7ad9, 0xffc857, 0x7cffb2, 0xe2a6ff];
  for (let i = 0; i < 8; i++) {
    addBall(
      world,
      `dyn-${i}`,
      new Vec5((i - 3.5) * 1.4, 6 + (i % 3), (i % 4) - 1.5, (i - 4) * 0.4, (i % 2) * 0.8),
      0.4 + (i % 3) * 0.08,
      cols[i % cols.length]!,
      { kinematic: false, mass: 0.7 + i * 0.15 },
    );
  }
  world.add(
    makeObject({
      kind: "gravity-source",
      name: "5D attractor",
      pos: new Vec5(0, 3, -6, 2, 0),
      size: new Vec5(0.5, 0.5, 0.5, 0.5, 0.5),
      color: 0xffffff,
      emissive: 0x8866ff,
      mass: 14,
      collidable: false,
      kinematic: true,
      pickupable: true,
      note: "Point mass in R⁵. Acceleration ∝ r̂ / ‖r‖² (all five components).",
      exactMath: true,
    }),
  );
  world.gravity.set(0, -9.81, 0, 0, 0);
  resetActor(player, new Vec5(0, 1.7, 10, 0, 0));
}

function loadImpossible(world: World, player: PlayerState): void {
  world.objective = "Pick up the cube (T). The wall blocks XYZ at W≈0. Carry it around the wall by moving in W, then return.";
  world.mathNote = "The barrier is a 5D slab with small W extent. Going around it in W is the 5D analogue of walking around a 2D wall in 3D.";
  addBox(world, "ground", new Vec5(0, -0.15, 0, 0, 0), new Vec5(14, 0.15, 14, 6, 4), 0x121820, { kind: "plane" });
  addBox(world, "barrier", new Vec5(0, 2, 0, 0, 0), new Vec5(8, 2, 0.3, 0.45, 3), 0x8a3048, {
    kind: "wall",
    note: "Exists near W=0. At |W|>0.45 it does not intersect you.",
  });
  addBox(world, "left pillar", new Vec5(-8, 2, 0, 0, 0), new Vec5(0.4, 2, 0.4, 3, 3), 0x2c3d52, { kind: "wall" });
  addBox(world, "right pillar", new Vec5(8, 2, 0, 0, 0), new Vec5(0.4, 2, 0.4, 3, 3), 0x2c3d52, { kind: "wall" });
  addBox(world, "closed cube shell −X", new Vec5(-3.5, 1.6, 8, 0, 0), new Vec5(0.12, 1.5, 1.5, 0.45, 0.45), 0x3a6a8a, {
    kind: "cube",
    opacity: 0.85,
  });
  addBox(world, "closed cube shell +X", new Vec5(-0.5, 1.6, 8, 0, 0), new Vec5(0.12, 1.5, 1.5, 0.45, 0.45), 0x3a6a8a, {
    kind: "cube",
    opacity: 0.85,
  });
  addBox(world, "closed cube shell +Z", new Vec5(-2, 1.6, 9.5, 0, 0), new Vec5(1.5, 1.5, 0.12, 0.45, 0.45), 0x3a6a8a, {
    kind: "cube",
    opacity: 0.85,
  });
  addBox(world, "closed cube shell −Z", new Vec5(-2, 1.6, 6.5, 0, 0), new Vec5(1.5, 1.5, 0.12, 0.45, 0.45), 0x3a6a8a, {
    kind: "cube",
    opacity: 0.85,
  });
  addBox(world, "closed cube top", new Vec5(-2, 3.1, 8, 0, 0), new Vec5(1.5, 0.12, 1.5, 0.45, 0.45), 0x3a6a8a, {
    kind: "cube",
    opacity: 0.85,
  });
  addBox(world, "interior chamber", new Vec5(-2, 1.6, 8, 1.8, 0), new Vec5(1.2, 1.2, 1.2, 0.45, 0.4), 0x6a3a80, {
    kind: "room",
    opacity: 0.45,
    collidable: false,
    note: "Interior that only exists at W≈1.8 — a closed 3D box with a different inside along W.",
  });
  addBall(world, "Interior pearl", new Vec5(-2, 1.6, 8, 1.8, 0), 0.35, 0xffd27a, { kinematic: true });
  addBox(world, "carry cube", new Vec5(0, 1.1, 4, 0, 0), new Vec5(0.4, 0.4, 0.4, 0.4, 0.4), 0x7ef0ff, {
    kind: "cube",
    kinematic: false,
    pickupable: true,
    mass: 0.9,
    collidable: true,
  });
  creature(world, new Vec5(5, 1.4, -6, 1.2, 1.5));
  resetActor(player, new Vec5(0, 1.7, 7, 0, 0), Math.PI);
}

function loadSandbox(world: World, player: PlayerState): void {
  world.objective = "Empty R⁵. K cube, L sphere, O penteract, U portal pair. Build, throw, delete, break it.";
  world.mathNote = "Sandbox objects still live in five coordinates. Projection is only the view.";
  addGrid(world);
  addBox(world, "sandbox floor", new Vec5(0, -0.2, 0, 0, 0), new Vec5(30, 0.2, 30, 12, 12), 0x10161c, {
    kind: "plane",
    selectable: false,
  });
  resetActor(player, new Vec5(0, 1.7, 8, 0, 0));
}

export const EXPERIMENTS: ExperimentDef[] = [
  { id: "tesseract", title: "Tesseract", blurb: "4-cube wireframe + W slice", load: loadTesseract },
  { id: "penteract", title: "Penteract", blurb: "5-cube, 32 vertices, W and V", load: loadPenteract },
  { id: "sphere", title: "5D Sphere", blurb: "Hypersphere cross-sections", load: loadSphere },
  { id: "room", title: "5D Room", blurb: "Ordinary room that opens in W/V", load: loadRoom },
  { id: "maze", title: "5D Maze", blurb: "Passages in X, Z, and W", load: loadMaze },
  { id: "corridor-w", title: "W-Dimension Corridor", blurb: "Dead end that continues in W", load: loadCorridorW },
  { id: "corridor-v", title: "V-Dimension Corridor", blurb: "Amber corridor along V", load: loadCorridorV },
  { id: "portal", title: "5D Portal", blurb: "Teleport across 5-space", load: loadPortal },
  { id: "topology", title: "Topology Experiment", blurb: "Doors connected through W", load: loadTopology },
  { id: "physics", title: "5D Physics", blurb: "Gravity vector in five axes", load: loadPhysics },
  { id: "impossible", title: "Impossible Object", blurb: "Walk around a wall in W", load: loadImpossible },
  { id: "sandbox", title: "Free Sandbox", blurb: "Spawn your own 5D world", load: loadSandbox },
];

export function loadExperiment(id: string, world: World, player: PlayerState): void {
  const exp = EXPERIMENTS.find((e) => e.id === id) ?? EXPERIMENTS[3]!;
  resetIds();
  world.clear();
  world.experimentId = exp.id;
  world.note = exp.blurb;
  exp.load(world, player);
}
