# PENTASPACE

Local interactive laboratory for **five spatial dimensions** (X, Y, Z, W, V).

This is a mathematical visualization. The engine stores every object as a point (or solid) in **R⁵**. What you see on screen is a **3D projection or slice** of that 5D state, then a 2D picture. It is not a claim that humans can inhabit a fifth spatial dimension, and it is not what a hypothetical 5D retina would see.

## Run (entirely on your machine)

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). Click the view to capture the mouse.

No account, no cloud, no telemetry, no API keys.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move in XZ |
| Mouse | Look |
| Space / Shift | ±Y |
| Q / E | −W / +W |
| R / F | −V / +V |
| 1 2 3 4 | Perspective / Ortho / Slice / Combined |
| T | Pick up / put down |
| X | Drop |
| Right click | Throw |
| Tab | Experiments |
| P | Pause simulation |
| G | Gravity vector |
| M | Diagrammatic 5-axis overlay |
| N | Noclip |
| K L O U | Spawn cube / sphere / penteract / portal |
| 0 | Reset experiment |

## Architecture

```
5D Mathematics     src/math
      ↓
5D Simulation      src/sim
      ↓
5D World State     World.objects : { pos, vel, size } in R⁵
      ↓
Projection Engine  src/projection  (5D → 3D)
      ↓
3D Renderer        src/render      (Three.js / WebGL)
      ↓
User Interface     src/ui
```

The renderer does not decide 5D motion or collisions. It only maps the current 5D state into Three.js meshes.

## What is exact vs artistic

**Exact**

- 5D vectors and 5×5 rotation matrices (10 planes: XY, XZ, XW, XV, YZ, YW, YV, ZW, ZV, WV)
- Penteract / tesseract vertices and edges
- Successive hyperplane slices of those polytopes
- Hypersphere 3-ball radius `√(R² − Δw² − Δv²)`
- 5D Euler integration and sphere–AABB collision
- Portal teleport between two points of R⁵

**Artistic (labeled in the inspector / notes)**

- Portal rings and sparkle
- Fog tint when you move in W or V
- Star-plot HUD and the optional in-world W/V axis sticks
- Lattice overlay

## Experiments

Tesseract, Penteract, 5D Sphere, 5D Room, 5D Maze, W-Corridor, V-Corridor, 5D Portal, Topology, 5D Physics, Impossible Object, Free Sandbox.
