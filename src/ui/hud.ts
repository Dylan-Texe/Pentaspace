import type { ProjectionMode, ProjectionSettings } from "../projection/engine";
import type { WorldObject } from "../sim/types";
import type { PlayerState } from "../sim/types";
import type { World } from "../sim/world";
import { AXES } from "../math/vec5";
import { EXPERIMENTS } from "../experiments";

export interface HudHandlers {
  setMode: (m: ProjectionMode) => void;
  setExperiment: (id: string) => void;
  togglePause: () => void;
  setSpeed: (s: number) => void;
  setGravity: (axis: number, value: number) => void;
  setProj: (key: keyof ProjectionSettings, value: number | boolean) => void;
  reset: () => void;
  spawn: (kind: string) => void;
}

const KIND_LABEL: Record<string, string> = {
  sphere: "5D Sphere",
  hypersphere: "5D Hypersphere (4-sphere)",
  cube: "5D Cube / AABB",
  hypercube: "Tesseract (4-cube)",
  penteract: "Penteract (5-cube)",
  plane: "5D Slab",
  grid: "5D Lattice (diagrammatic)",
  particle: "5D Particle",
  corridor: "5D Corridor slab",
  room: "5D Room slab",
  door: "5D Door / wall",
  portal: "5D Portal",
  creature: "5D Creature part",
  wall: "5D Wall",
  "gravity-source": "5D Gravity source",
  goal: "5D Goal hypersphere",
};

export class Hud {
  root: HTMLElement;
  private bars: HTMLElement;
  private nums: HTMLElement;
  private inspect: HTMLElement;
  private fpsEl: HTMLElement;
  private timeEl: HTMLElement;
  private modeEl: HTMLElement;
  private expEl: HTMLElement;
  private noteEl: HTMLElement;
  private mathEl: HTMLElement;
  private menu: HTMLElement;
  private help: HTMLElement;
  private gravPanel: HTMLElement;
  private star: HTMLCanvasElement;
  private overlay: HTMLElement;
  private pauseEl: HTMLElement;
  private speedEl: HTMLElement;
  menuOpen = false;
  helpOpen = false;
  inspectOpen = true;
  gravOpen = false;

  constructor(root: HTMLElement, private handlers: HudHandlers) {
    this.root = root;
    root.innerHTML = this.template();
    this.bars = root.querySelector("#coord-bars")!;
    this.nums = root.querySelector("#coord-nums")!;
    this.inspect = root.querySelector("#inspector-body")!;
    this.fpsEl = root.querySelector("#stat-fps")!;
    this.timeEl = root.querySelector("#stat-time")!;
    this.modeEl = root.querySelector("#stat-mode")!;
    this.expEl = root.querySelector("#stat-exp")!;
    this.noteEl = root.querySelector("#lab-note")!;
    this.mathEl = root.querySelector("#math-note")!;
    this.menu = root.querySelector("#exp-menu")!;
    this.help = root.querySelector("#help-card")!;
    this.gravPanel = root.querySelector("#grav-panel")!;
    this.star = root.querySelector("#star-plot")!;
    this.overlay = root.querySelector("#entry-overlay")!;
    this.pauseEl = root.querySelector("#stat-pause")!;
    this.speedEl = root.querySelector("#stat-speed")!;
    this.bind();
    this.syncToggles();
  }

  private template(): string {
    const exps = EXPERIMENTS.map(
      (e) =>
        `<button class="exp-btn" data-exp="${e.id}"><span class="exp-title">${e.title}</span><span class="exp-blurb">${e.blurb}</span></button>`,
    ).join("");
    return `
    <header class="bezel top-bezel">
      <div class="mark">PENTASPACE <em>GEOM-5</em></div>
      <div class="stats">
        <span>EXP <b id="stat-exp">—</b></span>
        <span>MODE <b id="stat-mode">combined</b></span>
        <span>SIM <b id="stat-pause">RUN</b></span>
        <span>RATE <b id="stat-speed">1.00</b></span>
        <span>t <b id="stat-time">0.00</b></span>
        <span>FPS <b id="stat-fps">—</b></span>
      </div>
    </header>
    <aside class="bezel left-bezel">
      <div class="engraved">OBSERVER ∈ ℝ⁵</div>
      <div id="coord-nums" class="nums"></div>
      <div id="coord-bars" class="bars"></div>
      <canvas id="star-plot" width="180" height="180" title="Diagrammatic 5-axis plot"></canvas>
      <p class="tiny">Star plot is a diagram — not a 5D embedding.</p>
    </aside>
    <aside class="bezel right-bezel" id="inspector">
      <div class="engraved">OBJECT INSPECTOR</div>
      <div id="inspector-body" class="inspect">No selection. Click an object.</div>
    </aside>
    <footer class="bezel bottom-bezel">
      <div class="row">
        <span class="engraved">PROJECTION</span>
        <button data-mode="perspective">1 PERSPECTIVE</button>
        <button data-mode="orthographic">2 ORTHO</button>
        <button data-mode="slice">3 SLICE</button>
        <button data-mode="combined">4 COMBINED</button>
      </div>
      <div class="row sliders">
        <label>dW <input id="dW" type="range" min="1.2" max="8" step="0.1" value="3.2" /></label>
        <label>dV <input id="dV" type="range" min="1.2" max="8" step="0.1" value="3.2" /></label>
        <label>sliceW <input id="thW" type="range" min="0.15" max="3" step="0.05" value="0.85" /></label>
        <label>sliceV <input id="thV" type="range" min="0.15" max="3" step="0.05" value="0.85" /></label>
        <label>speed <input id="spd" type="range" min="0" max="2.5" step="0.05" value="1" /></label>
        <label class="chk"><input id="shear" type="checkbox" /> artistic shear</label>
      </div>
      <div class="row">
        <button id="btn-pause">P PAUSE</button>
        <button id="btn-reset">0 RESET</button>
        <button id="btn-menu">TAB EXPERIMENTS</button>
        <button id="btn-help">H HELP</button>
        <button id="btn-grav">G GRAVITY</button>
        <button data-spawn="cube">K CUBE</button>
        <button data-spawn="sphere">L SPHERE</button>
        <button data-spawn="penteract">O 5-CUBE</button>
        <button data-spawn="portal">U PORTAL</button>
        <button data-spawn="wall">WALL</button>
        <button data-spawn="gravity">ATTRACTOR</button>
        <button data-spawn="particles">PARTICLES</button>
      </div>
    </footer>
    <div id="lab-note" class="lab-note"></div>
    <div id="math-note" class="math-note"></div>
    <div id="exp-menu" class="overlay-card hidden">
      <div class="engraved">EXPERIMENT SELECTOR</div>
      <div class="exp-grid">${exps}</div>
    </div>
    <div id="help-card" class="overlay-card">
      <div class="engraved">LAB BRIEFING</div>
      <p>This is a <b>mathematical 5D simulation</b> projected onto a 3D view, then a 2D screen. The projection is <b>not</b> what a 5D observer would see.</p>
      <ul>
        <li><b>WASD</b> move XYZ · <b>mouse</b> look · <b>Space/Shift</b> ±Y</li>
        <li><b>Q/E</b> move W (magenta) · <b>R/F</b> move V (amber)</li>
        <li><b>1–4</b> projection modes · <b>T</b> pick up · <b>X</b> drop · <b>RMB</b> throw</li>
        <li><b>M</b> axis overlay (diagrammatic W/V lines) · <b>N</b> noclip</li>
        <li>Click the view to capture the pointer. Esc releases it.</li>
      </ul>
      <p class="tiny">Exact: 5D coordinates, 5D rotations, hypersphere slices, hypercube vertices, 5D Euler physics. Artistic: portal rings, axis overlay, star plot, fog tint.</p>
      <button id="help-close">ACKNOWLEDGE</button>
    </div>
    <div id="grav-panel" class="overlay-card grav hidden">
      <div class="engraved">GRAVITY VECTOR g ∈ ℝ⁵</div>
      ${["X", "Y", "Z", "W", "V"]
        .map(
          (a, i) =>
            `<label>${a} <input data-g="${i}" type="number" step="0.1" value="${i === 1 ? "-9.81" : "0"}" /></label>`,
        )
        .join("")}
      <p class="tiny">Default (0, −9.81, 0, 0, 0). Try g_W = 2.</p>
    </div>
    <div id="entry-overlay" class="entry">
      <div>
        <div class="mark big">PENTASPACE</div>
        <p>Five-dimensional geometry laboratory</p>
        <p class="tiny">Click to enter · local simulation · no network</p>
      </div>
    </div>
    `;
  }

  private bind(): void {
    this.root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => this.handlers.setMode((btn as HTMLElement).dataset.mode as ProjectionMode));
    });
    this.root.querySelectorAll("[data-exp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.handlers.setExperiment((btn as HTMLElement).dataset.exp ?? "room");
        this.menuOpen = false;
        this.syncToggles();
      });
    });
    this.root.querySelectorAll("[data-spawn]").forEach((btn) => {
      btn.addEventListener("click", () => this.handlers.spawn((btn as HTMLElement).dataset.spawn ?? "cube"));
    });
    this.root.querySelector("#btn-pause")?.addEventListener("click", () => this.handlers.togglePause());
    this.root.querySelector("#btn-reset")?.addEventListener("click", () => this.handlers.reset());
    this.root.querySelector("#btn-menu")?.addEventListener("click", () => {
      this.menuOpen = !this.menuOpen;
      this.syncToggles();
    });
    this.root.querySelector("#btn-help")?.addEventListener("click", () => {
      this.helpOpen = !this.helpOpen;
      this.syncToggles();
    });
    this.root.querySelector("#btn-grav")?.addEventListener("click", () => {
      this.gravOpen = !this.gravOpen;
      this.syncToggles();
    });
    this.root.querySelector("#help-close")?.addEventListener("click", () => {
      this.helpOpen = false;
      this.syncToggles();
    });
    const bindRange = (id: string, key: keyof ProjectionSettings) => {
      this.root.querySelector(`#${id}`)?.addEventListener("input", (e) => {
        this.handlers.setProj(key, Number((e.target as HTMLInputElement).value));
      });
    };
    bindRange("dW", "distanceW");
    bindRange("dV", "distanceV");
    bindRange("thW", "thicknessW");
    bindRange("thV", "thicknessV");
    this.root.querySelector("#spd")?.addEventListener("input", (e) => {
      this.handlers.setSpeed(Number((e.target as HTMLInputElement).value));
    });
    this.root.querySelector("#shear")?.addEventListener("change", (e) => {
      this.handlers.setProj("artisticShear", (e.target as HTMLInputElement).checked);
    });
    this.root.querySelectorAll("[data-g]").forEach((el) => {
      el.addEventListener("change", () => {
        const i = Number((el as HTMLElement).dataset.g);
        this.handlers.setGravity(i, Number((el as HTMLInputElement).value));
      });
    });
  }

  hideEntry(): void {
    this.overlay.classList.add("hidden");
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.syncToggles();
  }

  toggleHelp(): void {
    this.helpOpen = !this.helpOpen;
    this.syncToggles();
  }

  toggleGrav(): void {
    this.gravOpen = !this.gravOpen;
    this.syncToggles();
  }

  private syncToggles(): void {
    this.menu.classList.toggle("hidden", !this.menuOpen);
    this.help.classList.toggle("hidden", !this.helpOpen);
    this.gravPanel.classList.toggle("hidden", !this.gravOpen);
  }

  update(
    player: PlayerState,
    world: World,
    settings: ProjectionSettings,
    selected: WorldObject | null,
    fps: number,
    dimFlash: { w: number; v: number },
  ): void {
    this.fpsEl.textContent = String(Math.round(fps));
    this.timeEl.textContent = world.time.toFixed(1);
    this.modeEl.textContent = settings.mode;
    this.expEl.textContent = world.experimentId;
    this.pauseEl.textContent = world.paused ? "HALT" : "RUN";
    this.speedEl.textContent = world.speed.toFixed(2);
    this.noteEl.textContent = world.objective;
    this.mathEl.textContent = world.mathNote;
    this.root.classList.toggle("flash-w", dimFlash.w > 0);
    this.root.classList.toggle("flash-v", dimFlash.v > 0);

    const vals = player.pos.toArray();
    this.nums.innerHTML = AXES.map((a, i) => {
      const n = vals[i] ?? 0;
      const cls = a === "W" ? "w" : a === "V" ? "v" : "";
      return `<div class="${cls}"><span>${a}</span><b>${n.toFixed(2)}</b></div>`;
    }).join("");
    this.bars.innerHTML = AXES.map((a, i) => {
      const n = vals[i] ?? 0;
      const t = Math.min(1, Math.max(0, (n + 20) / 40));
      const cls = a === "W" ? "w" : a === "V" ? "v" : "";
      return `<div class="bar-row ${cls}"><span>${a}</span><div class="track"><div class="fill" style="width:${(t * 100).toFixed(1)}%"></div></div></div>`;
    }).join("");

    this.drawStar(vals);
    this.renderInspect(selected);
  }

  private drawStar(vals: number[]): void {
    const ctx = this.star.getContext("2d");
    if (!ctx) return;
    const w = this.star.width;
    const h = this.star.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const r = 68;
    ctx.strokeStyle = "rgba(126,240,255,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + i * ((Math.PI * 2) / 5);
      const mag = Math.min(1, Math.abs(vals[i] ?? 0) / 12);
      const px = cx + Math.cos(ang) * r * mag;
      const py = cy + Math.sin(ang) * r * mag;
      pts.push([px, py]);
      ctx.strokeStyle = i === 3 ? "#e060ff" : i === 4 ? "#ffc857" : "rgba(180,220,230,0.35)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(AXES[i]!, cx + Math.cos(ang) * (r + 14) - 4, cy + Math.sin(ang) * (r + 14) + 4);
    }
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = "rgba(126,240,255,0.12)";
    ctx.strokeStyle = "#7ef0ff";
    ctx.fill();
    ctx.stroke();
  }

  private renderInspect(obj: WorldObject | null): void {
    if (!obj) {
      this.inspect.textContent = "No selection. Click an object.";
      return;
    }
    const p = obj.pos;
    const s = obj.size;
    const math = obj.exactMath ? "exact 5D math" : "artistic overlay";
    this.inspect.innerHTML = `
      <div class="obj-name">${obj.name}</div>
      <div>Type: ${KIND_LABEL[obj.kind] ?? obj.kind}</div>
      <div class="tiny">${math}</div>
      <div class="sub">Position</div>
      ${AXES.map((a, i) => `<div>${a}: ${p.component(i).toFixed(2)}</div>`).join("")}
      <div class="sub">Extents / radius</div>
      ${AXES.map((a, i) => `<div>${a}: ${s.component(i).toFixed(2)}</div>`).join("")}
      <div class="tiny">${obj.note}</div>
    `;
  }
}
